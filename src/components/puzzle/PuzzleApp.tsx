import { useEffect, useState } from "react";
import {
  Home, Grid3x3, Flame, Trophy, User, Menu, Bell, X,
  Sparkles, Palette, BarChart3, Settings as SettingsIcon, Info, ChevronRight,
} from "lucide-react";
import { PuzzleStore, usePuzzleState, levelFromXp, type GameId, type ThemeId } from "@/lib/puzzle/store";
import { Sfx } from "@/lib/puzzle/audio";
import { GAMES, type GameMeta } from "./games-meta";
import { Counter } from "./Counter";
import { PuzzleLogo } from "./PuzzleLogo";
import { NumberPuzzleGame } from "./games/NumberPuzzleGame";
import { Game2048 } from "./games/Game2048";
import { MemoryMatchGame } from "./games/MemoryMatchGame";
import { ColorSortGame } from "./games/ColorSortGame";
import { ComingSoonGame } from "./games/ComingSoonGame";

type Tab = "home" | "games" | "daily" | "achievements" | "profile";

const THEMES: { id: ThemeId; name: string; swatch: string; req: number }[] = [
  { id: "amber",    name: "Amber Gold",   swatch: "linear-gradient(135deg,oklch(0.88 0.16 85),oklch(0.7 0.17 55))", req: 0 },
  { id: "crystal",  name: "Crystal Glass",swatch: "linear-gradient(135deg,oklch(0.92 0.05 220),oklch(0.75 0.08 215))", req: 3 },
  { id: "midnight", name: "Midnight Blue",swatch: "linear-gradient(135deg,oklch(0.78 0.16 270),oklch(0.45 0.18 265))", req: 5 },
  { id: "emerald",  name: "Emerald",       swatch: "linear-gradient(135deg,oklch(0.82 0.16 150),oklch(0.5 0.16 155))", req: 7 },
  { id: "royal",    name: "Royal Purple",  swatch: "linear-gradient(135deg,oklch(0.82 0.18 310),oklch(0.5 0.2 305))", req: 10 },
  { id: "frost",    name: "Frost White",   swatch: "linear-gradient(135deg,oklch(0.96 0.01 240),oklch(0.82 0.04 235))", req: 14 },
];

