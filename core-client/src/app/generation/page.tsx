import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { GenerationStudio } from "@/components/generation/generation-studio";

export const metadata: Metadata = {
  title: "Генерация изображений — Hermes",
  description: "Бесплатная локальная студия генерации изображений Hermes",
};

export default function GenerationPage() {
  return (
    <div className="generation-page">
      <AppHeader activePage="generation" />

      <main className="generation-main">
        <GenerationStudio />
      </main>
    </div>
  );
}
