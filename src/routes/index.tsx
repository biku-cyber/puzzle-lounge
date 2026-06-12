import { createFileRoute } from "@tanstack/react-router";
import { PuzzleApp } from "@/components/puzzle/PuzzleApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Puzzle — A luxury offline puzzle lounge" },
      { name: "description", content: "Nine handcrafted puzzles in one calm, offline-ready lounge. Shared XP, achievements, daily challenges and themes." },
      { name: "theme-color", content: "#1a1410" },
      { property: "og:title", content: "Puzzle — Lounge" },
      { property: "og:description", content: "A premium offline puzzle lounge with shared XP, daily challenges and themes." },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "icon", href: "/icons/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  component: Index,
});

function Index() {
  return <PuzzleApp />;
}
