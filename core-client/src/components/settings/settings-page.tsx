"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type SVGProps,
} from "react";
import { Link } from "@/i18n/navigation";
import {
  CheckIcon,
  ChatBubbleIcon,
  ChevronLeftIcon,
  DatabaseIcon,
  ImageIcon,
  InfoIcon,
  ModelsIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
} from "@/components/icons";
import { AUTO_MODEL_ID, MODELS } from "@/config/models";
import { getModelCapabilityKey, getModelDescriptionKey } from "@/config/model-messages";
import {
  getChatServerSnapshot,
  getChatSnapshot,
  saveChatStore,
  subscribeToChat,
} from "@/lib/chat-storage";
import { deleteAllRemoteChats } from "@/lib/core-api";
import {
  clearGeneratedImages,
  getGeneratedImagesServerSnapshot,
  getGeneratedImagesSnapshot,
  subscribeToGeneratedImages,
} from "@/lib/generated-image-storage";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
  subscribeToAuth,
} from "@/lib/auth-store";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  saveThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/theme";

type SettingsPageProps = {
  version: string;
  initialTab?: TabId;
};

type TabId = "appearance" | "data" | "models" | "about";
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const tabs: Array<{ id: TabId; labelKey: string; icon: IconComponent }> = [
  { id: "appearance", labelKey: "appearanceTab", icon: SunIcon },
  { id: "data", labelKey: "dataTab", icon: DatabaseIcon },
  { id: "models", labelKey: "modelsTab", icon: ModelsIcon },
  { id: "about", labelKey: "aboutTab", icon: InfoIcon },
];

const themes: Array<{
  id: ThemePreference;
  labelKey: string;
  descriptionKey: string;
  icon: IconComponent;
}> = [
  {
    id: "system",
    labelKey: "systemTheme",
    descriptionKey: "systemThemeDescription",
    icon: MonitorIcon,
  },
  {
    id: "light",
    labelKey: "lightTheme",
    descriptionKey: "lightThemeDescription",
    icon: SunIcon,
  },
  {
    id: "dark",
    labelKey: "darkTheme",
    descriptionKey: "darkThemeDescription",
    icon: MoonIcon,
  },
];

