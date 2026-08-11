"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  ChatBubbleIcon,
  ChevronDownIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from "@/components/icons";
import { Tooltip } from "@/components/tooltip";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
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
          Удалить этот чат?
        </h2>
        <p id={descriptionId} className="confirm-desc text-sm text-muted-soft mb-5">
          Вся история этого чата будет удалена. Это действие нельзя отменить.
        </p>
        <div className="confirm-actions flex justify-end gap-2">
          <button type="button" className="confirm-btn confirm-btn-cancel px-4" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="confirm-btn confirm-btn-delete px-4" onClick={onConfirm}>
            Удалить
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
        {isFavorite ? "Убрать из избранного" : "В избранное"}
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
        Переименовать
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
        Удалить
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
            aria-label={`Действия с чатом «${chat.title}»`}
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

type ChatSidebarProps = {
  chats: ChatThread[];
  activeChatId: string | null;
  isOpen: boolean;
  isBusy: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onToggleFavoriteChat: (chatId: string) => void;
  onToggleCollapse: () => void;
};

export function ChatSidebar({
  chats,
  activeChatId,
  isOpen,
  isBusy,
  isCollapsed,
  onClose,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onToggleFavoriteChat,
  onToggleCollapse,
}: ChatSidebarProps) {
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
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuId = useId();
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
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setUserMenuOpen(false);
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
    onClose();
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
        aria-label="Закрыть меню"
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
              alt="Yahya logo"
              width={28}
              height={28}
              unoptimized
              className="sidebar-logo"
            />
            <span className="sidebar-brand-name">Hermes</span>
          </div>
          <Tooltip
            content={isCollapsed ? "Раскрыть панель" : "Свернуть панель"}
            disabled={!isCollapsed}
            className={isCollapsed ? "mx-auto" : "ml-auto"}
          >
            <button
              type="button"
              aria-label={isCollapsed ? "Раскрыть панель" : "Свернуть панель"}
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
            aria-label="Закрыть меню"
            onClick={onClose}
            className="sidebar-icon-button sidebar-mobile-close flex size-8 items-center justify-center rounded-lg lg:hidden"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* New chat button */}
        <Tooltip content="Новый чат" disabled={!isCollapsed} className="mt-2 w-full">
          <button
            type="button"
            onClick={onNewChat}
            disabled={isBusy}
            className={`sidebar-new-chat ${isCollapsed ? "sidebar-new-chat-collapsed" : ""}`}
          >
            <PlusIcon className="size-[18px] shrink-0" />
            <span className="sidebar-button-text">Новый чат</span>
          </button>
        </Tooltip>

        {/* Chat list */}
        <nav
          className={`sidebar-chat-list mt-4 min-h-0 flex-1 overflow-y-auto ${isCollapsed ? "sidebar-nav-collapsed" : ""}`}
          aria-label="Чаты"
        >
          {favoriteChats.length > 0 ? (
            <div className="sidebar-label sidebar-chat-section-label px-2">
              Избранные
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
            Недавние
          </div>
          {recentChats.length === 0 && favoriteChats.length === 0 ? (
            <p className="sidebar-muted px-2 py-3 text-sm leading-5">
              Здесь появятся ваши диалоги
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
        </nav>

        {/* Footer */}
        <p className="sidebar-footer px-2 pb-2 pt-3 text-[11px] leading-4">
          {auth.status === "authenticated"
            ? "Текстовая история синхронизируется"
            : "Гостевой лимит: 5 запросов в неделю"}
        </p>

        {/* User menu */}
        <div ref={userMenuRef} className="sidebar-account">
          <div
            id={userMenuId}
            className="sidebar-account-menu"
            role="menu"
            aria-hidden={!userMenuOpen}
            data-open={userMenuOpen}
          >
            <Link
              href="/profile"
              role="menuitem"
              tabIndex={userMenuOpen ? 0 : -1}
              className="sidebar-account-menu-item"
              onClick={closeUserMenu}
            >
              <UserIcon className="size-[17px]" />
              <span>Профиль</span>
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              tabIndex={userMenuOpen ? 0 : -1}
              className="sidebar-account-menu-item"
              onClick={closeUserMenu}
            >
              <SettingsIcon className="size-[17px]" />
              <span>Настройки</span>
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
              <span>Получить помощь</span>
            </Link>
          </div>

          <Tooltip
            content="Меню пользователя"
            disabled={!isCollapsed || userMenuOpen}
            className="w-full"
          >
            <button
              type="button"
              className={`sidebar-profile-link ${isCollapsed ? "sidebar-profile-collapsed" : ""}`}
              aria-label={userMenuOpen ? "Закрыть меню пользователя" : "Открыть меню пользователя"}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-controls={userMenuId}
              onClick={() => setUserMenuOpen((open) => !open)}
            >
              <span className="sidebar-profile-avatar" data-authenticated={auth.status === "authenticated"}>
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
                    : "Гость"}
                </strong>
                <small>
                  {auth.status === "authenticated"
                    ? auth.user.email
                    : auth.status === "loading"
                      ? "Проверяем сессию…"
                      : "Войти или зарегистрироваться"}
                </small>
              </span>
              <ChevronDownIcon className="sidebar-profile-chevron size-4" data-open={userMenuOpen} />
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
    </>
  );
}
