import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Исследовать — Hermes",
};

export default function ExplorePage() {
  return (
    <div className="explore-page">
      <AppHeader activePage="explore" />
      <main aria-label="Исследовать" />
    </div>
  );
}