export function PuzzleApp() {
  const state = usePuzzleState();
  const [tab, setTab] = useState<Tab>("home");
  const [drawer, setDrawer] = useState(false);
  const [dash, setDash] = useState(false);
  const [activeGame, setActiveGame] = useState<{ id: GameId; daily?: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Apply theme + a11y to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = state.theme;
    html.classList.toggle("reduce-motion", state.settings.reduceMotion);
    html.classList.toggle("dark", true);
  }, [state.theme, state.settings.reduceMotion]);

  // Achievement toast
  useEffect(() => {
    function onA(e: Event) {
      const d = (e as CustomEvent).detail as { name: string };
      setToast(`Achievement unlocked — ${d.name}`);
      Sfx.achievement();
      setTimeout(() => setToast(null), 3200);
    }
    window.addEventListener("puzzle:achievement", onA as EventListener);
    return () => window.removeEventListener("puzzle:achievement", onA as EventListener);
  }, []);

  // Auto-unlock themes by level
  useEffect(() => {
    const lvl = levelFromXp(state.xp).level;
    THEMES.forEach((t) => {
      if (lvl >= t.req && !state.unlockedThemes.includes(t.id)) {
        PuzzleStore.unlockTheme(t.id);
      }
    });
  }, [state.xp, state.unlockedThemes]);

  function launch(id: GameId, daily = false) {
    const meta = GAMES.find((g) => g.id === id);
    if (!meta?.ready && !["number","2048","memory","color"].includes(id)) {
      // still allow coming-soon to record a play
    }
    PuzzleStore.recordPlay(id);
    Sfx.click();
    setActiveGame({ id, daily });
  }

  if (activeGame) {
    return (
      <main className="min-h-dvh px-4 pt-6 pb-24 max-w-2xl mx-auto safe-top">
        {activeGame.id === "number" && <NumberPuzzleGame onExit={() => setActiveGame(null)} daily={activeGame.daily} />}
        {activeGame.id === "2048" && <Game2048 onExit={() => setActiveGame(null)} />}
        {activeGame.id === "memory" && <MemoryMatchGame onExit={() => setActiveGame(null)} />}
        {activeGame.id === "color" && <ColorSortGame onExit={() => setActiveGame(null)} />}
        {!["number","2048","memory","color"].includes(activeGame.id) && (
          <ComingSoonGame name={GAMES.find((g) => g.id === activeGame.id)!.name} onExit={() => setActiveGame(null)} />
        )}
      </main>
    );
  }

  const { level, into, need, pct } = levelFromXp(state.xp);

  return (
    <div className="min-h-dvh relative">
      {/* Top app bar */}
      <header className="safe-top sticky top-0 z-30 px-4 pt-3 pb-2">
        <div className="glass rounded-full px-3 py-2 flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => { setDrawer(true); Sfx.click(); }} aria-label="Menu" className="tap-scale p-2 rounded-full">
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <PuzzleLogo size={28} />
            <div className="leading-tight">
              <div className="font-display text-lg text-gold">Puzzle</div>
              <div className="text-[10px] opacity-60 -mt-0.5 uppercase tracking-widest">Lounge</div>
            </div>
          </div>
          <button onClick={() => { setTab("daily"); Sfx.click(); }} aria-label="Daily" className="tap-scale p-2 rounded-full relative">
            <Bell className="size-5" />
            {!state.daily.completed && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--gold)] animate-glow" />}
          </button>
          <button onClick={() => { setDash(true); Sfx.click(); }} aria-label="Profile" className="tap-scale p-1 rounded-full">
            <div className="size-9 rounded-full gold-gradient flex items-center justify-center font-display text-lg">
              {state.profile.avatar}
            </div>
          </button>
        </div>
      </header>

      <main className="px-4 pb-32 max-w-2xl mx-auto">
        {tab === "home" && <HomeTab onLaunch={launch} state={state} level={level} into={into} need={need} pct={pct} />}
        {tab === "games" && <GamesTab onLaunch={launch} />}
        {tab === "daily" && <DailyTab onLaunch={launch} />}
        {tab === "achievements" && <AchievementsTab />}
        {tab === "profile" && <ProfileTab onTheme={() => setDash(true)} />}
      </main>

      <BottomNav tab={tab} onChange={(t) => { setTab(t); Sfx.click(); }} />

      <Drawer open={drawer} onClose={() => setDrawer(false)} onNav={(t) => { setTab(t); setDrawer(false); }} />
      <Dashboard open={dash} onClose={() => setDash(false)} />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-full px-5 py-3 flex items-center gap-2 animate-float-up shimmer">
          <Sparkles className="size-4 text-gold" />
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Home ---------------- */

