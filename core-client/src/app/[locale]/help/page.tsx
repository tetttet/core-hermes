import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HelpFaq } from "@/components/help/help-faq";
import { Link } from "@/i18n/navigation";

type HelpPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: HelpPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.help" });
  return { title: t("title"), description: t("description") };
}

export default async function HelpPage({ params }: HelpPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Help" });
  const common = await getTranslations({ locale, namespace: "Common" });

  const promptTips = ["prompt1", "prompt2", "prompt3", "prompt4"] as const;
  const safetyTips = ["safety1", "safety2", "safety3"] as const;
  const questions = [
    { question: t("attachmentQuestion"), answer: t("attachmentAnswer") },
    { question: t("modelQuestion"), answer: t("modelAnswer") },
    { question: t("slowQuestion"), answer: t("slowAnswer") },
    { question: t("interruptedQuestion"), answer: t("interruptedAnswer") },
    { question: t("storageQuestion"), answer: t("storageAnswer") },
  ];

  return (
    <div className="about-document-page">
      <header className="about-document-header">
        <Link href="/">Hermes</Link>
        <Link href="/">{common("chat")}</Link>
      </header>

      <main className="about-document-main">
        <header className="about-document-intro">
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
        </header>

        <article className="about-document-body help-document-body">
          <p className="help-important">
            <strong>{t("noticeTitle")}</strong> {t("noticeText")}
          </p>

          <h2 id="start">{t("startTitle")}</h2>
          <p>{t("startIntro")}</p>
          <ol>
            <li><strong>{t("step1Title")}</strong> — {t("step1Text")}</li>
            <li><strong>{t("step2Title")}</strong> — {t("step2Text")}</li>
            <li><strong>{t("step3Title")}</strong> — {t("step3Text")}</li>
          </ol>

          <h2 id="better-answers">{t("promptTitle")}</h2>
          <p>{t("promptIntro")}</p>
          <ul>
            {promptTips.map((tip) => <li key={tip}>{t(tip)}</li>)}
          </ul>
          <div className="help-example">
            <strong>{t("exampleLabel")}</strong>
            <p>{t("exampleText")}</p>
          </div>

          <h2 id="features">{t("featuresTitle")}</h2>
          <p>{t("featuresIntro")}</p>
          <ul>
            <li><strong>{t("textFeatureTitle")}</strong> — {t("textFeatureText")}</li>
            <li><strong>{t("mediaFeatureTitle")}</strong> — {t("mediaFeatureText")}</li>
            <li><strong>{t("webFeatureTitle")}</strong> — {t("webFeatureText")}</li>
            <li>
              <strong>{t("imageFeatureTitle")}</strong> — {t("imageFeatureText")}{" "}
              <Link href="/generation">{t("openGeneration")}</Link>.
            </li>
          </ul>

          <h2 id="data">{t("dataTitle")}</h2>
          <p>{t("dataIntro")}</p>
          <p><strong>{t("guestKicker")} · {t("guestTitle")}</strong> — {t("guestText")}</p>
          <p><strong>{t("accountKicker")} · {t("accountTitle")}</strong> — {t("accountText")}</p>
          <p><strong>{t("filesTitle")}</strong> {t("filesText")}</p>
          <p>
            <Link href={{ pathname: "/settings", query: { tab: "data" } }}>
              {t("manageData")}
            </Link>.
          </p>

          <h2 id="troubleshooting">{t("troubleshootingTitle")}</h2>
          <p>{t("troubleshootingIntro")}</p>
          <HelpFaq items={questions} />

          <h2 id="safety">{t("safetyTitle")}</h2>
          <p>{t("safetyIntro")}</p>
          <ul>
            {safetyTips.map((tip) => <li key={tip}>{t(tip)}</li>)}
          </ul>

          <footer className="help-footer-card">
            <div>
              <h2>{t("stillTitle")}</h2>
              <p>{t("stillText")}</p>
            </div>
            <Link href="/">{t("openChat")}</Link>
          </footer>
        </article>
      </main>
    </div>
  );
}
