import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import packageJson from "../../../../package.json";
import { SettingsPage } from "@/components/settings/settings-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.settings" });
  return { title: t("title"), description: t("description") };
}

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
