import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HcodeCommand } from "@/components/hcode/hcode-command";
import { HcodeContents } from "@/components/hcode/hcode-contents";
import { Link } from "@/i18n/navigation";

type HcodePageProps = { params: Promise<{ locale: string }> };

const VERSION = "v0.1.3";
const RELEASE_DATE = "2026-08-19";
const INSTALL_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/tetttet/hcode/main/install.sh | sh";
const REPOSITORY_URL = "https://github.com/tetttet/hcode";
const RELEASE_URL = "https://github.com/tetttet/hcode/releases/tag/v0.1.3";

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
  const releaseFeatures = [
    "releaseEditing",
    "releaseContext",
    "releaseSessions",
    "releasePermissions",
    "releaseAutomation",
    "releaseGithub",
  ] as const;
  const tools = ["map", "search", "read", "patch", "files", "run", "git", "plan"] as const;
  const interactiveCommands = [
    { command: "/model", key: "model" },
    { command: "/permissions", key: "permissions" },
    { command: "/context", key: "context" },
    { command: "/status", key: "status" },
    { command: "/usage", key: "usage" },
    { command: "/diff [path]", key: "diff" },
    { command: "/checkpoints", key: "checkpoints" },
    { command: "/undo", key: "undo" },
    { command: "/compact", key: "compact" },
    { command: "/doctor", key: "doctor" },
    { command: "/github", key: "github" },
    { command: "/resume", key: "resume" },
    { command: "/clear", key: "clear" },
    { command: "/version", key: "version" },
    { command: "/update", key: "update" },
    { command: "/change", key: "change" },
    { command: "/reset-key", key: "resetKey" },
    { command: "/help", key: "help" },
    { command: "/exit", key: "exit" },
  ] as const;
  const shellCommands = [
    { command: "hcode --continue · hcode -c", key: "continueFlag" },
    { command: 'hcode -p "task" · hcode --prompt "task"', key: "promptFlag" },
    { command: 'hcode --json -p "task"', key: "jsonFlag" },
    { command: "hcode --permission safe|edit|auto", key: "permissionFlag" },
    { command: "hcode doctor · hcode --doctor", key: "doctorFlag" },
    { command: "hcode --version · hcode -v", key: "versionFlag" },
    { command: "hcode --update", key: "updateFlag" },
    { command: "hcode --help · hcode -h", key: "helpFlag" },
  ] as const;
  const permissionModes = ["safe", "edit", "auto"] as const;
  const troubleshooting = ["notFound", "key", "network", "unsupported"] as const;
  const contents = [
    { href: "#release" as const, label: t("contentsRelease") },
    { href: "#install" as const, label: t("contentsInstall") },
    { href: "#workflow" as const, label: t("contentsWorkflow") },
    { href: "#configuration" as const, label: t("contentsConfiguration") },
    { href: "#sessions" as const, label: t("contentsSessions") },
    { href: "#github" as const, label: t("contentsGithub") },
    { href: "#commands" as const, label: t("contentsCommands") },
    { href: "#troubleshooting" as const, label: t("contentsTroubleshooting") },
  ];

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
            <span aria-label={t("currentVersion")}>{VERSION}</span>
          </div>
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
          <div className="hcode-hero-links">
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {t("repository")}
              <span aria-hidden="true">↗</span>
            </a>
            <a href={RELEASE_URL} target="_blank" rel="noreferrer">
              {t("releaseLink", { version: VERSION })}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        <div className="hcode-document-layout">
          <HcodeContents label={t("contentsAria")} items={contents} />

          <article className="about-document-body help-document-body hcode-document-body">
          <p className="help-important hcode-important">
            <strong>{t("noticeTitle")}</strong> {t("noticeText")}
          </p>

          <h2 id="release">{t("releaseTitle", { version: VERSION })}</h2>
          <p>{t("releaseIntro")}</p>
          <div className="hcode-tool-grid hcode-release-grid">
            {releaseFeatures.map((feature, index) => (
              <section key={feature}>
                <span>0{index + 1}</span>
                <h3>{t(`${feature}Title`)}</h3>
                <p>{t(`${feature}Text`)}</p>
              </section>
            ))}
          </div>
          <p className="hcode-freshness">
            {t("releasePublishedBefore")} {" "}
            <time dateTime={RELEASE_DATE}>
              {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
                new Date(`${RELEASE_DATE}T00:00:00Z`),
              )}
            </time>
            {t("releasePublishedAfter")}
          </p>

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
              <HcodeCommand command={INSTALL_COMMAND} label={t("terminalLabel")} {...copyProps} />
            </li>
            <li>
              <strong>{t("installStep3Title")}</strong>
              <p>{t("installStep3Text")}</p>
              <HcodeCommand command="hcode --version" label={t("terminalLabel")} {...copyProps} />
            </li>
          </ol>

          <div className="hcode-note">
            <strong>{t("installerTitle")}</strong>
            <p>{t("installerText")}</p>
          </div>

          <h2 id="first-run">{t("firstRunTitle")}</h2>
          <p>{t("firstRunIntro")}</p>
          <HcodeCommand
            command="cd path/to/your-project\nhcode"
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
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{t(`${tool}Title`)}</h3>
                <p>{t(`${tool}Text`)}</p>
              </section>
            ))}
          </div>

          <h2 id="configuration">{t("modelsTitle")}</h2>
          <p>{t("modelsIntro")}</p>
          <ol>
            <li><code>OPENROUTER_MODEL</code></li>
            <li>{t("modelsSaved")}</li>
            <li><code>openrouter/free</code></li>
          </ol>
          <HcodeCommand
            command={'OPENROUTER_MODEL="provider/model-name" hcode'}
            label={t("modelExampleLabel")}
            {...copyProps}
          />
          <p>{t("modelsChange")}</p>

          <h2>{t("permissionModesTitle")}</h2>
          <p>{t("permissionModesIntro")}</p>
          <div className="hcode-mode-grid">
            {permissionModes.map((mode) => (
              <section key={mode}>
                <span>{t(`${mode}Label`)}</span>
                <h3>{t(`${mode}Title`)}</h3>
                <p>{t(`${mode}Text`)}</p>
              </section>
            ))}
          </div>
          <p className="help-important hcode-permission-note">
            <strong>{t("permissionsTitle")}</strong> {t("permissionsText")}
          </p>

          <h2>{t("configurationTitle")}</h2>
          <p>{t("configurationIntro")}</p>
          <dl className="hcode-reference-list hcode-environment-list">
            <div><dt><code>OPENROUTER_API_KEY</code></dt><dd>{t("envKey")}</dd></div>
            <div><dt><code>OPENROUTER_MODEL</code></dt><dd>{t("envModel")}</dd></div>
            <div><dt><code>GITHUB_TOKEN</code></dt><dd>{t("envGithub")}</dd></div>
            <div><dt><code>HCODE_IMAGE_PROTOCOL</code></dt><dd>{t("envImage")}</dd></div>
            <div><dt><code>HCODE_DEBUG</code></dt><dd>{t("envDebug")}</dd></div>
            <div><dt><code>NO_COLOR</code></dt><dd>{t("envColor")}</dd></div>
          </dl>

          <h2 id="sessions">{t("sessionsTitle")}</h2>
          <p>{t("sessionsIntro")}</p>
          <HcodeCommand command="hcode --continue" label={t("terminalLabel")} {...copyProps} />
          <ul>
            <li>{t("session1")}</li>
            <li>{t("session2")}</li>
            <li>{t("session3")}</li>
            <li>{t("session4")}</li>
            <li>{t("session5")}</li>
          </ul>

          <h2 id="automation">{t("automationTitle")}</h2>
          <p>{t("automationIntro")}</p>
          <HcodeCommand
            command={'hcode -p "fix the failing tests"\nhcode --permission edit --prompt "update the parser"\nhcode --json -p "check this project"'}
            label={t("terminalLabel")}
            {...copyProps}
          />
          <p>{t("automationSafety")}</p>
          <dl className="hcode-reference-list">
            <div><dt><code>0</code></dt><dd>{t("exitCode0")}</dd></div>
            <div><dt><code>1</code></dt><dd>{t("exitCode1")}</dd></div>
            <div><dt><code>2</code></dt><dd>{t("exitCode2")}</dd></div>
            <div><dt><code>3</code></dt><dd>{t("exitCode3")}</dd></div>
          </dl>

          <h2 id="github">{t("githubTitle")}</h2>
          <p>{t("githubIntro")}</p>
          <HcodeCommand
            command={'export GITHUB_TOKEN="your_github_token"\nhcode'}
            label={t("terminalLabel")}
            {...copyProps}
          />
          <ul>
            <li>{t("github1")}</li>
            <li>{t("github2")}</li>
            <li>{t("github3")}</li>
            <li>{t("github4")}</li>
            <li>{t("github5")}</li>
          </ul>
          <div className="help-example hcode-example">
            <strong>{t("githubPromptLabel")}</strong>
            <p>{t("githubPromptExample")}</p>
          </div>

          <h2 id="commands">{t("commandsTitle")}</h2>
          <p>{t("commandsIntro")}</p>
          <h3 className="hcode-subheading">{t("interactiveCommandsTitle")}</h3>
          <dl className="hcode-reference-list">
            {interactiveCommands.map(({ command, key }) => (
              <div key={command}>
                <dt><code>{command}</code></dt>
                <dd>{t(`command${key[0].toUpperCase()}${key.slice(1)}`)}</dd>
              </div>
            ))}
          </dl>
          <h3 className="hcode-subheading">{t("shellCommandsTitle")}</h3>
          <dl className="hcode-reference-list">
            {shellCommands.map(({ command, key }) => (
              <div key={command}>
                <dt><code>{command}</code></dt>
                <dd>{t(`command${key[0].toUpperCase()}${key.slice(1)}`)}</dd>
              </div>
            ))}
          </dl>

          <h2>{t("privacyTitle")}</h2>
          <p>{t("privacyIntro")}</p>
          <ul>
            <li>{t("privacy1")}</li>
            <li>{t("privacy2")}</li>
            <li>{t("privacy3")}</li>
            <li>{t("privacy4")}</li>
            <li>{t("privacy5")}</li>
          </ul>
          <HcodeCommand
            command={"# .hcodeignore\ngenerated/\nfixtures/huge/\nprivate/\n*.log"}
            label=".hcodeignore"
            {...copyProps}
          />

          <h2>{t("updatesTitle")}</h2>
          <p>{t("updatesText")}</p>
          <HcodeCommand command="hcode --update" label={t("terminalLabel")} {...copyProps} />

          <h2>{t("developmentTitle")}</h2>
          <p>{t("developmentIntro")}</p>
          <HcodeCommand
            command={"bun install\nbun run dev\nbun test\nbunx tsc --noEmit\nbun run build"}
            label={t("terminalLabel")}
            {...copyProps}
          />

          <h2 id="troubleshooting">{t("troubleshootingTitle")}</h2>
          <p>{t("troubleshootingIntro")}</p>
          <HcodeCommand command="hcode doctor" label={t("diagnosticsLabel")} {...copyProps} />
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
          <HcodeCommand command="rm ~/.local/bin/hcode" label={t("terminalLabel")} {...copyProps} />
          <p>{t("configRemovalText")}</p>

          <footer className="help-footer-card hcode-footer-card">
            <div>
              <h2>{t("footerTitle")}</h2>
              <p>{t("footerText", { version: VERSION })}</p>
            </div>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {t("openGitHub")}
            </a>
          </footer>
          </article>
        </div>
      </main>
    </div>
  );
}
