import { useEffect, useMemo, useRef, useState } from "react";
import { Sfx } from "@/lib/puzzle/audio";
import { PuzzleStore } from "@/lib/puzzle/store";
import { Undo2, RotateCcw } from "lucide-react";
import { CompletionOverlay } from "./CompletionOverlay";

type Cell = number; // 0 = empty
type Grid = Cell[][];

const SIZE = 4;
const TARGET = 2048;

function empty(): Grid { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }
function clone(g: Grid): Grid { return g.map((r) => r.slice()); }
function addTile(g: Grid): Grid {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[r][c] === 0) empties.push([r, c]);
  if (!empties.length) return g;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  g[r][c] = Math.random() < 0.9 ? 2 : 4;
  return g;
}
function slide(row: Cell[]): { row: Cell[]; gained: number; moved: boolean } {
  const filtered = row.filter((x) => x !== 0);
  let gained = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      gained += filtered[i];
      filtered.splice(i + 1, 1);
    }
  }
  while (filtered.length < SIZE) filtered.push(0);
  const moved = filtered.some((v, i) => v !== row[i]);
  return { row: filtered, gained, moved };
}
function move(g: Grid, dir: "L" | "R" | "U" | "D"): { grid: Grid; gained: number; moved: boolean } {
  let gained = 0; let moved = false;
  const next = empty();
  for (let i = 0; i < SIZE; i++) {
    let line: Cell[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === "L") line.push(g[i][j]);
      else if (dir === "R") line.push(g[i][SIZE - 1 - j]);
      else if (dir === "U") line.push(g[j][i]);
      else line.push(g[SIZE - 1 - j][i]);
    }
    const { row, gained: gg, moved: mm } = slide(line);
    gained += gg; if (mm) moved = true;
    for (let j = 0; j < SIZE; j++) {
      if (dir === "L") next[i][j] = row[j];
      else if (dir === "R") next[i][SIZE - 1 - j] = row[j];
      else if (dir === "U") next[j][i] = row[j];
      else next[SIZE - 1 - j][i] = row[j];
    }
  }
  return { grid: next, gained, moved };
}
function canMove(g: Grid): boolean {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (g[r][c] === 0) return true;
    if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
    if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
  }
  return false;
}
function hasTarget(g: Grid): boolean {
  return g.some((r) => r.some((v) => v >= TARGET));
}

interface Save { grid: Grid; score: number; best: number; }

const TILE_COLOR: Record<number, string> = {
  2: "bg-[oklch(0.85_0.04_80)] text-[oklch(0.25_0.05_60)]",
  4: "bg-[oklch(0.82_0.06_80)] text-[oklch(0.25_0.05_60)]",
  8: "bg-[oklch(0.78_0.13_60)] text-white",
  16: "bg-[oklch(0.73_0.16_55)] text-white",
  32: "bg-[oklch(0.7_0.18_45)] text-white",
  64: "bg-[oklch(0.65_0.2_35)] text-white",
  128: "bg-[oklch(0.78_0.16_85)] text-[oklch(0.2_0.05_60)]",
  256: "bg-[oklch(0.8_0.17_85)] text-[oklch(0.2_0.05_60)]",
  512: "bg-[oklch(0.82_0.18_85)] text-[oklch(0.2_0.05_60)]",
  1024: "bg-[oklch(0.84_0.19_85)] text-[oklch(0.18_0.05_60)]",
  2048: "bg-[oklch(0.88_0.2_85)] text-[oklch(0.18_0.05_60)] ring-gold",
};

export function Game2048({ onExit }: { onExit: () => void }) {
  const saved = PuzzleStore.loadGame<Save>("2048");
  const [grid, setGrid] = useState<Grid>(() => saved?.grid ?? addTile(addTile(empty())));
  const [score, setScore] = useState(saved?.score ?? 0);
  const [best, setBest] = useState(saved?.best ?? 0);
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);
  const historyRef = useRef<{ grid: Grid; score: number }[]>([]);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    PuzzleStore.saveGame<Save>("2048", { grid, score, best });
  }, [grid, score, best]);

  function doMove(dir: "L" | "R" | "U" | "D") {
    if (done) return;
    const { grid: next, gained, moved } = move(grid, dir);
    if (!moved) return;
    historyRef.current.push({ grid: clone(grid), score });
    if (historyRef.current.length > 30) historyRef.current.shift();
    addTile(next);
    const ns = score + gained;
    setGrid(next); setScore(ns); setBest(Math.max(best, ns));
    Sfx.move();
    if (!won && hasTarget(next)) {
      setWon(true); Sfx.success();
      PuzzleStore.recordWin("2048", { xp: 250 });
    }
    if (!canMove(next)) { setDone(true); Sfx.fail(); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, "L"|"R"|"U"|"D"> = {
        ArrowLeft: "L", ArrowRight: "R", ArrowUp: "U", ArrowDown: "D",
        a: "L", d: "R", w: "U", s: "D",
      };
      const d = map[e.key]; if (d) { e.preventDefault(); doMove(d); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "R" : "L");
    else doMove(dy > 0 ? "D" : "U");
    touchRef.current = null;
  }

  function undo() {
    const prev = historyRef.current.pop(); if (!prev) return;
    setGrid(prev.grid); setScore(prev.score); setDone(false); Sfx.click();
  }
  function reset() {
    setGrid(addTile(addTile(empty()))); setScore(0); setDone(false); setWon(false);
    historyRef.current = []; Sfx.click();
  }

  const cellSize = useMemo(() => `min(76px, calc((100vw - 4rem) / ${SIZE}))`, []);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button onClick={onExit} className="glass tap-scale rounded-full px-4 py-2 text-sm">← Lounge</button>
        <h2 className="font-display text-2xl text-gold">2048</h2>
        <div className="w-20" />
      </header>

      <div className="glass rounded-2xl p-3 flex justify-around text-sm">
        <div className="text-center"><div className="text-[10px] uppercase opacity-60 tracking-widest">Score</div><div className="font-display text-lg text-gold">{score}</div></div>
        <div className="text-center"><div className="text-[10px] uppercase opacity-60 tracking-widest">Best</div><div className="font-display text-lg text-gold">{best}</div></div>
      </div>

      <div
        className="mx-auto rounded-3xl p-3 glass-strong"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {grid.flat().map((v, i) => (
            <div
              key={i}
              className={`rounded-2xl flex items-center justify-center font-display text-xl md:text-2xl tap-scale ${
                v === 0 ? "bg-white/5" : TILE_COLOR[v] ?? "bg-[oklch(0.4_0.1_60)] text-white"
              } ${v ? "animate-pop-in" : ""}`}
              style={{ width: cellSize, height: cellSize }}
            >
              {v || ""}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs opacity-60">Swipe or use arrow keys</p>

      <div className="flex justify-center gap-2">
        <button onClick={undo} className="glass tap-scale rounded-2xl px-3 py-2 flex items-center gap-2 text-sm"><Undo2 className="size-4" />Undo</button>
        <button onClick={reset} className="glass tap-scale rounded-2xl px-3 py-2 flex items-center gap-2 text-sm"><RotateCcw className="size-4" />New</button>
      </div>

      {(done || (won && score > 0)) && <CompletionOverlay
        title={won && !done ? "2048 reached" : "Game over"}
        onContinue={onExit}
        stats={[{ label: "Score", value: String(score) }, { label: "Best", value: String(best) }]}
      />}
    </div>
  );
}
