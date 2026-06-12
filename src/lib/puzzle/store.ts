// Shared profile / XP / level / achievements / stats / settings / themes / daily.
// Persisted in localStorage with a single namespaced key. Pure client module.

import { useSyncExternalStore } from "react";

export type ThemeId = "amber" | "crystal" | "midnight" | "emerald" | "royal" | "frost";
export type GameId =
  | "number"
  | "sudoku"
  | "nonogram"
  | "memory"
  | "2048"
  | "color"
  | "tangram"
  | "word"
  | "maze";

export interface GameStat {
  played: number;
  wins: number;
  bestTimeMs: number | null;
  totalTimeMs: number;
  bestMoves: number | null;
  progress: number; // 0..1
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  xp: number;
  unlockedAt?: number;
  progress?: number; // 0..1
}

export interface DailyState {
  date: string; // YYYY-MM-DD
  seed: number;
  completed: boolean;
  rewardXp: number;
}

export interface PuzzleState {
  version: 1;
  profile: {
    name: string;
    avatar: string; // emoji or initial
    createdAt: number;
  };
  xp: number;
  level: number;
  streak: number;
  lastPlayedDate: string | null;
  theme: ThemeId;
  unlockedThemes: ThemeId[];
  settings: {
    sound: boolean;
    vibration: boolean;
    volume: number;
    reduceMotion: boolean;
    highContrast: boolean;
  };
  stats: Record<GameId, GameStat>;
  achievements: Record<string, Achievement>;
  daily: DailyState;
  lastGame: { id: GameId; savedAt: number } | null;
  saves: Partial<Record<GameId, unknown>>;
}

const STORAGE_KEY = "puzzle.lounge.v1";

const ALL_GAMES: GameId[] = [
  "number", "sudoku", "nonogram", "memory", "2048", "color", "tangram", "word", "maze",
];

const emptyStat = (): GameStat => ({
  played: 0, wins: 0, bestTimeMs: null, totalTimeMs: 0, bestMoves: null, progress: 0,
});

const ACHIEVEMENTS_DEF: Omit<Achievement, "unlockedAt" | "progress">[] = [
  { id: "first_win", name: "First Victory", desc: "Win your first puzzle.", xp: 50 },
  { id: "fast_solver", name: "Fast Solver", desc: "Finish any puzzle under 60s.", xp: 120 },
  { id: "streak_3", name: "Daily Devotee", desc: "Maintain a 3-day streak.", xp: 100 },
  { id: "streak_7", name: "Week of Wisdom", desc: "Maintain a 7-day streak.", xp: 250 },
  { id: "sudoku_master", name: "Sudoku Master", desc: "Win 10 Sudoku games.", xp: 300 },
  { id: "memory_expert", name: "Memory Expert", desc: "Win 10 Memory games.", xp: 300 },
  { id: "puzzle_champion", name: "Puzzle Champion", desc: "Reach level 10.", xp: 500 },
  { id: "completionist", name: "Completionist", desc: "Play every game at least once.", xp: 400 },
  { id: "theme_collector", name: "Theme Collector", desc: "Unlock 4 themes.", xp: 200 },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dailySeed(iso: string): number {
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function defaultState(): PuzzleState {
  const stats = {} as Record<GameId, GameStat>;
  ALL_GAMES.forEach((g) => (stats[g] = emptyStat()));
  const achievements: Record<string, Achievement> = {};
  ACHIEVEMENTS_DEF.forEach((a) => (achievements[a.id] = { ...a, progress: 0 }));
  const iso = todayISO();
  return {
    version: 1,
    profile: { name: "Guest", avatar: "✦", createdAt: Date.now() },
    xp: 0,
    level: 1,
    streak: 0,
    lastPlayedDate: null,
    theme: "amber",
    unlockedThemes: ["amber"],
    settings: { sound: true, vibration: true, volume: 0.6, reduceMotion: false, highContrast: false },
    stats,
    achievements,
    daily: { date: iso, seed: dailySeed(iso), completed: false, rewardXp: 150 },
    lastGame: null,
    saves: {},
  };
}

export function levelFromXp(xp: number): { level: number; into: number; need: number; pct: number } {
  // Quadratic curve: need = 100 * level
  let level = 1, remaining = xp;
  while (remaining >= 100 * level) {
    remaining -= 100 * level;
    level++;
  }
  const need = 100 * level;
  return { level, into: remaining, need, pct: remaining / need };
}

let state: PuzzleState = defaultState();
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PuzzleState;
      if (parsed && parsed.version === 1) {
        // merge defaults for any missing keys (new games / achievements)
        const def = defaultState();
        state = {
          ...def,
          ...parsed,
          stats: { ...def.stats, ...parsed.stats },
          achievements: { ...def.achievements, ...parsed.achievements },
          settings: { ...def.settings, ...parsed.settings },
        };
      }
    }
    // Refresh daily if date changed
    const iso = todayISO();
    if (state.daily.date !== iso) {
      state.daily = { date: iso, seed: dailySeed(iso), completed: false, rewardXp: 150 };
    }
  } catch {
    /* corrupt — keep defaults */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): PuzzleState {
  load();
  return state;
}

