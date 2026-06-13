import { useEffect, useMemo, useRef, useState } from "react";
import { Sfx } from "@/lib/puzzle/audio";
import { PuzzleStore } from "@/lib/puzzle/store";
import { mulberry32, shuffle } from "@/lib/puzzle/rng";
import {
  Shuffle, Undo2, Lightbulb, Pause, Play, RotateCcw,
  ChevronLeft, ChevronRight, Hash, Lock, Eye,
} from "lucide-react";
import { CompletionOverlay } from "./CompletionOverlay";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type Size = 3 | 4 | 5 | 6 | 7 | 8;
type PuzzleType = "number" | "image";
type Mode = "classic" | "snake" | "spiral" | "upside";

const SIZES: { size: Size; locked?: boolean }[] = [
  { size: 3 }, { size: 4 }, { size: 5 }, { size: 6 }, { size: 7 }, { size: 8, locked: true },
];
const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "classic", label: "Classic",     desc: "Order 1 → N, blank at end." },
  { id: "snake",   label: "Snake",       desc: "Serpentine rows, alternating." },
  { id: "spiral",  label: "Spiral",      desc: "Wind from edge to centre." },
  { id: "upside",  label: "Upside Down", desc: "Reverse descending order." },
];

const IMAGES: { id: number; src: string; label: string }[] = [
  { id: 1, src: "/images/puzzle/img-1.svg", label: "Amber"   },
  { id: 2, src: "/images/puzzle/img-2.svg", label: "Azure"   },
  { id: 3, src: "/images/puzzle/img-3.svg", label: "Verdant" },
  { id: 4, src: "/images/puzzle/img-4.svg", label: "Plum"    },
  { id: 5, src: "/images/puzzle/img-5.svg", label: "Honey"   },
];

interface Save {
  size: Size; mode: Mode; type: PuzzleType; imageId: number;
  tiles: number[]; moves: number; elapsedMs: number;
}

/* -------------------------------------------------------------------------- */
/* Target arrangements per mode                                                */
/* -------------------------------------------------------------------------- */
// target[i] = the tile value that should occupy position i when solved (0 = blank)
function buildTarget(size: Size, mode: Mode): number[] {
  const N = size * size;
  switch (mode) {
    case "classic": {
      const t = Array.from({ length: N - 1 }, (_, i) => i + 1);
      t.push(0); return t;
    }
    case "snake": {
      const t: number[] = new Array(N).fill(0);
      let v = 1;
      for (let r = 0; r < size; r++) {
        if (r % 2 === 0) for (let c = 0; c < size; c++) t[r * size + c] = v++;
        else for (let c = size - 1; c >= 0; c--) t[r * size + c] = v++;
      }
      // Place 0 at the very last filled cell (snake end)
      const endRow = size - 1;
      const endCol = endRow % 2 === 0 ? size - 1 : 0;
      t[endRow * size + endCol] = 0;
      // shift values 1..N-1 sequentially skipping that slot
      let val = 1;
      for (let r = 0; r < size; r++) {
        const cols = r % 2 === 0
          ? Array.from({ length: size }, (_, c) => c)
          : Array.from({ length: size }, (_, c) => size - 1 - c);
        for (const c of cols) {
          const idx = r * size + c;
          if (idx === endRow * size + endCol) continue;
          t[idx] = val++;
        }
      }
      return t;
    }
    case "spiral": {
      const t: number[] = new Array(N).fill(0);
      let v = 1, top = 0, bottom = size - 1, left = 0, right = size - 1;
      while (top <= bottom && left <= right) {
        for (let c = left; c <= right; c++) t[top * size + c] = v++;
        top++;
        for (let r = top; r <= bottom; r++) t[r * size + right] = v++;
        right--;
        if (top <= bottom) {
          for (let c = right; c >= left; c--) t[bottom * size + c] = v++;
          bottom--;
        }
        if (left <= right) {
          for (let r = bottom; r >= top; r--) t[r * size + left] = v++;
          left++;
        }
      }
      // Replace the last value with 0 (blank at spiral end)
      const lastIdx = t.indexOf(N);
      t[lastIdx] = 0;
      return t;
    }
    case "upside": {
      const t: number[] = [];
      for (let i = N - 1; i >= 1; i--) t.push(i);
      t.push(0);
      return t;
    }
  }
}

