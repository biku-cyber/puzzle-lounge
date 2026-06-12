import { Sparkles } from "lucide-react";

export function ComingSoonGame({ name, onExit }: { name: string; onExit: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button onClick={onExit} className="glass tap-scale rounded-full px-4 py-2 text-sm">← Lounge</button>
        <h2 className="font-display text-2xl text-gold">{name}</h2>
        <div className="w-20" />
      </header>
      <div className="glass-strong rounded-3xl p-10 text-center mt-10">
        <div className="mx-auto w-16 h-16 rounded-full gold-gradient flex items-center justify-center mb-4 animate-glow">
          <Sparkles className="size-7" />
        </div>
        <h3 className="font-display text-2xl text-gold mb-2">Crafting in the atelier</h3>
        <p className="opacity-70 max-w-sm mx-auto text-sm">
          {name} is being polished to lounge standards. Your XP, profile and progress will carry across when it opens.
        </p>
      </div>
    </div>
  );
}
