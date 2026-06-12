import { useEffect, useMemo, useRef, useState } from "react";
import { Sfx } from "@/lib/puzzle/audio";
import { PuzzleStore } from "@/lib/puzzle/store";
import { mulberry32, shuffle } from "@/lib/puzzle/rng";
import { Shuffle, Undo2, Lightbulb, Pause, Play, RotateCcw } from "lucide-react";
import { CompletionOverlay } from "./CompletionOverlay";

type Size = 3 | 4 | 5;
type Mode = "numbers" | "symbols" | "emoji";

interface Save {
  size: Size; mode: Mode; tiles: number[]; moves: number; elapsedMs: number;
}

const SYMBOL_SET = ["✦","✧","✩","✪","✫","✬","✭","✮","✯","✰","☆","★","✶","✷","✸","✹","✺","✻","✽","✾","❀","❁","❂","✿","◆","◇"];
const EMOJI_SET = ["🌙","☕","🪶","🕯️","📜","🔮","🎲","🪐","🍇","🍷","🌿","🪞","🗝️","🎼","🪄","🍯","🥃","🪟","🧭","⚜️","🪙","🎴","🪻","🌹","🫧","🪷"];

function glyphFor(mode: Mode, i: number): string {
  if (mode === "numbers") return String(i);
  if (mode === "symbols") return SYMBOL_SET[i - 1] ?? "✦";
  return EMOJI_SET[i - 1] ?? "✨";
}

function solvable(tiles: number[], size: number): boolean {
  let inv = 0;
  const flat = tiles.filter((x) => x !== 0);
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++)
      if (flat[i] > flat[j]) inv++;
  if (size % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = size - Math.floor(tiles.indexOf(0) / size);
  return (inv + blankRowFromBottom) % 2 === 0;
}

function genTiles(size: Size, seed?: number): number[] {
  const total = size * size;
  const rng = seed != null ? mulberry32(seed) : Math.random;
  let tiles: number[];
  do {
    const base = Array.from({ length: total - 1 }, (_, i) => i + 1).concat(0);
    tiles = shuffle(base, rng);
  } while (!solvable(tiles, size) || isSolved(tiles));
  return tiles;
}

function isSolved(tiles: number[]): boolean {
  for (let i = 0; i < tiles.length - 1; i++) if (tiles[i] !== i + 1) return false;
  return tiles[tiles.length - 1] === 0;
}