export function usePuzzleState(): PuzzleState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function mutate(fn: (s: PuzzleState) => void) {
  load();
  const next = structuredClone(state);
  fn(next);
  state = next;
  persist();
  emit();
}

// ------- Actions -------

export const PuzzleStore = {
  get: () => { load(); return state; },

  setProfile(name: string, avatar?: string) {
    mutate((s) => {
      s.profile.name = name.slice(0, 24) || "Guest";
      if (avatar) s.profile.avatar = avatar.slice(0, 2);
    });
  },

  setTheme(theme: ThemeId) {
    mutate((s) => {
      if (!s.unlockedThemes.includes(theme)) return;
      s.theme = theme;
    });
  },

  unlockTheme(theme: ThemeId) {
    mutate((s) => {
      if (!s.unlockedThemes.includes(theme)) s.unlockedThemes.push(theme);
    });
    checkAchievements();
  },

  updateSettings(patch: Partial<PuzzleState["settings"]>) {
    mutate((s) => Object.assign(s.settings, patch));
  },

  saveGame<T>(id: GameId, data: T | null) {
    mutate((s) => {
      if (data == null) delete s.saves[id];
      else s.saves[id] = data;
      s.lastGame = { id, savedAt: Date.now() };
    });
  },

  loadGame<T>(id: GameId): T | undefined {
    load();
    return state.saves[id] as T | undefined;
  },

  recordWin(
    id: GameId,
    opts: { timeMs?: number; moves?: number; xp?: number; isDaily?: boolean } = {},
  ) {
    const { timeMs, moves, xp = 80, isDaily } = opts;
    mutate((s) => {
      const stat = s.stats[id];
      stat.played++;
      stat.wins++;
      stat.progress = Math.min(1, stat.progress + 0.1);
      if (timeMs != null) {
        stat.totalTimeMs += timeMs;
        if (stat.bestTimeMs == null || timeMs < stat.bestTimeMs) stat.bestTimeMs = timeMs;
      }
      if (moves != null) {
        if (stat.bestMoves == null || moves < stat.bestMoves) stat.bestMoves = moves;
      }
      s.xp += xp;
      const today = todayISO();
      if (s.lastPlayedDate !== today) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
        s.streak = s.lastPlayedDate === yISO ? s.streak + 1 : 1;
        s.lastPlayedDate = today;
      }
      if (isDaily && !s.daily.completed) {
        s.daily.completed = true;
        s.xp += s.daily.rewardXp;
      }
      s.level = levelFromXp(s.xp).level;
      delete s.saves[id];
    });
    checkAchievements({ lastWinTimeMs: timeMs });
  },

  recordPlay(id: GameId) {
    mutate((s) => { s.stats[id].played++; });
    checkAchievements();
  },

  reset() {
    state = defaultState();
    persist();
    emit();
  },
};

function checkAchievements(ctx: { lastWinTimeMs?: number } = {}) {
  mutate((s) => {
    const unlock = (id: string) => {
      const a = s.achievements[id];
      if (a && !a.unlockedAt) {
        a.unlockedAt = Date.now();
        a.progress = 1;
        s.xp += a.xp;
        try {
          window.dispatchEvent(new CustomEvent("puzzle:achievement", { detail: a }));
        } catch {/* */}
      }
    };
    const totalWins = Object.values(s.stats).reduce((n, x) => n + x.wins, 0);
    if (totalWins >= 1) unlock("first_win");
    if (ctx.lastWinTimeMs != null && ctx.lastWinTimeMs < 60_000) unlock("fast_solver");
    if (s.streak >= 3) unlock("streak_3");
    if (s.streak >= 7) unlock("streak_7");
    if (s.stats.sudoku.wins >= 10) unlock("sudoku_master");
    if (s.stats.memory.wins >= 10) unlock("memory_expert");
    if (levelFromXp(s.xp).level >= 10) unlock("puzzle_champion");
    if (ALL_GAMES.every((g) => s.stats[g].played > 0)) unlock("completionist");
    if (s.unlockedThemes.length >= 4) unlock("theme_collector");

    // Progress hints
    s.achievements.streak_7.progress = Math.min(1, s.streak / 7);
    s.achievements.sudoku_master.progress = Math.min(1, s.stats.sudoku.wins / 10);
    s.achievements.memory_expert.progress = Math.min(1, s.stats.memory.wins / 10);
    s.achievements.puzzle_champion.progress = Math.min(1, levelFromXp(s.xp).level / 10);

    s.level = levelFromXp(s.xp).level;
  });
}

export { ALL_GAMES, todayISO, dailySeed };
