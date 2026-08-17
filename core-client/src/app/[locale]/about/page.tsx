import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AUTO_MODEL_ID, MODELS } from "@/config/models";
import {
  getModelCapabilityKey,
  getModelDescriptionKey,
} from "@/config/model-messages";

type AboutPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.about" });
  return { title: t("title"), description: t("description") };
}

const auditedModels = MODELS.filter((model) => model.id !== AUTO_MODEL_ID);

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  const common = await getTranslations({ locale, namespace: "Common" });
  const models = await getTranslations({ locale, namespace: "Models" });

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

        <article className="about-document-body">
          <p>{t("overview")}</p>

          <h2>{t("shortTitle")}</h2>
          <ul>
            <li>{t("short1")}</li>
            <li>{t("short2")}</li>
            <li>{t("short3")}</li>
            <li>{t("short4")}</li>
          </ul>

          <h2>{t("whatTitle")}</h2>
          <p>{t("what1")}</p>
          <p>{t("what2")}</p>

          <h2>{t("requestTitle")}</h2>
          <ol>
            <li>{t("request1")}</li>
            <li>{t("request2")}</li>
            <li>{t("request3")}</li>
            <li>{t("request4")}</li>
          </ol>

          <h2>{t("dataTitle")}</h2>
          <p>{t("data1")}</p>
          <p>
            {t("data2Before")} {" "}
            <a href="https://openrouter.ai/docs/guides/privacy/provider-logging" target="_blank" rel="noreferrer">
              {t("privacyLink")}
            </a>.
          </p>

          <h2>{t("autoTitle")}</h2>
          <p>{t("autoText")}</p>

          <h2>{t("modelsTitle")}</h2>
          <p>{t("modelsText")}</p>
          <ul aria-label={t("auditedModels")}>
            {auditedModels.map((model) => (
              <li key={model.id}>
                <strong>{model.title}</strong> — {models(`descriptions.${getModelDescriptionKey(model.id)}`)} {model.provider}, {models(getModelCapabilityKey(model)).toLocaleLowerCase(locale)},
                {" "}
                {model.license ? (
                  <a href={model.license.url} target="_blank" rel="noreferrer">
                    {model.license.name}
                  </a>
                ) : null}.
              </li>
            ))}
          </ul>

          <h2>{t("limitsTitle")}</h2>
          <p>{t("limitsText")}</p>

          <h2>{t("licensesTitle")}</h2>
          <p>{t("licensesText")}</p>

          <h2>{t("limitationsTitle")}</h2>
          <p>{t("limitationsText")}</p>

          <h2>{t("freshnessTitle")}</h2>
          <p>
            {t("freshnessBefore")} {" "}
            <time dateTime="2026-08-16">
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date("2026-08-16T00:00:00Z"))}
            </time>
            {t("freshnessAfter")} {" "}
            <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">
              {t("catalogLink")}
            </a>.
          </p>
        </article>
      </main>
    </div>
  );
}
