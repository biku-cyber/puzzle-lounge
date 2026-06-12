import type { GameId } from "@/lib/puzzle/store";

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Master";
  xpReward: number;
  icon: string; // emoji symbol
  gradient: string;
  ready: boolean;
}

export const GAMES: GameMeta[] = [
  { id: "number",   name: "Number Puzzle", tagline: "Slide. Sequence. Solve.", difficulty: "Easy",   xpReward: 140, icon: "▦",  gradient: "from-[oklch(0.7_0.15_75)] to-[oklch(0.5_0.18_45)]", ready: true },
  { id: "2048",     name: "2048",          tagline: "Merge to greatness.",      difficulty: "Medium", xpReward: 250, icon: "▣",  gradient: "from-[oklch(0.78_0.16_80)] to-[oklch(0.55_0.18_40)]", ready: true },
  { id: "memory",   name: "Memory Match",  tagline: "Recall the pattern.",      difficulty: "Easy",   xpReward: 120, icon: "✦",  gradient: "from-[oklch(0.7_0.14_220)] to-[oklch(0.45_0.12_240)]", ready: true },
  { id: "color",    name: "Color Sort",    tagline: "Pour. Sort. Settle.",      difficulty: "Medium", xpReward: 160, icon: "❍",  gradient: "from-[oklch(0.74_0.16_150)] to-[oklch(0.45_0.13_165)]", ready: true },
  { id: "sudoku",   name: "Sudoku",        tagline: "Logic in nine.",           difficulty: "Hard",   xpReward: 300, icon: "九", gradient: "from-[oklch(0.72_0.14_305)] to-[oklch(0.42_0.16_300)]", ready: false },
  { id: "nonogram", name: "Nonogram",      tagline: "Paint by clue.",            difficulty: "Hard",   xpReward: 260, icon: "▤",  gradient: "from-[oklch(0.7_0.13_25)] to-[oklch(0.4_0.16_15)]",   ready: false },
  { id: "tangram",  name: "Tangram",       tagline: "Seven shapes, one form.",   difficulty: "Medium", xpReward: 180, icon: "◢",  gradient: "from-[oklch(0.72_0.15_60)] to-[oklch(0.45_0.18_30)]", ready: false },
  { id: "word",     name: "Word Connect",  tagline: "Link letters, find words.", difficulty: "Medium", xpReward: 200, icon: "A",  gradient: "from-[oklch(0.72_0.13_200)] to-[oklch(0.42_0.14_215)]", ready: false },
  { id: "maze",     name: "Zen Maze",      tagline: "Wander, find the way.",     difficulty: "Easy",   xpReward: 100, icon: "⌘",  gradient: "from-[oklch(0.74_0.12_170)] to-[oklch(0.42_0.13_185)]", ready: false },
];