function isSolved(tiles: number[], target: number[]): boolean {
  for (let i = 0; i < tiles.length; i++) if (tiles[i] !== target[i]) return false;
  return true;
}

function solvable(tiles: number[], target: number[], size: number): boolean {
  // Map tile-values to their target index, then check inversion parity.
  const pos: Record<number, number> = {};
  target.forEach((v, i) => { pos[v] = i; });
  const seq = tiles.filter((v) => v !== 0).map((v) => pos[v]);
  let inv = 0;
  for (let i = 0; i < seq.length; i++)
    for (let j = i + 1; j < seq.length; j++)
      if (seq[i] > seq[j]) inv++;
  if (size % 2 === 1) return inv % 2 === 0;
  const blankIdx = tiles.indexOf(0);
  const blankTargetIdx = target.indexOf(0);
  const blankRowDiff = Math.abs(Math.floor(blankIdx / size) - Math.floor(blankTargetIdx / size));
  return (inv + blankRowDiff) % 2 === 0;
}

function genTiles(size: Size, target: number[], seed?: number): number[] {
  const rng = seed != null ? mulberry32(seed) : Math.random;
  let tiles: number[];
  do {
    tiles = shuffle(target, rng);
  } while (!solvable(tiles, target, size) || isSolved(tiles, target));
  return tiles;
}

