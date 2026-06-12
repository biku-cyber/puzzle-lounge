import { useEffect, useMemo, useState } from "react";
import { Sfx } from "@/lib/puzzle/audio";
import { PuzzleStore } from "@/lib/puzzle/store";
import { shuffle } from "@/lib/puzzle/rng";
import { CompletionOverlay } from "./CompletionOverlay";

type Pairs = 6 | 8 | 12;
const SYMBOLS = ["🌙","☕","🪶","🕯️","📜","🔮","🎲","🪐","🍇","🍷","🌿","🪞","🗝️","🎼"];

interface Card { id: number; sym: string; flipped: boolean; matched: boolean; }

function makeDeck(pairs: Pairs): Card[] {
  const chosen = shuffle(SYMBOLS).slice(0, pairs);
  const deck = shuffle(chosen.concat(chosen)).map((sym, id) => ({ id, sym, flipped: false, matched: false }));
  return deck;
}

export function MemoryMatchGame({ onExit }: { onExit: () => void }) {
  const [pairs, setPairs] = useState<Pairs>(8);
  const [deck, setDeck] = useState<Card[]>(() => makeDeck(8));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [start, setStart] = useState(Date.now());

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed(Date.now() - start), 250);
    return () => clearInterval(id);
  }, [done, start]);

  function flip(idx: number) {
    if (done) return;
    if (deck[idx].matched || deck[idx].flipped) return;
    if (flipped.length === 2) return;
    Sfx.move();
    const d = deck.slice();
    d[idx] = { ...d[idx], flipped: true };
    const nextFlipped = [...flipped, idx];
    setDeck(d); setFlipped(nextFlipped);
    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextFlipped;
      if (d[a].sym === d[b].sym) {
        setTimeout(() => {
          const dd = d.slice();
          dd[a] = { ...dd[a], matched: true };
          dd[b] = { ...dd[b], matched: true };
          setDeck(dd); setFlipped([]);
          Sfx.click();
          if (dd.every((c) => c.matched)) {
            Sfx.success();
            setDone(true);
            const t = Date.now() - start;
            PuzzleStore.recordWin("memory", { timeMs: t, moves: moves + 1, xp: 80 + pairs * 10 });
          }
        }, 350);
      } else {
        setTimeout(() => {
          const dd = d.slice();
          dd[a] = { ...dd[a], flipped: false };
          dd[b] = { ...dd[b], flipped: false };
          setDeck(dd); setFlipped([]);
        }, 800);
      }
    }
  }

  function reset(p: Pairs = pairs) {
    setPairs(p);
    setDeck(makeDeck(p));
    setFlipped([]); setMoves(0); setElapsed(0); setStart(Date.now()); setDone(false);
  }

  const cols = pairs <= 6 ? 3 : pairs === 8 ? 4 : 4;
  const cellSize = useMemo(() => `min(72px, calc((100vw - 4rem) / ${cols}))`, [cols]);
  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button onClick={onExit} className="glass tap-scale rounded-full px-4 py-2 text-sm">← Lounge</button>
        <h2 className="font-display text-2xl text-gold">Memory Match</h2>
        <div className="w-20" />
      </header>

      <div className="glass rounded-2xl p-3 flex justify-around text-sm">
        <div className="text-center"><div className="text-[10px] uppercase opacity-60 tracking-widest">Time</div><div className="font-display text-lg text-gold">{mm}:{ss}</div></div>
        <div className="text-center"><div className="text-[10px] uppercase opacity-60 tracking-widest">Moves</div><div className="font-display text-lg text-gold">{moves}</div></div>
        <div className="text-center"><div className="text-[10px] uppercase opacity-60 tracking-widest">Pairs</div><div className="font-display text-lg text-gold">{pairs}</div></div>
      </div>

      <div className="flex justify-center gap-2">
        {([6, 8, 12] as Pairs[]).map((p) => (
          <button key={p} onClick={() => reset(p)} className={`px-3 py-1.5 rounded-full text-xs tap-scale ${p === pairs ? "gold-gradient" : "glass"}`}>{p} pairs</button>
        ))}
      </div>

      <div className="mx-auto rounded-3xl p-3 glass-strong">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {deck.map((c, i) => (
            <button
              key={c.id}
              onClick={() => flip(i)}
              className="relative tap-scale"
              style={{ width: cellSize, height: cellSize, perspective: "600px" }}
              aria-label={c.flipped || c.matched ? c.sym : "hidden card"}
            >
              <div className="absolute inset-0 transition-transform duration-500" style={{
                transformStyle: "preserve-3d",
                transform: c.flipped || c.matched ? "rotateY(180deg)" : "rotateY(0)",
              }}>
                <div className="absolute inset-0 rounded-2xl glass flex items-center justify-center" style={{ backfaceVisibility: "hidden" }}>
                  <span className="text-gold text-xl">✦</span>
                </div>
                <div className={`absolute inset-0 rounded-2xl flex items-center justify-center text-3xl ${c.matched ? "ring-gold gold-gradient" : "glass-strong"}`}
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  {c.sym}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {done && <CompletionOverlay onContinue={onExit} stats={[
        { label: "Time", value: `${mm}:${ss}` },
        { label: "Moves", value: String(moves) },
        { label: "XP", value: `+${80 + pairs * 10}` },
      ]} />}
    </div>
  );
}
