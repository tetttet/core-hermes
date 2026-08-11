import type { Metadata } from "next";
import packageJson from "../../../package.json";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = {
  title: "Настройки · Hermes",
  description: "Настройки внешнего вида, данных и моделей Hermes",
};

export default async function SettingsRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;

  return (
    <SettingsPage
      version={packageJson.version}
      initialTab={tab === "data" ? "data" : undefined}
    />
  );
}
