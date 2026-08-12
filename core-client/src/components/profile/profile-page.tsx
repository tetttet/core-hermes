"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ChevronLeftIcon,
  DownloadIcon,
  ImageIcon,
  LogOutIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
} from "@/components/icons";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
  signOut,
  subscribeToAuth,
} from "@/lib/auth-store";
import {
  getGeneratedImagesServerSnapshot,
  getGeneratedImagesSnapshot,
  saveGeneratedImages,
  subscribeToGeneratedImages,
  type StoredGeneratedImage,
} from "@/lib/generated-image-storage";
import { IMAGE_MODELS } from "@/lib/image-generation";

type ProfileTab = "account" | "images";

function getImageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

function formatGeneratedAt(timestamp: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("account");
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const auth = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
  const generatedImages = useSyncExternalStore(
    subscribeToGeneratedImages,
    getGeneratedImagesSnapshot,
    getGeneratedImagesServerSnapshot,
  );

  useEffect(() => {
    void initializeAuth();
  }, []);

  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await signOut();
      router.replace("/");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Не удалось выйти");
      setLoggingOut(false);
    }
  }

  function downloadImage(image: StoredGeneratedImage) {
    const anchor = document.createElement("a");
    anchor.href = image.dataUrl;
    anchor.download = `hermes-${image.createdAt}.${getImageExtension(image.mimeType)}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function removeImage(imageId: string) {
    saveGeneratedImages(generatedImages.filter((image) => image.id !== imageId));
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link href="/" className="profile-back" aria-label="Вернуться в чат">
          <ChevronLeftIcon className="size-5" />
        </Link>
        <Link href="/" className="profile-brand">
          <Image src="/yahya.svg" alt="" width={28} height={28} unoptimized />
          <span>Hermes</span>
        </Link>
      </header>

      <section className="profile-content">
        <div className="profile-tabs" role="tablist" aria-label="Разделы профиля">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "account"}
            data-active={activeTab === "account"}
            onClick={() => setActiveTab("account")}
          >
            <UserIcon className="size-4" />
            Профиль
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "images"}
            data-active={activeTab === "images"}
            onClick={() => setActiveTab("images")}
          >
            <ImageIcon className="size-4" />
            Изображения
            <span>{generatedImages.length}</span>
          </button>
        </div>

        {activeTab === "account" ? (
          auth.status === "loading" ? (
            <div className="profile-loading" role="status">Проверяем профиль…</div>
          ) : auth.status === "guest" ? (
            <div className="profile-guest">
              <div className="profile-avatar"><UserIcon /></div>
              <div className="profile-kicker">Гостевой режим</div>
              <h1>Вы вошли как гость</h1>
              <p>Зарегистрируйтесь, чтобы убрать недельный лимит и синхронизировать текстовую историю.</p>
              <div className="profile-actions">
                <Link href="/sign-up" className="profile-primary-action">Создать аккаунт</Link>
                <Link href="/sign-in" className="profile-secondary-action">Войти</Link>
              </div>
            </div>
          ) : (
            <div className="profile-account">
              <div className="profile-intro">
                <div className="profile-avatar profile-avatar-initials">
                  {auth.user.firstName.slice(0, 1)}{auth.user.lastName.slice(0, 1)}
                </div>
                <div>
                  <div className="profile-kicker">Ваш профиль</div>
                  <h1>{auth.user.firstName} {auth.user.lastName}</h1>
                  <p>{auth.user.email}</p>
                </div>
              </div>
              <dl className="profile-details">
                <div><dt>Имя</dt><dd>{auth.user.firstName}</dd></div>
                <div><dt>Фамилия</dt><dd>{auth.user.lastName}</dd></div>
                <div><dt>Возраст</dt><dd>{auth.user.age}</dd></div>
                <div>
                  <dt>В Hermes с</dt>
                  <dd>{new Intl.DateTimeFormat("ru", { dateStyle: "long" }).format(new Date(auth.user.createdAt))}</dd>
                </div>
              </dl>
              <div className="profile-actions profile-account-actions">
                <Link
                  href="/settings"
                  className="profile-secondary-action profile-settings-action"
                >
                  <SettingsIcon className="size-[15px]" />
                  <span>Настройки</span>
                </Link>
                <button type="button" className="profile-logout" onClick={logout} disabled={loggingOut}>
                  <LogOutIcon className="size-4" /> {loggingOut ? "Выходим…" : "Выйти"}
                </button>
              </div>
              {error ? <p className="auth-error" role="alert">{error}</p> : null}
            </div>
          )
        ) : (
          <div className="profile-images-panel" role="tabpanel">
            <div className="profile-images-heading">
              <div>
                <p className="profile-kicker">Локальная коллекция</p>
                <h1>Созданные изображения</h1>
                <p>Они доступны только в этом браузере и не хранятся в базе Hermes.</p>
              </div>
              <Link href="/generation" className="profile-primary-action">
                Создать изображение
              </Link>
            </div>

            {generatedImages.length === 0 ? (
              <div className="profile-images-empty">
                <span><ImageIcon className="size-6" /></span>
                <strong>Здесь пока пусто</strong>
                <p>Создайте первое изображение — оно появится здесь автоматически.</p>
              </div>
            ) : (
              <div className="profile-images-grid">
                {generatedImages.map((image) => (
                  <article className="profile-image-card" key={image.id}>
                    <div
                      className="profile-image-preview"
                      style={{ aspectRatio: image.aspectRatio.replace(":", " / ") }}
                    >
                      <Image
                        src={image.dataUrl}
                        alt={image.prompt}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    </div>
                    <div className="profile-image-copy">
                      <p>{image.prompt}</p>
                      <div>
                        <span>{IMAGE_MODELS.find((item) => item.id === image.model)?.name}</span>
                        <time dateTime={new Date(image.createdAt).toISOString()}>
                          {formatGeneratedAt(image.createdAt)}
                        </time>
                      </div>
                      <div className="profile-image-actions">
                        <button type="button" onClick={() => downloadImage(image)}>
                          <DownloadIcon className="size-4" />
                          Скачать
                        </button>
                        <button
                          type="button"
                          aria-label={`Удалить изображение «${image.prompt}»`}
                          onClick={() => removeImage(image.id)}
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
