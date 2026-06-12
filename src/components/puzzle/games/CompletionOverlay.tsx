import { useEffect, useState } from "react";

interface Stat { label: string; value: string }

export function CompletionOverlay({
  title = "Puzzle Solved",
  stats,
  onContinue,
}: { title?: string; stats: Stat[]; onContinue: () => void }) {
  const [counts, setCounts] = useState<string[]>(stats.map(() => "0"));

  useEffect(() => {
    // Animate count-up for numeric stats
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCounts(stats.map((s) => {
        const n = Number(String(s.value).replace(/[^0-9.]/g, ""));
        if (Number.isFinite(n) && n > 0) {
          const v = Math.round(n * eased);
          return String(s.value).replace(/[0-9]+/, String(v));
        }
        return p < 1 ? "…" : s.value;
      }));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stats]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/60 backdrop-blur-md animate-float-up">
      <div className="relative glass-strong rounded-3xl p-7 max-w-sm w-full text-center golden-sweep overflow-hidden">
        <svg viewBox="0 0 64 64" className="mx-auto mb-3 w-16 h-16">
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--gold)" strokeWidth="2" opacity="0.4" />
          <path
            d="M18 33 L29 44 L48 22"
            fill="none" stroke="var(--gold)" strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ strokeDasharray: 70, strokeDashoffset: 70, animation: "draw-check 0.8s 0.1s ease-out forwards" }}
          />
        </svg>
        <h3 className="font-display text-3xl text-gold mb-1">{title}</h3>
        <p className="text-sm opacity-70 mb-5">Beautifully done.</p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {stats.map((s, i) => (
            <div key={s.label} className="glass rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-widest opacity-60">{s.label}</div>
              <div className="font-display text-xl text-gold">{counts[i]}</div>
            </div>
          ))}
        </div>
        <button onClick={onContinue} className="gold-gradient tap-scale rounded-full px-6 py-3 font-medium w-full">
          Continue
        </button>
      </div>
    </div>
  );
}
