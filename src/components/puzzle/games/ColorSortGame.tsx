import { useEffect, useRef, useState } from "react";
import { Sfx } from "@/lib/puzzle/audio";
import { PuzzleStore } from "@/lib/puzzle/store";
import { shuffle } from "@/lib/puzzle/rng";
import { Undo2, RotateCcw } from "lucide-react";
import { CompletionOverlay } from "./CompletionOverlay";

const COLORS = [
  "oklch(0.7 0.18 30)",   // ruby
  "oklch(0.78 0.15 80)",  // amber
  "oklch(0.78 0.16 150)", // emerald
  "oklch(0.72 0.14 220)", // sapphire
  "oklch(0.7 0.18 305)",  // amethyst
  "oklch(0.85 0.04 80)",  // cream
];

const TUBE_H = 4; // capacity

function genTubes(colorCount: number, emptyCount: number): string[][] {
  const tubes: string[][] = [];
  for (let i = 0; i < colorCount; i++) {
    tubes.push(Array(TUBE_H).fill(COLORS[i]));
  }
  // Mix all liquid
  const flat = shuffle(tubes.flat());
  for (let i = 0; i < colorCount; i++) {
    tubes[i] = flat.slice(i * TUBE_H, (i + 1) * TUBE_H);
  }
  for (let i = 0; i < emptyCount; i++) tubes.push([]);
  return tubes;
}

function canPour(from: string[], to: string[]): boolean {
  if (from.length === 0) return false;
  if (to.length === TUBE_H) return false;
  if (to.length === 0) return true;
  return from[from.length - 1] === to[to.length - 1];
}

function isWin(tubes: string[][]): boolean {
  return tubes.every((t) => t.length === 0 || (t.length === TUBE_H && t.every((c) => c === t[0])));
}

interface Save { colors: number; empties: number; tubes: string[][]; moves: number; }

export function ColorSortGame({ onExit }: { onExit: () => void }) {
  const saved = PuzzleStore.loadGame<Save>("color");
  const [colors, setColors] = useState(saved?.colors ?? 5);
  const [empties, setEmpties] = useState(saved?.empties ?? 2);
  const [tubes, setTubes] = useState<string[][]>(() => saved?.tubes ?? genTubes(saved?.colors ?? 5, saved?.empties ?? 2));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(saved?.moves ?? 0);
  const [done, setDone] = useState(false);
  const historyRef = useRef<string[][][]>([]);

  useEffect(() => {
    if (done) return;
    PuzzleStore.saveGame<Save>("color", { colors, empties, tubes, moves });
  }, [tubes, moves, colors, empties, done]);

  function tap(i: number) {
    if (done) return;
    if (selected === null) {
      if (tubes[i].length === 0) return;
      setSelected(i); Sfx.click();
      return;
    }
    if (selected === i) { setSelected(null); Sfx.click(); return; }
    const from = tubes[selected], to = tubes[i];
    if (!canPour(from, to)) { setSelected(null); Sfx.fail(); return; }
    const next = tubes.map((t) => t.slice());
    const top = from[from.length - 1];
    while (next[selected].length > 0 && next[selected][next[selected].length - 1] === top && next[i].length < TUBE_H) {
      next[i].push(next[selected].pop()!);
    }
    historyRef.current.push(tubes.map((t) => t.slice()));
    if (historyRef.current.length > 30) historyRef.current.shift();
    setTubes(next); setSelected(null); setMoves((m) => m + 1); Sfx.move();
    if (isWin(next)) {
      Sfx.success(); setDone(true);
      PuzzleStore.recordWin("color", { moves: moves + 1, xp: 120 + colors * 10 });
    }
  }

  function undo() {
    const prev = historyRef.current.pop(); if (!prev) return;
    setTubes(prev); setMoves((m) => Math.max(0, m - 1)); setSelected(null); Sfx.click();
  }
  function reset(c = colors, e = empties) {
    setColors(c); setEmpties(e);
    setTubes(genTubes(c, e)); setMoves(0); setDone(false); setSelected(null);
    historyRef.current = [];
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button onClick={onExit} className="glass tap-scale rounded-full px-4 py-2 text-sm">← Lounge</button>
        <h2 className="font-display text-2xl text-gold">Color Sort</h2>
        <div className="w-20" />
      </header>

      <div className="glass rounded-2xl p-3 flex justify-around text-sm">
        <div className="text-center"><div className="text-[10px] uppercase opacity-60 tracking-widest">Moves</div><div className="font-display text-lg text-gold">{moves}</div></div>
        <div className="text-center"><div className="text-[10px] uppercase opacity-60 tracking-widest">Tubes</div><div className="font-display text-lg text-gold">{tubes.length}</div></div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {[4, 5, 6].map((c) => (
          <button key={c} onClick={() => reset(c, empties)} className={`px-3 py-1.5 rounded-full text-xs tap-scale ${c === colors ? "gold-gradient" : "glass"}`}>{c} colors</button>
        ))}
        {[1, 2, 3].map((e) => (
          <button key={e} onClick={() => reset(colors, e)} className={`px-3 py-1.5 rounded-full text-xs tap-scale ${e === empties ? "gold-gradient" : "glass"}`}>{e} empty</button>
        ))}
      </div>

      <div className="glass-strong rounded-3xl p-4 mx-auto">
        <div className="flex flex-wrap justify-center gap-3 max-w-md">
          {tubes.map((t, i) => (
            <button key={i} onClick={() => tap(i)}
              className={`relative tap-scale rounded-b-2xl rounded-t-md border-2 ${selected === i ? "border-[var(--gold)] -translate-y-2" : "border-white/15"} bg-white/5 flex flex-col-reverse overflow-hidden transition-transform`}
              style={{ width: 44, height: 160 }}>
              {t.map((c, j) => (
                <div key={j} style={{ background: c, height: `${100 / TUBE_H}%` }} className="w-full transition-all" />
              ))}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <button onClick={undo} className="glass tap-scale rounded-2xl px-3 py-2 flex items-center gap-2 text-sm"><Undo2 className="size-4" />Undo</button>
        <button onClick={() => reset()} className="glass tap-scale rounded-2xl px-3 py-2 flex items-center gap-2 text-sm"><RotateCcw className="size-4" />New</button>
      </div>

      {done && <CompletionOverlay onContinue={onExit} stats={[
        { label: "Moves", value: String(moves) },
        { label: "XP", value: `+${120 + colors * 10}` },
      ]} />}
    </div>
  );
}
