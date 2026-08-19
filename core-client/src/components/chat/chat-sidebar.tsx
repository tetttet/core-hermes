"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { LogoutConfirmDialog } from "@/components/auth/logout-confirm-dialog";
import {
  ChatBubbleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeIcon,
  InfoIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  TerminalIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from "@/components/icons";
import { Tooltip } from "@/components/tooltip";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
  signOut,
  subscribeToAuth,
} from "@/lib/auth-store";
import type { ChatThread } from "@/types/chat";

/* ------------------------------------------------------------------ */
/*  Delete-confirmation dialog                                         */
/* ------------------------------------------------------------------ */

export function DeleteConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Sidebar");
  const common = useTranslations("Common");
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-title text-base font-semibold text-foreground mb-1">
          {t("deleteChatTitle")}
        </h2>
        <p id={descriptionId} className="confirm-desc text-sm text-muted-soft mb-5">
          {t("deleteChatDescription")}
        </p>
        <div className="confirm-actions flex justify-end gap-2">
          <button type="button" className="confirm-btn confirm-btn-cancel px-4" onClick={onCancel}>
            {common("cancel")}
          </button>
          <button type="button" className="confirm-btn confirm-btn-delete px-4" onClick={onConfirm}>
            {common("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat-item context menu (3-dot)                                     */
/* ------------------------------------------------------------------ */

export function ChatContextMenu({
  id,
  anchorRef,
  menuRef,
  onRename,
  onDelete,
  onToggleFavorite,
  isFavorite,
  onClose,
}: {
  id: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  onRename: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Sidebar");
  const common = useTranslations("Common");
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useEffect(() => {
    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      const menuWidth = menuRect?.width || 196;
      const menuHeight = menuRect?.height || 112;
      const viewportGap = 8;
      const anchorGap = 6;
      const left = Math.min(
        window.innerWidth - menuWidth - viewportGap,
        Math.max(viewportGap, anchorRect.right - menuWidth),
      );
      const fitsBelow =
        anchorRect.bottom + anchorGap + menuHeight <= window.innerHeight - viewportGap;
      const top = fitsBelow
        ? anchorRect.bottom + anchorGap
        : Math.max(viewportGap, anchorRect.top - menuHeight - anchorGap);

      setPosition({ left, top });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, menuRef]);

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      className="chat-context-menu"
      role="menu"
      style={position}
    >
      <button
        type="button"
        role="menuitem"
        className="chat-context-item"
        onClick={() => {
          onToggleFavorite();
          onClose();
        }}
      >
        <StarIcon className="size-3.5" filled={isFavorite} />
        {isFavorite ? t("removeFavorite") : t("addFavorite")}
      </button>
      <button
        type="button"
        role="menuitem"
        className="chat-context-item"
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        <PencilIcon className="size-3.5" />
        {t("rename")}
      </button>
      <button
        type="button"
        role="menuitem"
        className="chat-context-item chat-context-item-danger"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <TrashIcon className="size-3.5" />
        {common("delete")}
      </button>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/*  Single chat item                                                   */
/* ------------------------------------------------------------------ */

function ChatItem({
  chat,
  isActive,
  isBusy,
  isCollapsed,
  onSelect,
  onDelete,
  onRename,
  onToggleFavorite,
}: {
  chat: ChatThread;
  isActive: boolean;
  isBusy: boolean;
  isCollapsed: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
  onToggleFavorite: () => void;
}) {
  const t = useTranslations("Sidebar");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title);
  const itemRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (isRenaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        !itemRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }

  if (isCollapsed) {
    return (
      <Tooltip content={chat.title} className="w-full">
        <button
          type="button"
          disabled={isBusy}
          onClick={onSelect}
          aria-label={chat.title}
          className="sidebar-chat sidebar-chat-collapsed"
          data-active={isActive}
          data-favorite={Boolean(chat.isFavorite)}
        >
          {chat.isFavorite ? (
            <StarIcon className="size-[18px] sidebar-favorite-icon" filled />
          ) : (
            <ChatBubbleIcon className="size-[18px]" />
          )}
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      ref={itemRef}
      className="sidebar-chat group"
      data-active={isActive}
      data-favorite={Boolean(chat.isFavorite)}
      data-menu-open={menuOpen}
    >
      {isRenaming ? (
        <input
          ref={renameRef}
          className="sidebar-rename-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") {
              setRenameValue(chat.title);
              setIsRenaming(false);
            }
          }}
        />
      ) : (
        <Tooltip content={chat.title} disabled={!isCollapsed} className="min-w-0 flex-1">
          <button
            type="button"
            disabled={isBusy}
            onClick={onSelect}
            className="sidebar-chat-btn"
          >
            <span className="sidebar-chat-title-row">
              {chat.isFavorite ? (
                <StarIcon className="sidebar-chat-star" filled />
              ) : null}
              <span className="sidebar-chat-title">{chat.title}</span>
            </span>
          </button>
        </Tooltip>
      )}

      {!isRenaming && (
        <div className="sidebar-chat-actions" data-open={menuOpen}>
          <button
            ref={dotsRef}
            type="button"
            className="sidebar-dots-btn"
            aria-label={t("chatActions", { title: chat.title })}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MoreHorizontalIcon className="size-4" />
          </button>

          {menuOpen && (
            <ChatContextMenu
              id={menuId}
              anchorRef={dotsRef}
              menuRef={menuRef}
              onRename={() => {
                setRenameValue(chat.title);
                setIsRenaming(true);
              }}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              isFavorite={Boolean(chat.isFavorite)}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main sidebar                                                       */
/* ------------------------------------------------------------------ */

function ChatListSkeleton({ isCollapsed }: { isCollapsed: boolean }) {
  const t = useTranslations("Sidebar");
  return (
    <div
      className="sidebar-chat-skeleton-list"
      role="status"
      aria-label={t("loadingChats")}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className={`sidebar-chat-skeleton ${isCollapsed ? "sidebar-chat-skeleton-collapsed" : ""}`}
          aria-hidden="true"
        >
          <span className="sidebar-chat-skeleton-icon" />
          {!isCollapsed ? (
            <span
              className="sidebar-chat-skeleton-title"
              style={{ width: `${58 + (index % 3) * 12}%` }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

type ChatSidebarProps = {
  chats: ChatThread[];
  activeChatId: string | null;
  isOpen: boolean;
  isBusy: boolean;
  isLoadingChats?: boolean;
  isLoadingMoreChats?: boolean;
  hasMoreChats?: boolean;
  chatListError?: string;
  isCollapsed: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onToggleFavoriteChat: (chatId: string) => void;
  onLoadMoreChats?: () => void;
  onRetryChats?: () => void;
  onToggleCollapse: () => void;
};

export function ChatSidebar({
  chats,
  activeChatId,
  isOpen,
  isBusy,
  isLoadingChats = false,
  isLoadingMoreChats = false,
  hasMoreChats = false,
  chatListError = "",
  isCollapsed,
  onClose,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onToggleFavoriteChat,
  onLoadMoreChats,
  onRetryChats,
  onToggleCollapse,
}: ChatSidebarProps) {
  const t = useTranslations("Sidebar");
  const common = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isLocalePending, startLocaleTransition] = useTransition();
  const auth = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
  const favoriteChats = chats
    .filter((chat) => chat.isFavorite)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const recentChats = chats
    .filter((chat) => !chat.isFavorite)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const sortedChats = [...favoriteChats, ...recentChats];
  const chatLayoutKey = sortedChats
    .map((chat) => `${chat.id}:${Number(Boolean(chat.isFavorite))}`)
    .join(":");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuId = useId();
  const languageMenuId = useId();
  const motionItemsRef = useRef(new Map<string, HTMLDivElement>());
  const previousPositionsRef = useRef(new Map<string, number>());
  const chatToDelete = confirmDeleteId
    ? chats.find((c) => c.id === confirmDeleteId)
    : null;

  useEffect(() => {
    void initializeAuth();
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setLanguageMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setLanguageMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  function closeUserMenu() {
    setUserMenuOpen(false);
    setLanguageMenuOpen(false);
    onClose();
  }

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      await signOut();
      setConfirmingLogout(false);
      closeUserMenu();
    } catch (error) {
      setLogoutError(
        locale === "ru" && error instanceof Error ? error.message : t("logoutError"),
      );
      setLoggingOut(false);
    }
  }

  function switchLocale(nextLocale: "en" | "ru") {
    if (nextLocale === locale || isLocalePending) return;
    setLanguageMenuOpen(false);
    setUserMenuOpen(false);
    onClose();
    startLocaleTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  useLayoutEffect(() => {
    const nextPositions = new Map<string, number>();
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    motionItemsRef.current.forEach((element, chatId) => {
      const nextTop = element.getBoundingClientRect().top;
      nextPositions.set(chatId, nextTop);
      const previousTop = previousPositionsRef.current.get(chatId);
      const delta = previousTop === undefined ? 0 : previousTop - nextTop;

      if (!reduceMotion && Math.abs(delta) > 1) {
        element.animate(
          [
            {
              transform: `translateY(${delta}px) scale(0.985)`,
              opacity: 0.82,
            },
            {
              transform: "translateY(-2px) scale(1.003)",
              opacity: 1,
              offset: 0.78,
            },
            { transform: "translateY(0) scale(1)", opacity: 1 },
          ],
          {
            duration: 520,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          },
        );
      }
    });

    previousPositionsRef.current = nextPositions;
  }, [chatLayoutKey, isCollapsed]);

  return (
    <>
      <button
        type="button"
        aria-label={t("closeMenu")}
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
        className="sidebar-backdrop fixed inset-0 z-20 bg-black/20 lg:hidden"
        data-open={isOpen}
      />

      <aside
        className={`chat-sidebar fixed inset-y-0 left-0 z-30 flex shrink-0 flex-col border-r p-3 lg:static lg:translate-x-0 ${
          isCollapsed ? "sidebar-collapsed" : "sidebar-expanded"
        } ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Header: logo + name + collapse toggle */}
        <div className={`sidebar-header ${isCollapsed ? "justify-center" : ""}`}>
          <div className="sidebar-brand">
            <Image
              src="/yahya.svg"
              alt=""
              width={28}
              height={28}
              unoptimized
              className="sidebar-logo"
            />
            <span className="sidebar-brand-name">Hermes</span>
          </div>
          <Tooltip
            content={isCollapsed ? t("expand") : t("collapse")}
            disabled={!isCollapsed}
            className={isCollapsed ? "mx-auto" : "ml-auto"}
          >
            <button
              type="button"
              aria-label={isCollapsed ? t("expand") : t("collapse")}
              onClick={onToggleCollapse}
              className="sidebar-collapse-btn"
            >
              {isCollapsed ? (
                <PanelLeftOpenIcon className="size-[18px]" />
              ) : (
                <PanelLeftCloseIcon className="size-[18px]" />
              )}
            </button>
          </Tooltip>
          {/* Mobile close button */}
          <button
            type="button"
            aria-label={t("closeMenu")}
            onClick={onClose}
            className="sidebar-icon-button sidebar-mobile-close flex size-8 items-center justify-center rounded-lg lg:hidden"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* New chat button */}
        <Tooltip content={t("newChat")} disabled={!isCollapsed} className="mt-2 w-full">
          <button
            type="button"
            onClick={onNewChat}
            disabled={isBusy}
            className={`sidebar-new-chat ${isCollapsed ? "sidebar-new-chat-collapsed" : ""}`}
          >
            <PlusIcon className="size-[18px] shrink-0" />
            <span className="sidebar-button-text">{t("newChat")}</span>
          </button>
        </Tooltip>

        <Tooltip content={common("about")} disabled={!isCollapsed} className="mt-0.5 w-full">
          <Link
            href="/about"
            onClick={onClose}
            className={`sidebar-new-chat sidebar-about ${isCollapsed ? "sidebar-new-chat-collapsed" : ""}`}
          >
            <InfoIcon className="size-[18px] shrink-0" />
            <span className="sidebar-button-text">{common("about")}</span>
          </Link>
        </Tooltip>

        <Tooltip content={t("hcode")} disabled={!isCollapsed} className="mt-0.5 w-full">
          <Link
            href="/hcode"
            onClick={onClose}
            className={`sidebar-new-chat sidebar-about ${isCollapsed ? "sidebar-new-chat-collapsed" : ""}`}
          >
            <TerminalIcon className="size-[18px] shrink-0" />
            <span className="sidebar-button-text">{t("hcode")}</span>
          </Link>
        </Tooltip>

        {/* Chat list */}
        <nav
          className={`sidebar-chat-list mt-4 min-h-0 flex-1 overflow-y-auto ${isCollapsed ? "sidebar-nav-collapsed" : ""}`}
          aria-label={t("chats")}
          aria-busy={isLoadingChats || isLoadingMoreChats}
        >
          {favoriteChats.length > 0 ? (
            <div className="sidebar-label sidebar-chat-section-label px-2">
              {t("favorites")}
            </div>
          ) : null}
          {favoriteChats.map((chat) => (
            <div
              key={chat.id}
              ref={(element) => {
                if (element) motionItemsRef.current.set(chat.id, element);
                else motionItemsRef.current.delete(chat.id);
              }}
              className="sidebar-chat-motion"
            >
              <ChatItem
                chat={chat}
                isActive={activeChatId === chat.id}
                isBusy={isBusy}
                isCollapsed={isCollapsed}
                onSelect={() => onSelectChat(chat.id)}
                onDelete={() => setConfirmDeleteId(chat.id)}
                onRename={(newTitle) => onRenameChat(chat.id, newTitle)}
                onToggleFavorite={() => onToggleFavoriteChat(chat.id)}
              />
            </div>
          ))}

          <div className="sidebar-label sidebar-chat-section-label px-2">
            {t("recent")}
          </div>
          {isLoadingChats && recentChats.length === 0 && favoriteChats.length === 0 ? (
            <ChatListSkeleton isCollapsed={isCollapsed} />
          ) : chatListError && recentChats.length === 0 && favoriteChats.length === 0 ? (
            <div className="sidebar-chat-load-error px-2 py-3" role="alert">
              <p className="sidebar-muted text-sm leading-5">{chatListError}</p>
              {onRetryChats ? (
                <button
                  type="button"
                  className="sidebar-load-more"
                  onClick={onRetryChats}
                >
                  {common("retry")}
                </button>
              ) : null}
            </div>
          ) : recentChats.length === 0 && favoriteChats.length === 0 ? (
            <p className="sidebar-muted px-2 py-3 text-sm leading-5">
              {t("empty")}
            </p>
          ) : (
            recentChats.map((chat) => (
              <div
                key={chat.id}
                ref={(element) => {
                  if (element) motionItemsRef.current.set(chat.id, element);
                  else motionItemsRef.current.delete(chat.id);
                }}
                className="sidebar-chat-motion"
              >
                <ChatItem
                  chat={chat}
                  isActive={activeChatId === chat.id}
                  isBusy={isBusy}
                  isCollapsed={isCollapsed}
                  onSelect={() => onSelectChat(chat.id)}
                  onDelete={() => setConfirmDeleteId(chat.id)}
                  onRename={(newTitle) => onRenameChat(chat.id, newTitle)}
                  onToggleFavorite={() => onToggleFavoriteChat(chat.id)}
                />
              </div>
            ))
          )}

          {hasMoreChats && onLoadMoreChats && !isCollapsed ? (
            <button
              type="button"
              className="sidebar-load-more"
              disabled={isLoadingMoreChats}
              onClick={onLoadMoreChats}
            >
              {isLoadingMoreChats ? t("loadingMore") : t("showMore")}
            </button>
          ) : null}
        </nav>

        {/* Footer */}
        <p className="sidebar-footer px-2 pb-2 pt-3 text-[11px] leading-4">
          {auth.status === "authenticated"
            ? t("syncedHistory")
            : t("guestLimit")}
        </p>

        {/* User menu */}
        <div ref={userMenuRef} className="sidebar-account">
          <div
            id={userMenuId}
            className="sidebar-account-menu"
            role="menu"
            aria-label={t("userMenu")}
            aria-hidden={!userMenuOpen}
            data-open={userMenuOpen}
          >
            <div
              className="sidebar-account-language"
              data-open={languageMenuOpen}
              onMouseEnter={() => setLanguageMenuOpen(true)}
              onMouseLeave={() => setLanguageMenuOpen(false)}
              onFocus={() => setLanguageMenuOpen(true)}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  setLanguageMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                role="menuitem"
                tabIndex={userMenuOpen ? 0 : -1}
                className="sidebar-account-menu-item"
                aria-haspopup="menu"
                aria-expanded={languageMenuOpen}
                aria-controls={languageMenuId}
                aria-label={t("language")}
                onClick={() => setLanguageMenuOpen(true)}
              >
                <GlobeIcon className="size-[17px]" />
                <span>{t("language")}</span>
                <ChevronRightIcon className="sidebar-language-chevron size-4" />
              </button>
              <div
                id={languageMenuId}
                className="sidebar-language-menu"
                role="menu"
                aria-label={t("availableLanguages")}
                aria-hidden={!languageMenuOpen}
                data-open={languageMenuOpen}
              >
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={userMenuOpen && languageMenuOpen ? 0 : -1}
                  className="sidebar-language-option"
                  aria-current={locale === "en" ? "true" : undefined}
                  disabled={isLocalePending}
                  onClick={() => switchLocale("en")}
                >
                  {t("english")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={userMenuOpen && languageMenuOpen ? 0 : -1}
                  className="sidebar-language-option"
                  aria-current={locale === "ru" ? "true" : undefined}
                  disabled={isLocalePending}
                  onClick={() => switchLocale("ru")}
                >
                  {t("russian")}
                </button>
              </div>
            </div>
            <div className="sidebar-account-menu-divider" />
            <Link
              href="/profile"
              role="menuitem"
              tabIndex={userMenuOpen ? 0 : -1}
              className="sidebar-account-menu-item"
              onClick={closeUserMenu}
            >
              <UserIcon className="size-[17px]" />
              <span>{common("profile")}</span>
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              tabIndex={userMenuOpen ? 0 : -1}
              className="sidebar-account-menu-item"
              onClick={closeUserMenu}
            >
              <SettingsIcon className="size-[17px]" />
              <span>{common("settings")}</span>
            </Link>
            <div className="sidebar-account-menu-divider" />
            <Link
              href="/help"
              role="menuitem"
              tabIndex={userMenuOpen ? 0 : -1}
              className="sidebar-account-menu-item"
              onClick={closeUserMenu}
            >
              <InfoIcon className="size-[17px]" />
              <span>{t("help")}</span>
            </Link>
            {auth.status === "authenticated" ? (
              <button
                type="button"
                role="menuitem"
                tabIndex={userMenuOpen ? 0 : -1}
                className="sidebar-account-menu-item sidebar-account-menu-logout"
                onClick={() => {
                  setLogoutError("");
                  setUserMenuOpen(false);
                  setLanguageMenuOpen(false);
                  setConfirmingLogout(true);
                }}
                disabled={loggingOut}
              >
                <LogOutIcon className="size-[17px]" />
                <span>{loggingOut ? t("loggingOut") : t("logout")}</span>
              </button>
            ) : null}
            {logoutError ? (
              <p className="sidebar-account-menu-error" role="alert">
                {logoutError}
              </p>
            ) : null}
          </div>

          <Tooltip
            content={auth.status === "loading" ? t("loadingProfile") : t("userMenu")}
            disabled={!isCollapsed || userMenuOpen}
            className="w-full"
          >
            <button
              type="button"
              className={`sidebar-profile-link ${isCollapsed ? "sidebar-profile-collapsed" : ""}`}
              aria-label={
                auth.status === "loading"
                  ? t("loadingProfile")
                  : userMenuOpen
                    ? t("closeUserMenu")
                    : t("openUserMenu")
              }
              aria-busy={auth.status === "loading"}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-controls={userMenuId}
              disabled={auth.status === "loading"}
              onClick={() => {
                if (userMenuOpen) setLanguageMenuOpen(false);
                setUserMenuOpen((open) => !open);
              }}
            >
              {auth.status === "loading" ? (
                <>
                  <span
                    className="sidebar-profile-avatar sidebar-profile-skeleton"
                    aria-hidden="true"
                  />
                  <span
                    className="sidebar-profile-copy sidebar-profile-skeleton-copy"
                    aria-hidden="true"
                  >
                    <span className="sidebar-profile-skeleton sidebar-profile-skeleton-name" />
                    <span className="sidebar-profile-skeleton sidebar-profile-skeleton-detail" />
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="sidebar-profile-avatar"
                    data-authenticated={auth.status === "authenticated"}
                  >
                    {auth.status === "authenticated" ? (
                      <span aria-hidden="true">
                        {auth.user.firstName.slice(0, 1)}{auth.user.lastName.slice(0, 1)}
                      </span>
                    ) : (
                      <UserIcon className="size-[18px]" />
                    )}
                  </span>
                  <span className="sidebar-profile-copy">
                    <strong>
                      {auth.status === "authenticated"
                        ? `${auth.user.firstName} ${auth.user.lastName}`
                        : t("guest")}
                    </strong>
                    <small>
                      {auth.status === "authenticated"
                        ? auth.user.email
                        : t("signInOrCreate")}
                    </small>
                  </span>
                  <ChevronDownIcon className="sidebar-profile-chevron size-4" data-open={userMenuOpen} />
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      {chatToDelete && (
        <DeleteConfirmDialog
          onConfirm={() => {
            onDeleteChat(chatToDelete.id);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {confirmingLogout ? (
        <LogoutConfirmDialog
          busy={loggingOut}
          error={logoutError}
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={() => void logout()}
        />
      ) : null}
    </>
  );
}