function HomeTab({ onLaunch, state, level, into, need, pct }: {
  onLaunch: (id: GameId) => void;
  state: ReturnType<typeof usePuzzleState>;
  level: number; into: number; need: number; pct: number;
}) {
  const last = state.lastGame;
  const lastMeta = last ? GAMES.find((g) => g.id === last.id) : null;
  const featured = GAMES.find((g) => g.ready)!;
  const stats = Object.values(state.stats);
  const totalPlayed = stats.reduce((n, s) => n + s.played, 0);
  const totalWins = stats.reduce((n, s) => n + s.wins, 0);
  const bestMs = stats.reduce<number | null>((b, s) => s.bestTimeMs == null ? b : b == null ? s.bestTimeMs : Math.min(b, s.bestTimeMs), null);

  return (
    <div className="space-y-6 pt-2">
      {/* Hero */}
      <section className="relative glass-strong rounded-3xl overflow-hidden p-6 animate-float-up">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full gold-gradient opacity-30 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <PuzzleLogo size={56} />
          <div className="flex-1">
            <h1 className="font-display text-3xl text-gold leading-none">Good to see you</h1>
            <p className="text-sm opacity-70 mt-1">{state.profile.name} · Level {level}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest opacity-60">Streak</div>
            <div className="font-display text-2xl text-gold flex items-center gap-1 justify-end">
              <Flame className="size-5" />{state.streak}
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-[10px] uppercase tracking-widest opacity-60 mb-1">
            <span>XP</span><span>{into} / {need}</span>
          </div>
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full gold-gradient transition-all duration-700" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      </section>

      {/* Continue / Featured */}
      <section className="grid sm:grid-cols-2 gap-3">
        {lastMeta ? (
          <button onClick={() => onLaunch(lastMeta.id)} className={`relative tap-scale text-left glass-strong rounded-3xl p-5 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${lastMeta.gradient} opacity-20`} />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-widest opacity-70">Continue</div>
              <div className="font-display text-2xl text-gold mt-1">{lastMeta.name}</div>
              <p className="text-xs opacity-70 mt-1">Resume where you left off.</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm">Play <ChevronRight className="size-4" /></div>
            </div>
          </button>
        ) : (
          <button onClick={() => onLaunch(featured.id)} className="relative tap-scale text-left glass-strong rounded-3xl p-5 overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${featured.gradient} opacity-20`} />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-widest opacity-70">Begin</div>
              <div className="font-display text-2xl text-gold mt-1">Start your first puzzle</div>
              <p className="text-xs opacity-70 mt-1">A gentle entry into the lounge.</p>
            </div>
          </button>
        )}
        <button onClick={() => onLaunch(featured.id)} className="relative tap-scale text-left glass-strong rounded-3xl p-5 overflow-hidden shimmer">
          <div className={`absolute inset-0 bg-gradient-to-br ${featured.gradient} opacity-25`} />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-widest opacity-70">Featured</div>
            <div className="font-display text-2xl text-gold mt-1">{featured.name}</div>
            <p className="text-xs opacity-70 mt-1">{featured.tagline}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm">Play <ChevronRight className="size-4" /></div>
          </div>
        </button>
      </section>

      {/* Games carousel */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="font-display text-xl">The Lounge</h2>
          <span className="text-xs opacity-60">{GAMES.length} games</span>
        </div>
        <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2" style={{ scrollbarWidth: "none" }}>
          {GAMES.map((g) => <GameCard key={g.id} meta={g} progress={state.stats[g.id].progress} onLaunch={onLaunch} />)}
        </div>
      </section>

      {/* Statistics preview */}
      <section className="glass rounded-3xl p-5">
        <h2 className="font-display text-xl mb-3">At a glance</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Played" value={<Counter value={totalPlayed} />} />
          <StatTile label="Wins" value={<Counter value={totalWins} />} />
          <StatTile label="XP" value={<Counter value={state.xp} />} />
          <StatTile label="Level" value={<Counter value={level} />} />
          <StatTile label="Streak" value={<Counter value={state.streak} />} />
          <StatTile label="Best" value={bestMs == null ? "—" : `${Math.floor(bestMs / 60000)}:${String(Math.floor((bestMs % 60000) / 1000)).padStart(2, "0")}`} />
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest opacity-60">{label}</div>
      <div className="font-display text-2xl text-gold mt-1">{value}</div>
    </div>
  );
}

function GameCard({ meta, progress, onLaunch }: { meta: GameMeta; progress: number; onLaunch: (id: GameId) => void }) {
  return (
    <button
      onClick={() => onLaunch(meta.id)}
      className="snap-start shrink-0 w-56 text-left tap-scale glass-strong rounded-3xl p-4 relative overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-25`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="size-12 rounded-2xl glass flex items-center justify-center font-display text-2xl text-gold">{meta.icon}</div>
          <span className="text-[10px] uppercase tracking-widest opacity-70">{meta.difficulty}</span>
        </div>
        <div className="mt-4">
          <div className="font-display text-lg text-gold leading-tight">{meta.name}</div>
          <div className="text-xs opacity-70">{meta.tagline}</div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[10px] opacity-60 mb-1">
            <span>{Math.round(progress * 100)}%</span>
            <span>+{meta.xpReward} XP</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full gold-gradient transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        {!meta.ready && (
          <div className="absolute top-2 right-2 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full glass">Soon</div>
        )}
      </div>
    </button>
  );
}

/* ---------------- Games tab ---------------- */
function GamesTab({ onLaunch }: { onLaunch: (id: GameId) => void }) {
  return (
    <div className="pt-2">
      <h1 className="font-display text-3xl text-gold mb-4">All games</h1>
      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((g) => (
          <button key={g.id} onClick={() => onLaunch(g.id)} className="relative tap-scale glass-strong rounded-3xl p-4 text-left overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${g.gradient} opacity-25`} />
            <div className="relative">
              <div className="size-12 rounded-2xl glass flex items-center justify-center font-display text-2xl text-gold">{g.icon}</div>
              <div className="font-display text-lg text-gold mt-3">{g.name}</div>
              <div className="text-xs opacity-70">{g.tagline}</div>
              <div className="text-[10px] mt-2 opacity-60 uppercase tracking-widest">{g.difficulty} · +{g.xpReward} XP</div>
              {!g.ready && <div className="absolute top-1 right-1 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full glass">Soon</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Daily ---------------- */
function DailyTab({ onLaunch }: { onLaunch: (id: GameId, daily?: boolean) => void }) {
  const state = usePuzzleState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
  const remain = Math.max(0, tomorrow.getTime() - now);
  const hh = String(Math.floor(remain / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((remain % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, "0");
  const pct = state.daily.completed ? 1 : 0;

  return (
    <div className="pt-2 space-y-4">
      <h1 className="font-display text-3xl text-gold">Daily challenge</h1>

      <div className="glass-strong rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full gold-gradient opacity-30 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <div className="relative size-24">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(1 0 0 / 0.1)" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--gold)" strokeWidth="2.5"
                strokeDasharray={`${pct * 100} 100`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-display text-xl text-gold">
              {Math.round(pct * 100)}%
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest opacity-70">Today's puzzle</div>
            <div className="font-display text-2xl text-gold">Number Puzzle 4×4</div>
            <div className="text-xs opacity-70 mt-1">Reward · +{state.daily.rewardXp} XP</div>
            <div className="text-xs opacity-60 mt-2">Resets in {hh}:{mm}:{ss}</div>
          </div>
        </div>
        <button
          onClick={() => onLaunch("number", true)}
          disabled={state.daily.completed}
          className="mt-5 w-full gold-gradient tap-scale rounded-full py-3 font-medium disabled:opacity-50"
        >
          {state.daily.completed ? "Completed today" : "Begin"}
        </button>
      </div>

      <div className="glass rounded-3xl p-5">
        <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Daily mission</div>
        <div className="font-display text-lg">Win one puzzle of any kind</div>
        <p className="text-xs opacity-60 mt-1">Streak: {state.streak} day{state.streak === 1 ? "" : "s"}</p>
      </div>
    </div>
  );
}

/* ---------------- Achievements ---------------- */
function AchievementsTab() {
  const state = usePuzzleState();
  const list = Object.values(state.achievements);
  return (
    <div className="pt-2 space-y-3">
      <h1 className="font-display text-3xl text-gold mb-1">Achievements</h1>
      <p className="text-sm opacity-70 mb-4">{list.filter((a) => a.unlockedAt).length} of {list.length} unlocked</p>
      <div className="space-y-2">
        {list.map((a) => {
          const unlocked = !!a.unlockedAt;
          return (
            <div key={a.id} className={`glass rounded-2xl p-4 flex items-center gap-4 ${unlocked ? "ring-gold" : ""}`}>
              <div className={`size-12 rounded-2xl flex items-center justify-center font-display text-xl ${unlocked ? "gold-gradient animate-glow" : "bg-white/5 opacity-40"}`}>
                <Trophy className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base text-gold">{a.name}</div>
                <div className="text-xs opacity-70 truncate">{a.desc}</div>
                {!unlocked && a.progress != null && a.progress > 0 && (
                  <div className="h-1 rounded-full bg-white/8 mt-2 overflow-hidden">
                    <div className="h-full gold-gradient" style={{ width: `${(a.progress ?? 0) * 100}%` }} />
                  </div>
                )}
              </div>
              <div className="text-xs opacity-70">+{a.xp} XP</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Profile ---------------- */
function ProfileTab({ onTheme }: { onTheme: () => void }) {
  const state = usePuzzleState();
  const { level, pct } = levelFromXp(state.xp);
  const [name, setName] = useState(state.profile.name);
  const [avatar, setAvatar] = useState(state.profile.avatar);
  return (
    <div className="pt-2 space-y-4">
      <h1 className="font-display text-3xl text-gold">Profile</h1>

      <div className="glass-strong rounded-3xl p-6 text-center">
        <div className="mx-auto size-20 rounded-full gold-gradient flex items-center justify-center font-display text-3xl animate-glow">{state.profile.avatar}</div>
        <div className="font-display text-2xl text-gold mt-3">{state.profile.name}</div>
        <div className="text-xs opacity-70">Level {level} · {state.xp} XP</div>
        <div className="h-2 rounded-full bg-white/10 mt-4 overflow-hidden">
          <div className="h-full gold-gradient" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      <div className="glass rounded-3xl p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-widest opacity-70">Edit profile</div>
        <input
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-[var(--gold)] transition-colors"
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={24}
        />
        <div className="flex gap-2 flex-wrap">
          {["✦","♛","◆","☾","✿","♞","✧","✪"].map((a) => (
            <button key={a} onClick={() => setAvatar(a)} className={`size-11 rounded-full text-xl flex items-center justify-center tap-scale ${avatar === a ? "gold-gradient" : "glass"}`}>{a}</button>
          ))}
        </div>
        <button onClick={() => { PuzzleStore.setProfile(name, avatar); Sfx.click(); }} className="w-full gold-gradient tap-scale rounded-full py-3 font-medium">
          Save
        </button>
      </div>

      <button onClick={onTheme} className="w-full glass tap-scale rounded-2xl p-4 flex items-center gap-3">
        <Palette className="size-5 text-gold" />
        <div className="flex-1 text-left">
          <div className="text-sm">Themes & settings</div>
          <div className="text-xs opacity-60">Open dashboard</div>
        </div>
        <ChevronRight className="size-4 opacity-60" />
      </button>
    </div>
  );
}

/* ---------------- Bottom nav ---------------- */
function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "home", icon: <Home className="size-5" />, label: "Home" },
    { id: "games", icon: <Grid3x3 className="size-5" />, label: "Games" },
    { id: "daily", icon: <Flame className="size-5" />, label: "Daily" },
    { id: "achievements", icon: <Trophy className="size-5" />, label: "Awards" },
    { id: "profile", icon: <User className="size-5" />, label: "Profile" },
  ];
  const idx = items.findIndex((i) => i.id === tab);
  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(560px,calc(100%-1.5rem))] safe-bottom">
      <div className="glass-strong rounded-full px-2 py-2 relative flex justify-between">
        <div
          className="absolute top-2 bottom-2 rounded-full gold-gradient transition-all duration-500"
          style={{ width: `calc((100% - 1rem) / ${items.length})`, left: `calc(0.5rem + ((100% - 1rem) / ${items.length}) * ${idx})` }}
        />
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={`relative z-10 flex-1 flex flex-col items-center py-2 tap-scale transition-colors ${tab === it.id ? "text-[var(--gold-foreground)]" : "opacity-70"}`}
            aria-label={it.label}
            aria-current={tab === it.id ? "page" : undefined}
          >
            {it.icon}
            <span className="text-[10px] mt-0.5">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ---------------- Drawer ---------------- */
function Drawer({ open, onClose, onNav }: { open: boolean; onClose: () => void; onNav: (t: Tab) => void }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-md transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[82%] max-w-xs glass-strong p-6 transition-transform duration-500 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ borderRadius: "0 28px 28px 0" }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <PuzzleLogo size={32} />
            <span className="font-display text-xl text-gold">Puzzle</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="tap-scale p-2 rounded-full glass"><X className="size-4" /></button>
        </div>
        <nav className="space-y-1">
          {[
            { t: "home" as Tab, icon: <Home className="size-4" />, label: "Home" },
            { t: "daily" as Tab, icon: <Flame className="size-4" />, label: "Daily Challenges" },
            { t: "achievements" as Tab, icon: <Trophy className="size-4" />, label: "Achievements" },
          ].map((i) => (
            <button key={i.label} onClick={() => onNav(i.t)} className="w-full tap-scale glass rounded-2xl px-4 py-3 flex items-center gap-3 text-sm">
              {i.icon}{i.label}
            </button>
          ))}
          <button onClick={() => onNav("profile")} className="w-full tap-scale glass rounded-2xl px-4 py-3 flex items-center gap-3 text-sm">
            <Palette className="size-4" />Themes
          </button>
          <button onClick={() => onNav("profile")} className="w-full tap-scale glass rounded-2xl px-4 py-3 flex items-center gap-3 text-sm">
            <BarChart3 className="size-4" />Statistics
          </button>
          <button onClick={() => onNav("profile")} className="w-full tap-scale glass rounded-2xl px-4 py-3 flex items-center gap-3 text-sm">
            <SettingsIcon className="size-4" />Settings
          </button>
        </nav>
        <div className="absolute bottom-6 left-6 right-6 text-xs opacity-60 flex items-center gap-2">
          <Info className="size-3" />
          Puzzle Lounge · v1.0 · Crafted offline
        </div>
      </aside>
    </>
  );
}

/* ---------------- Dashboard (right) ---------------- */
function Dashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = usePuzzleState();
  const { level, into, need, pct } = levelFromXp(state.xp);
  const totalWins = Object.values(state.stats).reduce((n, s) => n + s.wins, 0);
  const totalPlayed = Object.values(state.stats).reduce((n, s) => n + s.played, 0);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-md transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-[88%] max-w-sm glass-strong p-6 overflow-y-auto transition-transform duration-500 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ borderRadius: "28px 0 0 28px" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl text-gold">Dashboard</h3>
          <button onClick={onClose} aria-label="Close" className="tap-scale p-2 rounded-full glass"><X className="size-4" /></button>
        </div>

        {/* Profile card */}
        <div className="glass rounded-3xl p-5 text-center mb-4">
          <div className="mx-auto size-16 rounded-full gold-gradient flex items-center justify-center font-display text-2xl">{state.profile.avatar}</div>
          <div className="font-display text-lg text-gold mt-2">{state.profile.name}</div>
          <div className="text-xs opacity-60">Level {level}</div>
          <div className="h-2 rounded-full bg-white/10 mt-3 overflow-hidden">
            <div className="h-full gold-gradient transition-all duration-700" style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="text-[10px] opacity-60 mt-1">{into} / {need} XP</div>
        </div>

        {/* Stats */}
        <h4 className="font-display text-sm opacity-80 mb-2">Statistics</h4>
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatTile label="Played" value={<Counter value={totalPlayed} />} />
          <StatTile label="Wins" value={<Counter value={totalWins} />} />
          <StatTile label="Streak" value={<Counter value={state.streak} />} />
        </div>

        {/* SVG sparkline of wins per game */}
        <div className="glass rounded-2xl p-4 mb-5">
          <div className="text-[10px] uppercase tracking-widest opacity-60 mb-2">Wins by game</div>
          <WinsChart stats={state.stats} />
        </div>

        {/* Themes */}
        <h4 className="font-display text-sm opacity-80 mb-2">Themes</h4>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {THEMES.map((t) => {
            const unlocked = state.unlockedThemes.includes(t.id);
            const active = state.theme === t.id;
            return (
              <button
                key={t.id}
                disabled={!unlocked}
                onClick={() => { PuzzleStore.setTheme(t.id); Sfx.click(); }}
                className={`relative rounded-2xl p-2 tap-scale ${active ? "ring-gold" : ""} ${!unlocked ? "opacity-50" : ""}`}
                style={{ background: t.swatch, minHeight: 64 }}
              >
                <div className="text-[10px] text-white drop-shadow font-medium text-left">{t.name}</div>
                {!unlocked && <div className="absolute inset-0 flex items-center justify-center text-[10px] bg-black/40 rounded-2xl">Lv {t.req}</div>}
              </button>
            );
          })}
        </div>

        {/* Settings */}
        <h4 className="font-display text-sm opacity-80 mb-2">Settings</h4>
        <div className="space-y-2">
          <ToggleRow label="Sound" value={state.settings.sound} onChange={(v) => PuzzleStore.updateSettings({ sound: v })} />
          <ToggleRow label="Vibration" value={state.settings.vibration} onChange={(v) => PuzzleStore.updateSettings({ vibration: v })} />
          <ToggleRow label="Reduced motion" value={state.settings.reduceMotion} onChange={(v) => PuzzleStore.updateSettings({ reduceMotion: v })} />
          <ToggleRow label="High contrast" value={state.settings.highContrast} onChange={(v) => PuzzleStore.updateSettings({ highContrast: v })} />
          <div className="glass rounded-2xl p-3">
            <div className="flex justify-between text-xs mb-2"><span>Volume</span><span className="opacity-60">{Math.round(state.settings.volume * 100)}%</span></div>
            <input type="range" min={0} max={1} step={0.05} value={state.settings.volume}
              onChange={(e) => PuzzleStore.updateSettings({ volume: Number(e.target.value) })}
              className="w-full accent-[var(--gold)]"
            />
          </div>
          <button
            onClick={() => { if (confirm("Reset all progress?")) PuzzleStore.reset(); }}
            className="w-full glass tap-scale rounded-2xl px-4 py-3 text-sm text-[var(--destructive)] mt-2"
          >
            Reset all progress
          </button>
        </div>
      </aside>
    </>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full glass tap-scale rounded-2xl px-4 py-3 flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`relative inline-block w-10 h-6 rounded-full transition-colors ${value ? "gold-gradient" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${value ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function WinsChart({ stats }: { stats: Record<GameId, { wins: number }> }) {
  const entries = GAMES.map((g) => ({ g, wins: stats[g.id]?.wins ?? 0 }));
  const max = Math.max(1, ...entries.map((e) => e.wins));
  return (
    <svg viewBox="0 0 200 60" className="w-full h-16">
      {entries.map((e, i) => {
        const w = 200 / entries.length;
        const h = (e.wins / max) * 50;
        return (
          <g key={e.g.id}>
            <rect x={i * w + 2} y={56 - h} width={w - 4} height={h} rx={3}
              fill="var(--gold)" opacity={0.4 + (e.wins / max) * 0.6} />
          </g>
        );
      })}
    </svg>
  );
}
