import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HcodeCommand } from "@/components/hcode/hcode-command";
import { Link } from "@/i18n/navigation";

type HcodePageProps = { params: Promise<{ locale: string }> };

const INSTALL_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/tetttet/hcode/main/install.sh | sh";
const REPOSITORY_URL = "https://github.com/tetttet/hcode";
const RELEASES_URL = "https://github.com/tetttet/hcode/releases/latest";

export async function generateMetadata({
  params,
}: HcodePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.hcode" });
  return { title: t("title"), description: t("description") };
}

export default async function HcodePage({ params }: HcodePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Hcode" });
  const common = await getTranslations({ locale, namespace: "Common" });

  const copyProps = {
    copyLabel: t("copy"),
    copiedLabel: t("copied"),
    errorLabel: t("copyError"),
  };
  const tools = ["inspect", "read", "write", "run"] as const;
  const commands = [
    { command: "/help", key: "help" },
    { command: "/clear", key: "clear" },
    { command: "/version", key: "version" },
    { command: "/update", key: "update" },
    { command: "/change", key: "change" },
    { command: "/reset-key", key: "resetKey" },
    { command: "/exit", key: "exit" },
    { command: "hcode --version · hcode -v", key: "versionFlag" },
    { command: "hcode --update", key: "updateFlag" },
  ] as const;
  const troubleshooting = ["notFound", "key", "network", "unsupported"] as const;

  return (
    <div className="about-document-page">
      <header className="about-document-header">
        <Link href="/">Hermes</Link>
        <Link href="/">{common("chat")}</Link>
      </header>

      <main className="about-document-main hcode-document-main">
        <header className="about-document-intro hcode-document-intro">
          <div className="hcode-eyebrow">
            <span>{t("eyebrow")}</span>
            <span aria-label={t("currentVersion")}>v0.1.2</span>
          </div>
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
          <div className="hcode-hero-links">
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {t("repository")}
              <span aria-hidden="true">↗</span>
            </a>
            <a href={RELEASES_URL} target="_blank" rel="noreferrer">
              {t("latestRelease")}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        <article className="about-document-body help-document-body hcode-document-body">
          <p className="help-important hcode-important">
            <strong>{t("noticeTitle")}</strong> {t("noticeText")}
          </p>

          <nav className="hcode-contents" aria-label={t("contentsAria")}>
            <a href="#install">{t("contentsInstall")}</a>
            <a href="#first-run">{t("contentsFirstRun")}</a>
            <a href="#workflow">{t("contentsWorkflow")}</a>
            <a href="#commands">{t("contentsCommands")}</a>
            <a href="#configuration">{t("contentsConfiguration")}</a>
            <a href="#troubleshooting">{t("contentsTroubleshooting")}</a>
          </nav>

          <h2 id="install">{t("installTitle")}</h2>
          <p>{t("installIntro")}</p>
          <div className="hcode-platforms" aria-label={t("platformsAria")}>
            <span>macOS · Apple Silicon</span>
            <span>macOS · Intel</span>
            <span>Linux · ARM64</span>
            <span>Linux · x64</span>
          </div>

          <ol className="hcode-steps">
            <li>
              <strong>{t("installStep1Title")}</strong>
              <p>{t("installStep1Text")}</p>
            </li>
            <li>
              <strong>{t("installStep2Title")}</strong>
              <p>{t("installStep2Text")}</p>
              <HcodeCommand
                command={INSTALL_COMMAND}
                label={t("terminalLabel")}
                {...copyProps}
              />
            </li>
            <li>
              <strong>{t("installStep3Title")}</strong>
              <p>{t("installStep3Text")}</p>
              <HcodeCommand
                command={"hcode --version"}
                label={t("terminalLabel")}
                {...copyProps}
              />
            </li>
          </ol>

          <div className="hcode-note">
            <strong>{t("installerTitle")}</strong>
            <p>{t("installerText")}</p>
          </div>

          <h2 id="first-run">{t("firstRunTitle")}</h2>
          <p>{t("firstRunIntro")}</p>
          <HcodeCommand
            command={"cd path/to/your-project\nhcode"}
            label={t("terminalLabel")}
            {...copyProps}
          />
          <ol>
            <li><strong>{t("firstStep1Title")}</strong> — {t("firstStep1Text")}</li>
            <li><strong>{t("firstStep2Title")}</strong> — {t("firstStep2Text")}</li>
            <li><strong>{t("firstStep3Title")}</strong> — {t("firstStep3Text")}</li>
          </ol>

          <div className="help-example hcode-example">
            <strong>{t("promptLabel")}</strong>
            <p>{t("promptExample")}</p>
          </div>

          <h2 id="workflow">{t("workflowTitle")}</h2>
          <p>{t("workflowIntro")}</p>
          <ol className="hcode-flow">
            <li><span>01</span><div><strong>{t("flow1Title")}</strong><p>{t("flow1Text")}</p></div></li>
            <li><span>02</span><div><strong>{t("flow2Title")}</strong><p>{t("flow2Text")}</p></div></li>
            <li><span>03</span><div><strong>{t("flow3Title")}</strong><p>{t("flow3Text")}</p></div></li>
            <li><span>04</span><div><strong>{t("flow4Title")}</strong><p>{t("flow4Text")}</p></div></li>
          </ol>

          <h2>{t("toolsTitle")}</h2>
          <p>{t("toolsIntro")}</p>
          <div className="hcode-tool-grid">
            {tools.map((tool, index) => (
              <section key={tool}>
                <span>0{index + 1}</span>
                <h3>{t(`${tool}Title`)}</h3>
                <p>{t(`${tool}Text`)}</p>
              </section>
            ))}
          </div>

          <p className="help-important hcode-permission-note">
            <strong>{t("permissionsTitle")}</strong> {t("permissionsText")}
          </p>

          <h2 id="commands">{t("commandsTitle")}</h2>
          <p>{t("commandsIntro")}</p>
          <dl className="hcode-reference-list">
            {commands.map(({ command, key }) => (
              <div key={command}>
                <dt><code>{command}</code></dt>
                <dd>{t(`command${key[0].toUpperCase()}${key.slice(1)}`)}</dd>
              </div>
            ))}
          </dl>

          <h2 id="configuration">{t("configurationTitle")}</h2>
          <p>{t("configurationIntro")}</p>
          <dl className="hcode-reference-list hcode-environment-list">
            <div>
              <dt><code>OPENROUTER_API_KEY</code></dt>
              <dd>{t("envKey")}</dd>
            </div>
            <div>
              <dt><code>OPENROUTER_MODEL</code></dt>
              <dd>{t("envModel")}</dd>
            </div>
            <div>
              <dt><code>HCODE_IMAGE_PROTOCOL</code></dt>
              <dd>{t("envImage")}</dd>
            </div>
            <div>
              <dt><code>NO_COLOR</code></dt>
              <dd>{t("envColor")}</dd>
            </div>
          </dl>
          <HcodeCommand
            command={'OPENROUTER_MODEL="provider/model-name" hcode'}
            label={t("modelExampleLabel")}
            {...copyProps}
          />

          <h2>{t("securityTitle")}</h2>
          <p>{t("securityIntro")}</p>
          <ul>
            <li>{t("security1")}</li>
            <li>{t("security2")}</li>
            <li>{t("security3")}</li>
            <li>{t("security4")}</li>
          </ul>

          <h2>{t("updatesTitle")}</h2>
          <p>{t("updatesText")}</p>
          <HcodeCommand
            command={"hcode --update"}
            label={t("terminalLabel")}
            {...copyProps}
          />
          <p className="hcode-freshness">
            {t("releaseCheckedBefore")} {" "}
            <time dateTime="2026-08-19">
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date("2026-08-19T00:00:00Z"),
              )}
            </time>
            {t("releaseCheckedAfter")}
          </p>

          <h2 id="troubleshooting">{t("troubleshootingTitle")}</h2>
          <p>{t("troubleshootingIntro")}</p>
          <dl className="hcode-troubleshooting">
            {troubleshooting.map((item) => (
              <div key={item}>
                <dt>{t(`${item}Title`)}</dt>
                <dd>{t(`${item}Text`)}</dd>
              </div>
            ))}
          </dl>

          <h2>{t("uninstallTitle")}</h2>
          <p>{t("uninstallText")}</p>
          <HcodeCommand
            command={"rm ~/.local/bin/hcode"}
            label={t("terminalLabel")}
            {...copyProps}
          />
          <p>{t("configRemovalText")}</p>

          <footer className="help-footer-card hcode-footer-card">
            <div>
              <h2>{t("footerTitle")}</h2>
              <p>{t("footerText")}</p>
            </div>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {t("openGitHub")}
            </a>
          </footer>
        </article>
      </main>
    </div>
  );
}
