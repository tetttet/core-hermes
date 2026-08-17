"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ChevronLeftIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
  signOut,
  subscribeToAuth,
} from "@/lib/auth-store";

export function ProfilePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const auth = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
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
      setError(
        logoutError instanceof Error ? logoutError.message : "Не удалось выйти",
      );
      setLoggingOut(false);
    }
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
        {auth.status === "loading" ? (
          <div className="profile-loading" role="status">
            Проверяем профиль…
          </div>
        ) : auth.status === "guest" ? (
          <div className="profile-guest">
            <div className="profile-avatar">
              <UserIcon />
            </div>
            <div className="profile-kicker">Гостевой режим</div>
            <h1>Вы вошли как гость</h1>
            <p>
              Зарегистрируйтесь, чтобы убрать недельный лимит и
              синхронизировать текстовую историю.
            </p>
            <div className="profile-actions">
              <Link href="/sign-up" className="profile-primary-action">
                Создать аккаунт
              </Link>
              <Link href="/sign-in" className="profile-secondary-action">
                Войти
              </Link>
            </div>
          </div>
        ) : (
          <div className="profile-account">
            <div className="profile-intro">
              <div className="profile-avatar profile-avatar-initials">
                {auth.user.firstName.slice(0, 1)}
                {auth.user.lastName.slice(0, 1)}
              </div>
              <div>
                <div className="profile-kicker">Ваш профиль</div>
                <h1>
                  {auth.user.firstName} {auth.user.lastName}
                </h1>
                <p>{auth.user.email}</p>
              </div>
            </div>
            <dl className="profile-details">
              <div>
                <dt>Имя</dt>
                <dd>{auth.user.firstName}</dd>
              </div>
              <div>
                <dt>Фамилия</dt>
                <dd>{auth.user.lastName}</dd>
              </div>
              <div>
                <dt>Возраст</dt>
                <dd>{auth.user.age}</dd>
              </div>
              <div>
                <dt>В Hermes с</dt>
                <dd>
                  {new Intl.DateTimeFormat("ru", { dateStyle: "long" }).format(
                    new Date(auth.user.createdAt),
                  )}
                </dd>
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
              <button
                type="button"
                className="profile-logout"
                onClick={logout}
                disabled={loggingOut}
              >
                <LogOutIcon className="size-4" />
                {loggingOut ? "Выходим…" : "Выйти"}
              </button>
            </div>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