/* -------------------------------------------------------------------------- */
/* Confetti                                                                    */
/* -------------------------------------------------------------------------- */
function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.6 + Math.random() * 1.4,
      rot: Math.random() * 360,
      hue: Math.random() < 0.5 ? 80 : Math.random() * 360,
      size: 6 + Math.random() * 8,
    })), [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-10%] rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size, height: p.size * 0.4,
            background: `oklch(0.8 0.18 ${p.hue})`,
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(.22,.71,.36,1) forwards`,
            opacity: 0.95,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings panel (pre-game) with live preview                                 */
/* -------------------------------------------------------------------------- */

interface Config { type: PuzzleType; size: Size; mode: Mode; imageId: number }

function Cycler({ label, value, onPrev, onNext, disabled }: {
  label: string; value: string; onPrev: () => void; onNext: () => void; disabled?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-2">
      <button
        onClick={onPrev} disabled={disabled}
        className="tap-scale glass-strong rounded-full p-2 disabled:opacity-30"
        aria-label={`Previous ${label}`}
      >
        <ChevronLeft className="size-4 text-gold" />
      </button>
      <div className="flex-1 text-center">
        <div className="text-[10px] uppercase tracking-widest opacity-60">{label}</div>
        <div className="font-display text-lg text-gold leading-tight">{value}</div>
      </div>
      <button
        onClick={onNext} disabled={disabled}
        className="tap-scale glass-strong rounded-full p-2 disabled:opacity-30"
        aria-label={`Next ${label}`}
      >
        <ChevronRight className="size-4 text-gold" />
      </button>
    </div>
  );
}

function PreviewBoard({ config }: { config: Config }) {
  const target = useMemo(() => buildTarget(config.size, config.mode), [config.size, config.mode]);
  const image = IMAGES.find((i) => i.id === config.imageId)!;
  const N = config.size;
  return (
    <div className="relative aspect-square w-full max-w-[260px] mx-auto rounded-2xl glass-strong p-2 overflow-hidden">
      <div className="grid h-full w-full gap-[3px]" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {target.map((v, i) => {
          if (v === 0) return <div key={i} className="rounded-md bg-black/30" />;
          if (config.type === "image") {
            const sliceIdx = i; // position in solved layout
            const r = Math.floor(sliceIdx / N), c = sliceIdx % N;
            const pct = 100 / (N - 1 || 1);
            return (
              <div
                key={i}
                className="rounded-md overflow-hidden ring-1 ring-white/10"
                style={{
                  backgroundImage: `url(${image.src})`,
                  backgroundSize: `${N * 100}% ${N * 100}%`,
                  backgroundPosition: `${c * pct}% ${r * pct}%`,
                }}
              />
            );
          }
          return (
            <div key={i} className="rounded-md glass flex items-center justify-center font-display text-gold"
                 style={{ fontSize: `clamp(8px, ${22 / N}vw, 16px)` }}>
              {v}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetupPanel({
  initial, onStart, onResume, hasSave,
}: { initial: Config; onStart: (c: Config) => void; onResume?: () => void; hasSave: boolean }) {
  const [config, setConfig] = useState<Config>(initial);

  const sizeIdx = SIZES.findIndex((s) => s.size === config.size);
  const modeIdx = MODES.findIndex((m) => m.id === config.mode);
  const imgIdx  = IMAGES.findIndex((i) => i.id === config.imageId);

  function cycle<T>(arr: T[], idx: number, dir: 1 | -1, pred: (x: T) => boolean = () => true): T {
    let next = idx;
    for (let k = 0; k < arr.length; k++) {
      next = (next + dir + arr.length) % arr.length;
      if (pred(arr[next])) return arr[next];
    }
    return arr[idx];
  }

  return (
    <div className="space-y-5 animate-float-up">
      <div className="text-center">
        <h2 className="font-display text-3xl text-gold">Compose your puzzle</h2>
        <p className="text-sm opacity-70 mt-1">Tune every detail. The board reflects your choices in real time.</p>
      </div>

      <PreviewBoard config={config} />

      <div className="space-y-2">
        <Cycler
          label="Puzzle type"
          value={config.type === "number" ? "Numbers" : "Image"}
          onPrev={() => { Sfx.click(); setConfig((c) => ({ ...c, type: c.type === "number" ? "image" : "number" })); }}
          onNext={() => { Sfx.click(); setConfig((c) => ({ ...c, type: c.type === "number" ? "image" : "number" })); }}
        />

        <div className="grid grid-cols-2 gap-2">
          <Cycler
            label="Mode"
            value={MODES[modeIdx].label}
            onPrev={() => { Sfx.click(); setConfig((c) => ({ ...c, mode: MODES[(modeIdx + MODES.length - 1) % MODES.length].id })); }}
            onNext={() => { Sfx.click(); setConfig((c) => ({ ...c, mode: MODES[(modeIdx + 1) % MODES.length].id })); }}
          />
          <Cycler
            label="Image"
            value={IMAGES[imgIdx].label}
            disabled={config.type !== "image"}
            onPrev={() => { Sfx.click(); setConfig((c) => ({ ...c, imageId: IMAGES[(imgIdx + IMAGES.length - 1) % IMAGES.length].id })); }}
            onNext={() => { Sfx.click(); setConfig((c) => ({ ...c, imageId: IMAGES[(imgIdx + 1) % IMAGES.length].id })); }}
          />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="text-[10px] uppercase tracking-widest opacity-60 text-center mb-2">Grid size</div>
          <div className="flex justify-center gap-1.5 flex-wrap">
            {SIZES.map(({ size, locked }) => {
              const active = size === config.size;
              return (
                <button
                  key={size}
                  disabled={locked}
                  onClick={() => { Sfx.click(); setConfig((c) => ({ ...c, size })); }}
                  className={`relative tap-scale rounded-xl px-3 py-2 text-xs font-medium min-w-[54px]
                    ${active ? "gold-gradient" : "glass-strong"} ${locked ? "opacity-50" : ""}`}
                >
                  {size}×{size}
                  {locked && <Lock className="absolute -top-1 -right-1 size-3 text-gold" />}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs opacity-60 text-center px-2">{MODES[modeIdx].desc}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 pt-2">
        {hasSave && onResume && (
          <button onClick={() => { Sfx.click(); onResume(); }}
            className="glass-strong tap-scale rounded-full py-3 font-medium flex items-center justify-center gap-2">
            <Play className="size-4 text-gold" /> Resume previous game
          </button>
        )}
        <button onClick={() => { Sfx.success(); onStart(config); }}
          className="gold-gradient tap-scale rounded-full py-4 font-semibold text-base shadow-lg">
          Begin puzzle
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Game board                                                                  */
/* -------------------------------------------------------------------------- */

interface BoardProps {
  config: Config;
  initialTiles?: number[];
  initialMoves?: number;
  initialElapsed?: number;
  onExit: () => void;
  daily?: boolean;
  onReconfigure: () => void;
}

function Board({ config, initialTiles, initialMoves = 0, initialElapsed = 0, onExit, daily, onReconfigure }: BoardProps) {
  const target = useMemo(() => buildTarget(config.size, config.mode), [config.size, config.mode]);
  const image = IMAGES.find((i) => i.id === config.imageId)!;
  const [tiles, setTiles] = useState<number[]>(() => initialTiles ?? genTiles(config.size, target, daily ? PuzzleStore.get().daily.seed : undefined));
  const [moves, setMoves] = useState(initialMoves);
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [hintIdx, setHintIdx] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const historyRef = useRef<number[][]>([]);
  const startRef = useRef<number>(Date.now() - initialElapsed);
  const boardRef = useRef<HTMLDivElement>(null);

  const N = config.size;

  useEffect(() => {
    if (paused || done) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [paused, done]);

  useEffect(() => {
    if (done || daily) return;
    PuzzleStore.saveGame<Save>("number", {
      size: config.size, mode: config.mode, type: config.type, imageId: config.imageId,
      tiles, moves, elapsedMs: elapsed,
    });
  }, [tiles, moves, elapsed, config, done, daily]);

  function slideTowardBlank(idx: number) {
    if (done || paused) return;
    const blank = tiles.indexOf(0);
    const r1 = Math.floor(idx / N), c1 = idx % N;
    const r2 = Math.floor(blank / N), c2 = blank % N;
    if (r1 !== r2 && c1 !== c2) return;
    if (idx === blank) return;
    const next = tiles.slice();
    let movedCount = 0;
    if (r1 === r2) {
      const dir = c1 < c2 ? 1 : -1;
      for (let c = c2; c !== c1; c -= dir) {
        next[r1 * N + c] = next[r1 * N + (c - dir)];
        movedCount++;
      }
      next[r1 * N + c1] = 0;
    } else {
      const dir = r1 < r2 ? 1 : -1;
      for (let r = r2; r !== r1; r -= dir) {
        next[r * N + c1] = next[(r - dir) * N + c1];
        movedCount++;
      }
      next[r1 * N + c1] = 0;
    }
    if (movedCount === 0) return;
    historyRef.current.push(tiles);
    if (historyRef.current.length > 80) historyRef.current.shift();
    setTiles(next);
    setMoves((m) => m + movedCount);
    Sfx.move();
    setHintIdx(null);
    if (isSolved(next, target)) handleWin(Date.now() - startRef.current, moves + movedCount);
  }

  function handleWin(timeMs: number, totalMoves: number) {
    Sfx.success();
    setDone(true);
    const xp = 80 + N * 25 + (config.type === "image" ? 40 : 0);
    PuzzleStore.recordWin("number", { timeMs, moves: totalMoves, xp, isDaily: daily });
  }

  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setTiles(prev);
    setMoves((m) => Math.max(0, m - 1));
    Sfx.click();
  }

  function shuffleNew() {
    setTiles(genTiles(config.size, target));
    setMoves(0); setElapsed(0); historyRef.current = [];
    startRef.current = Date.now(); setDone(false); setHintIdx(null);
    Sfx.click();
  }

  function hint() {
    // Find tile whose target position is the blank's current position
    const blank = tiles.indexOf(0);
    // First try a neighbor whose move reduces distance to its target
    const neighbors = [blank - 1, blank + 1, blank - N, blank + N].filter((i) => {
      if (i < 0 || i >= tiles.length) return false;
      return Math.abs((i % N) - (blank % N)) + Math.abs(Math.floor(i / N) - Math.floor(blank / N)) === 1;
    });
    let best = neighbors[0]; let bestScore = Infinity;
    for (const n of neighbors) {
      const v = tiles[n]; if (v === 0) continue;
      const targetIdx = target.indexOf(v);
      const dCurr = Math.abs((n % N) - (targetIdx % N)) + Math.abs(Math.floor(n / N) - Math.floor(targetIdx / N));
      const dNext = Math.abs((blank % N) - (targetIdx % N)) + Math.abs(Math.floor(blank / N) - Math.floor(targetIdx / N));
      const score = dNext - dCurr;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (best != null) {
      setHintIdx(best);
      Sfx.click();
      setTimeout(() => setHintIdx(null), 1500);
    }
  }

  // Swipe handling
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current; touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < 24) return;
    const blank = tiles.indexOf(0);
    const br = Math.floor(blank / N), bc = blank % N;
    let targetIdx = -1;
    if (adx > ady) targetIdx = dx > 0 ? br * N + 0 : br * N + (N - 1); // swipe right pushes left tiles right toward blank → tap leftmost in row
    else targetIdx = dy > 0 ? 0 * N + bc : (N - 1) * N + bc;
    // Actually: swipe direction = direction tiles should move. The "source" tile is the farthest one in that row/col from blank in the swipe direction.
    if (adx > ady) {
      // horizontal swipe
      targetIdx = dx > 0
        ? br * N + Math.max(0, bc - (N - 1)) // leftmost cell in row (will push everything right)
        : br * N + Math.min(N - 1, bc + (N - 1)); // rightmost
      // Simpler: target = cell that, when slid toward blank, moves in swipe direction.
      // If swipe right (dx>0), tiles move right → blank moves left → source is any cell to the LEFT of blank in same row.
      targetIdx = dx > 0
        ? br * N + (bc > 0 ? bc - 1 : -1)
        : br * N + (bc < N - 1 ? bc + 1 : -1);
    } else {
      targetIdx = dy > 0
        ? (br > 0 ? (br - 1) * N + bc : -1)
        : (br < N - 1 ? (br + 1) * N + bc : -1);
    }
    if (targetIdx >= 0) slideTowardBlank(targetIdx);
  }

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || paused) return;
      const blank = tiles.indexOf(0);
      const br = Math.floor(blank / N), bc = blank % N;
      let idx = -1;
      switch (e.key) {
        case "ArrowUp":    if (br < N - 1) idx = (br + 1) * N + bc; break;
        case "ArrowDown":  if (br > 0)     idx = (br - 1) * N + bc; break;
        case "ArrowLeft":  if (bc < N - 1) idx = br * N + (bc + 1); break;
        case "ArrowRight": if (bc > 0)     idx = br * N + (bc - 1); break;
        case " ":          setPaused((p) => !p); e.preventDefault(); return;
        case "z": case "Z": undo(); return;
      }
      if (idx >= 0) { slideTowardBlank(idx); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tiles, paused, done, N]);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");

  const fontScale = N <= 3 ? "text-3xl" : N <= 4 ? "text-2xl" : N <= 5 ? "text-xl" : N <= 6 ? "text-lg" : "text-base";

  return (
    <div className="flex flex-col gap-3">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button onClick={onExit} className="glass tap-scale rounded-full px-3 py-2 text-sm flex items-center gap-1">
          <ChevronLeft className="size-4" /> Lounge
        </button>
        <h2 className="font-display text-xl sm:text-2xl text-gold text-center truncate">
          {daily ? "Daily " : ""}{config.type === "image" ? "Image" : "Number"} · {MODES.find((m) => m.id === config.mode)!.label}
        </h2>
        <div className="flex gap-1">
          {config.type === "image" && (
            <button onClick={() => setShowPreview((s) => !s)} className="glass tap-scale rounded-full p-2" aria-label="Show image">
              <Eye className="size-4" />
            </button>
          )}
          <button onClick={() => setPaused((p) => !p)} className="glass tap-scale rounded-full p-2" aria-label="Pause">
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        </div>
      </header>

      <div className="glass rounded-2xl p-3 grid grid-cols-3 text-sm">
        <Metric label="Time" value={`${mm}:${ss}`} />
        <Metric label="Moves" value={String(moves)} />
        <Metric label="Grid" value={`${N}×${N}`} />
      </div>

      {showPreview && config.type === "image" && (
        <button onClick={() => setShowPreview(false)} className="glass-strong rounded-2xl p-2 mx-auto animate-float-up">
          <img src={image.src} alt={image.label} className="w-40 h-40 rounded-xl object-cover" />
          <div className="text-xs text-center mt-1 opacity-70">Tap to hide</div>
        </button>
      )}

      <div
        ref={boardRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative mx-auto rounded-3xl p-2 glass-strong w-full max-w-[min(92vw,460px)] aspect-square"
        style={{ opacity: paused ? 0.25 : 1, transition: "opacity 0.3s" }}
      >
        <div className="grid h-full w-full gap-[4px]" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
          {tiles.map((v, i) => {
            if (v === 0) return <div key={i} className="rounded-lg bg-black/30" />;
            const targetIdx = target.indexOf(v);
            const isAtHome = i === targetIdx;
            if (config.type === "image") {
              // slice index = solved position of this tile value
              const sliceRow = Math.floor(targetIdx / N);
              const sliceCol = targetIdx % N;
              const pct = 100 / (N - 1 || 1);
              return (
                <button
                  key={i}
                  onClick={() => slideTowardBlank(i)}
                  className={`relative rounded-lg overflow-hidden tap-scale ring-1
                    ${isAtHome ? "ring-[var(--gold)]/40" : "ring-white/10"}
                    ${hintIdx === i ? "animate-glow ring-gold" : ""}`}
                  style={{
                    backgroundImage: `url(${image.src})`,
                    backgroundSize: `${N * 100}% ${N * 100}%`,
                    backgroundPosition: `${sliceCol * pct}% ${sliceRow * pct}%`,
                  }}
                  aria-label={`tile ${v}`}
                />
              );
            }
            return (
              <button
                key={i}
                onClick={() => slideTowardBlank(i)}
                className={`relative rounded-lg font-display ${fontScale} flex items-center justify-center tap-scale glass
                  ${isAtHome ? "text-gold ring-1 ring-[var(--gold)]/30" : ""}
                  ${hintIdx === i ? "ring-gold animate-glow" : ""}`}
                aria-label={`tile ${v}`}
              >
                <span className="text-gold">{v}</span>
              </button>
            );
          })}
        </div>
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center font-display text-3xl text-gold backdrop-blur-sm rounded-3xl">
            Paused
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <ToolBtn onClick={undo} icon={<Undo2 className="size-4" />} label="Undo" />
        <ToolBtn onClick={hint} icon={<Lightbulb className="size-4" />} label="Hint" />
        <ToolBtn onClick={shuffleNew} icon={<Shuffle className="size-4" />} label="Shuffle" />
        <ToolBtn onClick={() => { shuffleNew(); }} icon={<RotateCcw className="size-4" />} label="Restart" />
        <ToolBtn onClick={onReconfigure} icon={<Hash className="size-4" />} label="Settings" />
      </div>

      {done && (
        <>
          <Confetti />
          <CompletionOverlay onContinue={onReconfigure} stats={[
            { label: "Time", value: `${mm}:${ss}` },
            { label: "Moves", value: String(moves) },
            { label: "XP", value: `+${80 + N * 25 + (config.type === "image" ? 40 : 0)}${daily ? " +150" : ""}` },
          ]} />
        </>
      )}
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

/* -------------------------------------------------------------------------- */
/* Wrapper: setup ↔ play                                                       */
/* -------------------------------------------------------------------------- */

export function NumberPuzzleGame({ onExit, daily }: { onExit: () => void; daily?: boolean }) {
  const saved = !daily ? PuzzleStore.loadGame<Save>("number") : undefined;
  const initial: Config = {
    type: saved?.type ?? "number",
    size: (saved?.size as Size) ?? 4,
    mode: saved?.mode ?? "classic",
    imageId: saved?.imageId ?? 1,
  };
  const [phase, setPhase] = useState<"setup" | "play">(daily ? "play" : "setup");
  const [config, setConfig] = useState<Config>(daily ? { type: "number", size: 4, mode: "classic", imageId: 1 } : initial);
  const [resumeData, setResumeData] = useState<Save | undefined>(undefined);

  return phase === "setup" ? (
    <SetupPanel
      initial={config}
      hasSave={!!saved && !daily}
      onResume={saved ? () => {
        setConfig({ type: saved.type, size: saved.size as Size, mode: saved.mode, imageId: saved.imageId });
        setResumeData(saved);
        setPhase("play");
      } : undefined}
      onStart={(c) => { setConfig(c); setResumeData(undefined); PuzzleStore.saveGame("number", null); setPhase("play"); }}
    />
  ) : (
    <Board
      key={`${config.type}-${config.size}-${config.mode}-${config.imageId}-${resumeData ? "r" : "n"}`}
      config={config}
      initialTiles={resumeData?.tiles}
      initialMoves={resumeData?.moves}
      initialElapsed={resumeData?.elapsedMs}
      onExit={onExit}
      daily={daily}
      onReconfigure={() => { setResumeData(undefined); setPhase("setup"); }}
    />
  );
}