export function NumberPuzzleGame({ onExit, daily }: { onExit: () => void; daily?: boolean }) {
  const saved = !daily ? PuzzleStore.loadGame<Save>("number") : undefined;
  const [size, setSize] = useState<Size>(saved?.size ?? 4);
  const [mode, setMode] = useState<Mode>(saved?.mode ?? "numbers");
  const [tiles, setTiles] = useState<number[]>(() =>
    saved?.tiles ?? genTiles(saved?.size ?? 4, daily ? PuzzleStore.get().daily.seed : undefined),
  );
  const [moves, setMoves] = useState(saved?.moves ?? 0);
  const [elapsed, setElapsed] = useState(saved?.elapsedMs ?? 0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [hintIdx, setHintIdx] = useState<number | null>(null);
  const historyRef = useRef<number[][]>([]);
  const startRef = useRef<number>(Date.now() - (saved?.elapsedMs ?? 0));

  // Timer
  useEffect(() => {
    if (paused || done) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [paused, done]);

  // Autosave (skip for daily so users don't resume into the daily mode unintentionally)
  useEffect(() => {
    if (done || daily) return;
    PuzzleStore.saveGame<Save>("number", { size, mode, tiles, moves, elapsedMs: elapsed });
  }, [tiles, moves, elapsed, size, mode, done, daily]);

  function tryMove(idx: number) {
    if (done || paused) return;
    const blank = tiles.indexOf(0);
    const r1 = Math.floor(idx / size), c1 = idx % size;
    const r2 = Math.floor(blank / size), c2 = blank % size;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    const next = tiles.slice();
    next[blank] = next[idx]; next[idx] = 0;
    historyRef.current.push(tiles);
    if (historyRef.current.length > 50) historyRef.current.shift();
    setTiles(next);
    setMoves((m) => m + 1);
    Sfx.move();
    setHintIdx(null);
    if (isSolved(next)) {
      Sfx.success();
      setDone(true);
      const t = Date.now() - startRef.current;
      PuzzleStore.recordWin("number", { timeMs: t, moves: moves + 1, xp: 100 + size * 20, isDaily: daily });
    }
  }

  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setTiles(prev);
    setMoves((m) => Math.max(0, m - 1));
    Sfx.click();
  }

  function shuffleNew() {
    const t = genTiles(size);
    setTiles(t); setMoves(0); setElapsed(0); historyRef.current = [];
    startRef.current = Date.now(); setDone(false); setHintIdx(null);
    Sfx.click();
  }

  function hint() {
    // Highlight a tile already in its target position closest to blank
    const blank = tiles.indexOf(0);
    const neighbors = [blank - 1, blank + 1, blank - size, blank + size].filter(
      (i) => i >= 0 && i < tiles.length &&
        Math.abs((i % size) - (blank % size)) + Math.abs(Math.floor(i / size) - Math.floor(blank / size)) === 1,
    );
    // Pick neighbor whose value would move closer to its target index
    let best = neighbors[0];
    let bestScore = Infinity;
    for (const n of neighbors) {
      const v = tiles[n];
      const target = v === 0 ? tiles.length - 1 : v - 1;
      const dCurr = Math.abs((n % size) - (target % size)) + Math.abs(Math.floor(n / size) - Math.floor(target / size));
      const dNext = Math.abs((blank % size) - (target % size)) + Math.abs(Math.floor(blank / size) - Math.floor(target / size));
      const score = dNext - dCurr;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    setHintIdx(best);
    Sfx.click();
    setTimeout(() => setHintIdx(null), 1400);
  }

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");

  const cellSize = useMemo(() => `min(72px, calc((100vw - 4rem) / ${size}))`, [size]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button onClick={onExit} className="glass tap-scale rounded-full px-4 py-2 text-sm">
          ← Lounge
        </button>
        <h2 className="font-display text-2xl text-gold">
          {daily ? "Daily " : ""}Number Puzzle
        </h2>
        <button onClick={() => setPaused((p) => !p)} className="glass tap-scale rounded-full p-2" aria-label="Pause">
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
      </header>

      <div className="glass rounded-2xl p-3 flex items-center justify-around text-sm">
        <Metric label="Time" value={`${mm}:${ss}`} />
        <Metric label="Moves" value={String(moves)} />
        <Metric label="Size" value={`${size}×${size}`} />
      </div>

      {!daily && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {([3, 4, 5] as Size[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSize(s); setTiles(genTiles(s)); setMoves(0); setElapsed(0); startRef.current = Date.now(); setDone(false); historyRef.current = []; }}
              className={`px-3 py-1.5 rounded-full text-xs tap-scale ${size === s ? "gold-gradient" : "glass"}`}
            >
              {s}×{s}
            </button>
          ))}
          <span className="mx-2 opacity-40">•</span>
          {(["numbers","symbols","emoji"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-xs tap-scale capitalize ${mode === m ? "gold-gradient" : "glass"}`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="relative mx-auto rounded-3xl p-3 glass-strong" style={{
        opacity: paused ? 0.25 : 1, transition: "opacity 0.3s",
      }}>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {tiles.map((v, i) => (
            <button
              key={i}
              onClick={() => tryMove(i)}
              disabled={v === 0}
              className={`
                relative rounded-2xl font-display text-2xl md:text-3xl
                flex items-center justify-center tap-scale
                ${v === 0 ? "opacity-0 pointer-events-none" : "glass"}
                ${hintIdx === i ? "ring-gold animate-glow" : ""}
              `}
              style={{ width: cellSize, height: cellSize }}
              aria-label={v === 0 ? "blank" : `tile ${v}`}
            >
              <span className={mode === "emoji" ? "text-2xl" : "text-gold"}>{glyphFor(mode, v)}</span>
            </button>
          ))}
        </div>
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center font-display text-3xl text-gold">
            Paused
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2">
        <ToolBtn onClick={undo} icon={<Undo2 className="size-4" />} label="Undo" />
        <ToolBtn onClick={hint} icon={<Lightbulb className="size-4" />} label="Hint" />
        <ToolBtn onClick={shuffleNew} icon={<Shuffle className="size-4" />} label="New" />
        <ToolBtn onClick={() => { setTiles(genTiles(size)); setMoves(0); setElapsed(0); startRef.current = Date.now(); setDone(false); }} icon={<RotateCcw className="size-4" />} label="Reset" />
      </div>

      {done && <CompletionOverlay onContinue={onExit} stats={[
        { label: "Time", value: `${mm}:${ss}` },
        { label: "Moves", value: String(moves) },
        { label: "XP", value: `+${100 + size * 20}${daily ? " +150" : ""}` },
      ]} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-widest opacity-60">{label}</div>
      <div className="font-display text-lg text-gold">{value}</div>
    </div>
  );
}

function ToolBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass tap-scale rounded-2xl px-3 py-2 flex items-center gap-2 text-sm">
      {icon}<span>{label}</span>
    </button>
  );
}
