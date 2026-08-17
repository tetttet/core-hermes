"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LogoutConfirmDialog } from "@/components/auth/logout-confirm-dialog";
import {
  ChevronLeftIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
  signOut,
  subscribeToAuth,
} from "@/lib/auth-store";

export function ProfilePage() {
  const t = useTranslations("Profile");
  const common = useTranslations("Common");
  const sidebar = useTranslations("Sidebar");
  const authText = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
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
      setConfirmingLogout(false);
      router.replace("/");
    } catch (logoutError) {
      setError(
        locale === "ru" && logoutError instanceof Error
          ? logoutError.message
          : t("logoutError"),
      );
      setLoggingOut(false);
    }
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link href="/" className="profile-back" aria-label={common("backToChat")}>
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
            {t("checking")}
          </div>
        ) : auth.status === "guest" ? (
          <div className="profile-guest">
            <div className="profile-avatar">
              <UserIcon />
            </div>
            <div className="profile-kicker">{t("guestMode")}</div>
            <h1>{t("guestTitle")}</h1>
            <p>{t("guestDescription")}</p>
            <div className="profile-actions">
              <Link href="/sign-up" className="profile-primary-action">
                {authText("createAccount")}
              </Link>
              <Link href="/sign-in" className="profile-secondary-action">
                {authText("signIn")}
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
                <div className="profile-kicker">{t("yourProfile")}</div>
                <h1>
                  {auth.user.firstName} {auth.user.lastName}
                </h1>
                <p>{auth.user.email}</p>
              </div>
            </div>
            <dl className="profile-details">
              <div>
                <dt>{t("firstName")}</dt>
                <dd>{auth.user.firstName}</dd>
              </div>
              <div>
                <dt>{t("lastName")}</dt>
                <dd>{auth.user.lastName}</dd>
              </div>
              <div>
                <dt>{t("age")}</dt>
                <dd>{auth.user.age}</dd>
              </div>
              <div>
                <dt>{t("memberSince")}</dt>
                <dd>
                  {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
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
                <span>{common("settings")}</span>
              </Link>
              <button
                type="button"
                className="profile-logout"
                onClick={() => {
                  setError("");
                  setConfirmingLogout(true);
                }}
                disabled={loggingOut}
              >
                <LogOutIcon className="size-4" />
                {loggingOut ? sidebar("loggingOut") : sidebar("logout")}
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
      {confirmingLogout ? (
        <LogoutConfirmDialog
          busy={loggingOut}
          error={error}
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={() => void logout()}
        />
      ) : null}
    </main>
  );
}