export function SettingsPage({ version, initialTab }: SettingsPageProps) {
  const t = useTranslations("Settings");
  const common = useTranslations("Common");
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "appearance");
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  return (
    <main className="settings-page">
      <div className="settings-container">
        <header className="settings-header">
          <Link href="/" className="settings-back" aria-label={common("backToChat")}>
            <ChevronLeftIcon className="size-5" />
          </Link>
          <div>
            <div className="settings-brand">Hermes</div>
            <div className="settings-breadcrumb">{t("title")}</div>
          </div>
        </header>

        <div className="settings-layout">
          <nav className="settings-tabs" aria-label={t("sectionsAria")}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className="settings-tab"
                  data-active={activeTab === tab.id}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="size-[18px]" />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </nav>

          <section className="settings-panel">
            {activeTab === "appearance" ? (
              <AppearanceSettings theme={theme} />
            ) : null}
            {activeTab === "data" ? <DataSettings /> : null}
            {activeTab === "models" ? <ModelSettings /> : null}
            {activeTab === "about" ? (
              <AboutSettings version={version} />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function SettingsTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="settings-title">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function AppearanceSettings({ theme }: { theme: ThemePreference }) {
  const t = useTranslations("Settings");
  return (
    <>
      <SettingsTitle
        title={t("appearanceTitle")}
        description={t("appearanceDescription")}
      />
      <section className="settings-section settings-preference-row">
        <div className="settings-preference-copy">
          <h2>{t("colorScheme")}</h2>
          <p>{t("colorSchemeDescription")}</p>
        </div>
        <div className="theme-options" role="group" aria-label={t("colorScheme")}>
          {themes.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className="theme-option"
                data-active={isActive}
                aria-pressed={isActive}
                title={t(option.descriptionKey)}
                onClick={() => saveThemePreference(option.id)}
              >
                <Icon className="theme-option-icon" />
                <span>{t(option.labelKey)}</span>
                {isActive ? <CheckIcon className="theme-check" /> : null}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function measureJsonBytes(value: unknown) {
  return new Blob([JSON.stringify(value)]).size;
}

function DataSettings() {
  const t = useTranslations("Settings");
  const common = useTranslations("Common");
  const locale = useLocale();
  const [confirming, setConfirming] = useState<
    "attachments-all" | "chats-all" | "images-all" | string | null
  >(null);
  const [deleting, setDeleting] = useState<"chats" | "images" | null>(null);
  const [managementStatus, setManagementStatus] = useState("");
  const [status, setStatus] = useState("");
  const auth = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
  const store = useSyncExternalStore(
    subscribeToChat,
    getChatSnapshot,
    getChatServerSnapshot,
  );
  const generatedImages = useSyncExternalStore(
    subscribeToGeneratedImages,
    getGeneratedImagesSnapshot,
    getGeneratedImagesServerSnapshot,
  );
  const attachmentItems = useMemo(
    () =>
      store.chats
        .flatMap((chat) =>
          chat.messages.flatMap((message) =>
            (message.attachments ?? []).map((attachment) => ({
              key: `${message.id}:${attachment.id}`,
              chatId: chat.id,
              chatTitle: chat.title,
              messageId: message.id,
              attachment,
              size: measureJsonBytes(attachment),
            })),
          ),
        )
        .sort((a, b) => b.size - a.size),
    [store.chats],
  );
  const totalSize = useMemo(
    () => attachmentItems.reduce((sum, item) => sum + item.size, 0),
    [attachmentItems],
  );
  const generatedImagesSize = useMemo(
    () => generatedImages.length > 0 ? measureJsonBytes(generatedImages) : 0,
    [generatedImages],
  );
  const chatCount = useMemo(
    () => new Set(attachmentItems.map((item) => item.chatId)).size,
    [attachmentItems],
  );

  function formatStorageSize(bytes: number) {
    if (bytes < 1024) return t("bytes", { count: bytes });
    if (bytes < 1024 * 1024) {
      const kilobytes = bytes / 1024;
      return t("kilobytes", {
        count: kilobytes.toLocaleString(locale, {
          maximumFractionDigits: kilobytes < 10 ? 1 : 0,
        }),
      });
    }

    return t("megabytes", {
      count: (bytes / (1024 * 1024)).toLocaleString(locale, {
        maximumFractionDigits: 2,
      }),
    });
  }

  useEffect(() => {
    void initializeAuth();
  }, []);

  async function deleteAllChats() {
    setDeleting("chats");
    setManagementStatus("");

    try {
      if (auth.status === "authenticated") {
        await deleteAllRemoteChats();
      }
      const didSave = saveChatStore({
        ...store,
        activeChatId: null,
        chats: [],
      });
      if (!didSave) throw new Error(t("localHistoryError"));
      setConfirming(null);
      setManagementStatus(t("allChatsDeleted"));
    } catch (error) {
      setManagementStatus(
        locale === "ru" && error instanceof Error
          ? error.message
          : t("deleteChatsError"),
      );
    } finally {
      setDeleting(null);
    }
  }

  function deleteAllGeneratedImages() {
    setDeleting("images");
    setManagementStatus("");
    const didClear = clearGeneratedImages();
    setConfirming(null);
    setDeleting(null);
    setManagementStatus(
      didClear
        ? t("allImagesDeleted")
        : t("deleteImagesError"),
    );
  }

  function deleteAllAttachments() {
    const didSave = saveChatStore({
      ...store,
      chats: store.chats.map((chat) => ({
        ...chat,
        messages: chat.messages.map((message) => {
          if (!message.attachments) return message;
          const nextMessage = { ...message };
          delete nextMessage.attachments;
          return nextMessage;
        }),
      })),
    });
    setConfirming(null);
    setStatus(didSave ? t("allFilesDeleted") : t("deleteFilesError"));
  }

  function deleteAttachment(targetKey: string) {
    const item = attachmentItems.find(({ key }) => key === targetKey);
    if (!item) return;

    const didSave = saveChatStore({
      ...store,
      chats: store.chats.map((chat) =>
        chat.id !== item.chatId
          ? chat
          : {
              ...chat,
              messages: chat.messages.map((message) => {
                if (message.id !== item.messageId || !message.attachments) {
                  return message;
                }
                const attachments = message.attachments.filter(
                  (attachment) => attachment.id !== item.attachment.id,
                );
                if (attachments.length) return { ...message, attachments };
                const nextMessage = { ...message };
                delete nextMessage.attachments;
                return nextMessage;
              }),
            },
      ),
    });

    setConfirming(null);
    setStatus(
      didSave
        ? t("fileDeleted", { name: item.attachment.name })
        : t("deleteFileError"),
    );
  }

  return (
    <>
      <SettingsTitle
        title={t("dataTitle")}
        description={
          auth.status === "authenticated"
            ? t("dataAuthenticatedDescription")
            : t("dataGuestDescription")
        }
      />

      <section className="settings-section settings-data-management">
        <div className="settings-storage-heading">
          <div>
            <h2>{t("historyTitle")}</h2>
            <p>{t("historyDescription")}</p>
          </div>
        </div>

        <div className="settings-data-list">
          <article className="settings-data-row">
            <div className="settings-data-row-main">
              <span className="settings-data-icon"><ChatBubbleIcon className="size-[18px]" /></span>
              <div>
                <strong>{t("allChats")}</strong>
                <p>
                  {auth.status === "authenticated"
                    ? t("syncedChatCount", { count: store.chats.length })
                    : t("localChatCount", { count: store.chats.length })}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="settings-button settings-button-danger-outline"
              disabled={
                deleting !== null ||
                auth.status === "loading" ||
                (auth.status !== "authenticated" && store.chats.length === 0)
              }
              onClick={() => {
                setManagementStatus("");
                setConfirming("chats-all");
              }}
            >
              <TrashIcon className="size-4" />
              {t("deleteAllChats")}
            </button>
          </article>
          {confirming === "chats-all" ? (
            <div className="delete-confirm" role="alert">
              <div>
                <strong>{t("confirmAllChats")}</strong>
                <p>
                  {auth.status === "authenticated"
                    ? t("syncedChatsWarning")
                    : t("localChatsWarning")}
                </p>
              </div>
              <div className="delete-confirm-actions">
                <button type="button" className="settings-button" onClick={() => setConfirming(null)}>
                  {common("cancel")}
                </button>
                <button
                  type="button"
                  className="settings-button settings-button-danger"
                  disabled={deleting !== null}
                  onClick={() => void deleteAllChats()}
                >
                  {deleting === "chats" ? t("deleting") : t("deleteChats")}
                </button>
              </div>
            </div>
          ) : null}

          <article className="settings-data-row">
            <div className="settings-data-row-main">
              <span className="settings-data-icon"><ImageIcon className="size-[18px]" /></span>
              <div>
                <strong>{t("generatedImages")}</strong>
                <p>{t("generatedImagesSummary", { count: generatedImages.length, size: formatStorageSize(generatedImagesSize) })}</p>
              </div>
            </div>
            <button
              type="button"
              className="settings-button settings-button-danger-outline"
              disabled={deleting !== null || generatedImages.length === 0}
              onClick={() => {
                setManagementStatus("");
                setConfirming("images-all");
              }}
            >
              <TrashIcon className="size-4" />
              {t("deleteImages")}
            </button>
          </article>
          {confirming === "images-all" ? (
            <div className="delete-confirm" role="alert">
              <div>
                <strong>{t("confirmImages")}</strong>
                <p>{t("imagesWarning")}</p>
              </div>
              <div className="delete-confirm-actions">
                <button type="button" className="settings-button" onClick={() => setConfirming(null)}>
                  {common("cancel")}
                </button>
                <button
                  type="button"
                  className="settings-button settings-button-danger"
                  disabled={deleting !== null}
                  onClick={deleteAllGeneratedImages}
                >
                  {t("deleteImages")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      <p className="settings-status settings-management-status" aria-live="polite">
        {managementStatus}
      </p>

      <section className="settings-section settings-storage-summary">
        <div className="settings-storage-total">
          <span>{t("localData")}</span>
          <strong>{formatStorageSize(totalSize + generatedImagesSize)}</strong>
        </div>
        <div className="settings-storage-counts">
          <span>{t("chatsCount", { count: store.chats.length })}</span>
          <span>{t("generationsCount", { count: generatedImages.length })}</span>
          <span>{t("filesCount", { count: attachmentItems.length })}</span>
          <span>{t("inChatsCount", { count: chatCount })}</span>
        </div>
        <p>{t("localOnly")}</p>
      </section>

      <section className="settings-section settings-storage-section">
        <div className="settings-storage-heading">
          <div>
            <h2>{t("filesTitle")}</h2>
            <p>{t("filesDescription")}</p>
          </div>
          <button
            type="button"
            className="settings-button settings-button-danger-outline"
            disabled={attachmentItems.length === 0}
            onClick={() => {
              setStatus("");
              setConfirming("attachments-all");
            }}
          >
            <TrashIcon className="size-4" />
            {t("deleteAllFiles")}
          </button>
        </div>

        {confirming === "attachments-all" ? (
          <div className="delete-confirm" role="alert">
            <div>
              <strong>{t("confirmAllFiles")}</strong>
              <p>{t("textChatsRemain")}</p>
            </div>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="settings-button"
                onClick={() => setConfirming(null)}
              >
                {common("cancel")}
              </button>
              <button
                type="button"
                className="settings-button settings-button-danger"
                onClick={deleteAllAttachments}
              >
                {t("deleteEverything")}
              </button>
            </div>
          </div>
        ) : null}

        {attachmentItems.length > 0 ? (
          <div className="settings-storage-list">
            {attachmentItems.map(({ key, chatTitle, attachment, size }) => (
              <article
                key={key}
                className="settings-storage-item"
                data-confirming={confirming === key}
              >
                <div className="settings-storage-item-main">
                  <div className="settings-storage-item-copy">
                    <h3>{attachment.name}</h3>
                    <p>
                      {attachment.kind === "image" ? t("image") : t("video")} · {chatTitle}
                    </p>
                  </div>
                  <div className="settings-storage-item-actions">
                    <strong>{formatStorageSize(size)}</strong>
                    <button
                      type="button"
                      className="settings-storage-delete"
                      aria-label={t("deleteNamedFileAria", { name: attachment.name })}
                      onClick={() => {
                        setStatus("");
                        setConfirming(key);
                      }}
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                </div>

                {confirming === key ? (
                  <div className="settings-storage-item-confirm" role="alert">
                    <div>
                      <strong>{t("confirmNamedFile", { name: attachment.name })}</strong>
                      <p>{t("textChatsRemain")}</p>
                    </div>
                    <div className="delete-confirm-actions">
                      <button
                        type="button"
                        className="settings-button"
                        onClick={() => setConfirming(null)}
                      >
                        {common("cancel")}
                      </button>
                      <button
                        type="button"
                        className="settings-button settings-button-danger"
                        onClick={() => deleteAttachment(key)}
                      >
                        {t("deleteFile")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="settings-storage-empty">
            <strong>{t("noFiles")}</strong>
            <p>{t("noFilesDescription")}</p>
          </div>
        )}

        <p className="settings-status" aria-live="polite">
          {status}
        </p>
      </section>
    </>
  );
}

function ModelSettings() {
  const t = useTranslations("Settings");
  const models = useTranslations("Models");
  const store = useSyncExternalStore(
    subscribeToChat,
    getChatSnapshot,
    getChatServerSnapshot,
  );

  function setDefaultModel(modelId: string) {
    saveChatStore({ ...store, draftModelId: modelId });
  }

  return (
    <>
      <SettingsTitle
        title={t("modelsTitle")}
        description={t("modelsDescription")}
      />
      <section className="settings-section settings-preference-row">
        <div className="settings-preference-copy">
          <h2>{t("newChatModel")}</h2>
          <p>{t("newChatModelDescription")}</p>
        </div>
        <select
          id="default-model"
          className="settings-select"
          aria-label={t("newChatModel")}
          value={store.draftModelId}
          onChange={(event) => setDefaultModel(event.target.value)}
        >
          {MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id === AUTO_MODEL_ID ? models("autoTitle") : model.title} · {model.provider}
            </option>
          ))}
        </select>
      </section>

      <section className="settings-section model-catalog">
        <div className="settings-section-heading">
          <div>
            <h2>{t("availableModels")}</h2>
            <p>{t("availableModelsDescription")}</p>
          </div>
          <span>{MODELS.length}</span>
        </div>
        <div className="model-list">
          {MODELS.map((model) => {
            const isSelected = store.draftModelId === model.id;
            return (
              <article
                className="model-card"
                data-selected={isSelected}
                key={model.id}
              >
                <div className="model-card-main">
                  <div className="model-card-title">
                    <h3>{model.id === AUTO_MODEL_ID ? models("autoTitle") : model.title}</h3>
                    <span>{model.provider}</span>
                    {isSelected ? (
                      <span className="model-selected">{t("default")}</span>
                    ) : null}
                  </div>
                  <p>{models(`descriptions.${getModelDescriptionKey(model.id)}`)}</p>
                  <code>{model.id}</code>
                </div>
                <div className="model-badges">
                  <span className="model-capability">
                    {models(getModelCapabilityKey(model))}
                  </span>
                  {model.isFree ? <span className="model-free">free</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function AboutSettings({ version }: { version: string }) {
  const t = useTranslations("Settings");
  return (
    <>
      <SettingsTitle
        title={t("aboutTitle")}
        description={t("aboutDescription")}
      />
      <div className="about-card">
        <div className="about-logo">
          <Image
            src="/yahya.svg"
            alt=""
            width={46}
            height={46}
            unoptimized
            className="about-logo-image"
          />
        </div>
        <div>
          <h2>Hermes</h2>
          <p>{t("aboutSummary")}</p>
        </div>
      </div>
      <dl className="about-details">
        <div>
          <dt>{t("version")}</dt>
          <dd>v{version}</dd>
        </div>
        <div>
          <dt>{t("connectedModels")}</dt>
          <dd>{MODELS.length}</dd>
        </div>
        <div>
          <dt>{t("historyStorage")}</dt>
          <dd>{t("deviceOnly")}</dd>
        </div>
      </dl>
    </>
  );
}
