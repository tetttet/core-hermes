"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type SVGProps,
} from "react";
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
import { MODELS, getModelCapabilityLabel } from "@/config/models";
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

const tabs: Array<{ id: TabId; label: string; icon: IconComponent }> = [
  { id: "appearance", label: "Внешний вид", icon: SunIcon },
  { id: "data", label: "Данные", icon: DatabaseIcon },
  { id: "models", label: "Модели", icon: ModelsIcon },
  { id: "about", label: "О приложении", icon: InfoIcon },
];

const themes: Array<{
  id: ThemePreference;
  label: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    id: "system",
    label: "Системная",
    description: "Как на устройстве",
    icon: MonitorIcon,
  },
  {
    id: "light",
    label: "Светлая",
    description: "Всегда светлая",
    icon: SunIcon,
  },
  {
    id: "dark",
    label: "Тёмная",
    description: "Всегда тёмная",
    icon: MoonIcon,
  },
];

export function SettingsPage({ version, initialTab }: SettingsPageProps) {
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
          <Link href="/" className="settings-back" aria-label="Вернуться в чат">
            <ChevronLeftIcon className="size-5" />
          </Link>
          <div>
            <div className="settings-brand">Hermes</div>
            <div className="settings-breadcrumb">Настройки</div>
          </div>
        </header>

        <div className="settings-layout">
          <nav className="settings-tabs" aria-label="Разделы настроек">
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
                  <span>{tab.label}</span>
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
  return (
    <>
      <SettingsTitle
        title="Внешний вид"
        description="Настройте оформление Hermes под себя. Изменения сохраняются только на этом устройстве."
      />
      <section className="settings-section settings-preference-row">
        <div className="settings-preference-copy">
          <h2>Цветовая схема</h2>
          <p>Выберите светлое, тёмное или системное оформление.</p>
        </div>
        <div className="theme-options" role="group" aria-label="Цветовая схема">
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
                title={option.description}
                onClick={() => saveThemePreference(option.id)}
              >
                <Icon className="theme-option-icon" />
                <span>{option.label}</span>
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

function formatStorageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) {
    const kilobytes = bytes / 1024;
    return `${kilobytes.toLocaleString("ru", {
      maximumFractionDigits: kilobytes < 10 ? 1 : 0,
    })} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toLocaleString("ru", {
    maximumFractionDigits: 2,
  })} МБ`;
}

function DataSettings() {
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
      if (!didSave) throw new Error("Не удалось обновить локальную историю");
      setConfirming(null);
      setManagementStatus("Все чаты удалены");
    } catch (error) {
      setManagementStatus(
        error instanceof Error ? error.message : "Не удалось удалить все чаты",
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
        ? "Все созданные изображения удалены с устройства"
        : "Не удалось удалить изображения",
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
    setStatus(didSave ? "Все файлы удалены с устройства" : "Не удалось удалить файлы");
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
        ? `Файл «${item.attachment.name}» удалён с устройства`
        : "Не удалось удалить файл",
    );
  }

  return (
    <>
      <SettingsTitle
        title="Данные"
        description={
          auth.status === "authenticated"
            ? "Управляйте синхронизированными чатами и локальными изображениями с одного экрана."
            : "Чаты, вложения и генерации хранятся в этом браузере."
        }
      />

      <section className="settings-section settings-data-management">
        <div className="settings-storage-heading">
          <div>
            <h2>История и генерации</h2>
            <p>Удаляйте каждый тип данных отдельно.</p>
          </div>
        </div>

        <div className="settings-data-list">
          <article className="settings-data-row">
            <div className="settings-data-row-main">
              <span className="settings-data-icon"><ChatBubbleIcon className="size-[18px]" /></span>
              <div>
                <strong>Все чаты</strong>
                <p>
                  {auth.status === "authenticated"
                    ? `${store.chats.length} загружено · удаление со всех устройств`
                    : `${store.chats.length} на этом устройстве`}
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
              Удалить все чаты
            </button>
          </article>
          {confirming === "chats-all" ? (
            <div className="delete-confirm" role="alert">
              <div>
                <strong>Безвозвратно удалить все чаты?</strong>
                <p>
                  {auth.status === "authenticated"
                    ? "История исчезнет на всех устройствах."
                    : "История исчезнет из этого браузера."}
                </p>
              </div>
              <div className="delete-confirm-actions">
                <button type="button" className="settings-button" onClick={() => setConfirming(null)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="settings-button settings-button-danger"
                  disabled={deleting !== null}
                  onClick={() => void deleteAllChats()}
                >
                  {deleting === "chats" ? "Удаляем…" : "Удалить чаты"}
                </button>
              </div>
            </div>
          ) : null}

          <article className="settings-data-row">
            <div className="settings-data-row-main">
              <span className="settings-data-icon"><ImageIcon className="size-[18px]" /></span>
              <div>
                <strong>Созданные изображения</strong>
                <p>{generatedImages.length} · {formatStorageSize(generatedImagesSize)} · только localStorage</p>
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
              Удалить изображения
            </button>
          </article>
          {confirming === "images-all" ? (
            <div className="delete-confirm" role="alert">
              <div>
                <strong>Удалить все созданные изображения?</strong>
                <p>Скачайте нужные файлы заранее — восстановить их не получится.</p>
              </div>
              <div className="delete-confirm-actions">
                <button type="button" className="settings-button" onClick={() => setConfirming(null)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="settings-button settings-button-danger"
                  disabled={deleting !== null}
                  onClick={deleteAllGeneratedImages}
                >
                  Удалить изображения
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
          <span>Локальные данные</span>
          <strong>{formatStorageSize(totalSize + generatedImagesSize)}</strong>
        </div>
        <div className="settings-storage-counts">
          <span>Чатов: {store.chats.length}</span>
          <span>Генераций: {generatedImages.length}</span>
          <span>Файлов: {attachmentItems.length}</span>
          <span>В чатах: {chatCount}</span>
        </div>
        <p>Вложения и генерации остаются только в этом браузере.</p>
      </section>

      <section className="settings-section settings-storage-section">
        <div className="settings-storage-heading">
          <div>
            <h2>Файлы на этом устройстве</h2>
            <p>Сначала показаны самые большие.</p>
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
            Удалить все файлы
          </button>
        </div>

        {confirming === "attachments-all" ? (
          <div className="delete-confirm" role="alert">
            <div>
              <strong>Удалить все файлы с устройства?</strong>
              <p>Текстовые чаты останутся.</p>
            </div>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="settings-button"
                onClick={() => setConfirming(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="settings-button settings-button-danger"
                onClick={deleteAllAttachments}
              >
                Удалить всё
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
                      {attachment.kind === "image" ? "Изображение" : "Видео"} · {chatTitle}
                    </p>
                  </div>
                  <div className="settings-storage-item-actions">
                    <strong>{formatStorageSize(size)}</strong>
                    <button
                      type="button"
                      className="settings-storage-delete"
                      aria-label={`Удалить файл «${attachment.name}»`}
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
                      <strong>Удалить «{attachment.name}» с устройства?</strong>
                      <p>Текст чата останется.</p>
                    </div>
                    <div className="delete-confirm-actions">
                      <button
                        type="button"
                        className="settings-button"
                        onClick={() => setConfirming(null)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className="settings-button settings-button-danger"
                        onClick={() => deleteAttachment(key)}
                      >
                        Удалить файл
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="settings-storage-empty">
            <strong>Файлов на устройстве нет</strong>
            <p>Текстовые чаты не занимают этот раздел.</p>
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
        title="Модели"
        description="Выберите модель по умолчанию и сравните доступные варианты."
      />
      <section className="settings-section settings-preference-row">
        <div className="settings-preference-copy">
          <h2>Модель нового чата</h2>
          <p>Будет выбрана при создании следующего диалога.</p>
        </div>
        <select
          id="default-model"
          className="settings-select"
          aria-label="Модель нового чата"
          value={store.draftModelId}
          onChange={(event) => setDefaultModel(event.target.value)}
        >
          {MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.title} · {model.provider}
            </option>
          ))}
        </select>
      </section>

      <section className="settings-section model-catalog">
        <div className="settings-section-heading">
          <div>
            <h2>Доступные модели</h2>
            <p>Кратко о возможностях каждой модели.</p>
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
                    <h3>{model.title}</h3>
                    <span>{model.provider}</span>
                    {isSelected ? (
                      <span className="model-selected">По умолчанию</span>
                    ) : null}
                  </div>
                  <p>{model.description}</p>
                  <code>{model.id}</code>
                </div>
                <div className="model-badges">
                  <span className="model-capability">
                    {getModelCapabilityLabel(model)}
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
  return (
    <>
      <SettingsTitle
        title="О приложении"
        description="Информация о текущей сборке Hermes."
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
          <p>Локальный интерфейс для общения с моделями через OpenRouter.</p>
        </div>
      </div>
      <dl className="about-details">
        <div>
          <dt>Версия</dt>
          <dd>v{version}</dd>
        </div>
        <div>
          <dt>Подключено моделей</dt>
          <dd>{MODELS.length}</dd>
        </div>
        <div>
          <dt>Хранение истории</dt>
          <dd>Только на устройстве</dd>
        </div>
      </dl>
    </>
  );
}
