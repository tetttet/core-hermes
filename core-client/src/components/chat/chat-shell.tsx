"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDownIcon, MenuIcon } from "@/components/icons";
import { findModel, getModel } from "@/config/models";
import { ChatStreamError, consumeChatResponse, prepareApiMessages } from "@/lib/chat-stream";
import {
  deleteRemoteChat,
  loadRemoteHistory,
  streamChat,
  updateRemoteChat,
} from "@/lib/core-api";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
  subscribeToAuth,
} from "@/lib/auth-store";
import {
  getChatServerSnapshot,
  getChatSnapshot,
  saveChatStore,
  subscribeToChat,
} from "@/lib/chat-storage";
import type { ChatAttachment, ChatMessage, ChatThread } from "@/types/chat";
import { ChatComposer } from "./chat-composer";
import {
  ChatContextMenu,
  ChatSidebar,
  DeleteConfirmDialog,
} from "./chat-sidebar";
import { MessageList } from "./message-list";

const EMPTY_MESSAGES: ChatMessage[] = [];

type PendingRequest = {
  chatId: string;
  title: string;
  modelId: string;
  messages: ChatMessage[];
  assistantId: string;
};

function makeChatTitle(content: string, attachments: ChatAttachment[]) {
  const cleanContent = content.replace(/\s+/g, " ").trim();
  if (cleanContent) return cleanContent.slice(0, 42);
  return attachments[0]?.name.slice(0, 42) || "Новый чат";
}

function updateAssistantMessage(
  chatId: string,
  assistantId: string,
  update: Pick<ChatMessage, "content" | "status" | "modelId" | "notice">,
) {
  const latestStore = getChatSnapshot();
  let found = false;
  const didSave = saveChatStore({
    ...latestStore,
    chats: latestStore.chats.map((chat) => {
      if (chat.id !== chatId) return chat;

      return {
        ...chat,
        messages: chat.messages.map((message) => {
          if (message.id !== assistantId) return message;
          found = true;
          return {
            ...message,
            ...update,
          };
        }),
      };
    }),
  });

  return found && didSave;
}

function removeAssistantMessage(chatId: string, assistantId: string) {
  const latestStore = getChatSnapshot();
  return saveChatStore({
    ...latestStore,
    chats: latestStore.chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            messages: chat.messages.filter((message) => message.id !== assistantId),
          }
        : chat,
    ),
  });
}

export function ChatShell() {
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
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isStorageError, setIsStorageError] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerRenaming, setHeaderRenaming] = useState(false);
  const [headerRenameValue, setHeaderRenameValue] = useState("");
  const [headerDeleteChatId, setHeaderDeleteChatId] = useState<string | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const headerMenuButtonRef = useRef<HTMLButtonElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const headerRenameRef = useRef<HTMLInputElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const retryRequestRef = useRef<PendingRequest | null>(null);
  const userStoppedRef = useRef(false);
  const syncedUserRef = useRef<string | null>(null);
  const headerMenuId = useId();
  const activeChat = store.chats.find((chat) => chat.id === store.activeChatId);
  const messages = activeChat?.messages ?? EMPTY_MESSAGES;
  const modelId = activeChat?.modelId ?? store.draftModelId;
  const isLoading = loadingChatId !== null;
  const isEmptyChat = messages.length === 0;

  useEffect(() => {
    void initializeAuth();
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") {
      syncedUserRef.current = null;
      return;
    }
    if (syncedUserRef.current === auth.user.id) return;
    syncedUserRef.current = auth.user.id;

    let cancelled = false;
    const localChats = getChatSnapshot().chats;
    void loadRemoteHistory(localChats)
      .then((chats) => {
        if (cancelled) return;
        const latestStore = getChatSnapshot();
        const loadedIds = new Set(chats.map((chat) => chat.id));
        const newLocalChats = latestStore.chats.filter(
          (chat) => !chat.isSynced && !loadedIds.has(chat.id),
        );
        const mergedChats = [...chats, ...newLocalChats];
        const activeChatId =
          latestStore.activeChatId &&
          mergedChats.some((chat) => chat.id === latestStore.activeChatId)
            ? latestStore.activeChatId
            : (mergedChats[0]?.id ?? null);
        saveChatStore({ ...latestStore, chats: mergedChats, activeChatId });
      })
      .catch(() => {
        if (!cancelled) syncedUserRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [auth]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: isLoading ? "auto" : "smooth",
    });
  }, [messages, isLoading]);

  useEffect(
    () => () => {
      activeRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!headerRenaming) return;
    headerRenameRef.current?.focus();
    headerRenameRef.current?.select();
  }, [headerRenaming]);

  useEffect(() => {
    if (!headerMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !headerActionsRef.current?.contains(target) &&
        !headerMenuRef.current?.contains(target)
      ) {
        setHeaderMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setHeaderMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [headerMenuOpen]);

  function startNewChat() {
    setError("");
    setIsStorageError(false);
    setProgressMessage("");
    setCanRetry(false);
    retryRequestRef.current = null;
    setSidebarOpen(false);
    setHeaderMenuOpen(false);
    setHeaderRenaming(false);
    saveChatStore({
      ...store,
      activeChatId: null,
    });
  }

  function selectChat(chatId: string) {
    setError("");
    setIsStorageError(false);
    setProgressMessage("");
    setCanRetry(false);
    retryRequestRef.current = null;
    setSidebarOpen(false);
    setHeaderMenuOpen(false);
    setHeaderRenaming(false);
    saveChatStore({ ...store, activeChatId: chatId });
  }

  function deleteChat(chatId: string) {
    const chatToDelete = store.chats.find((chat) => chat.id === chatId);
    const chats = store.chats.filter((chat) => chat.id !== chatId);
    const nextActiveChatId =
      store.activeChatId === chatId ? (chats[0]?.id ?? null) : store.activeChatId;

    setError("");
    setIsStorageError(false);
    setProgressMessage("");
    setCanRetry(false);
    retryRequestRef.current = null;
    setHeaderMenuOpen(false);
    setHeaderRenaming(false);
    saveChatStore({ ...store, chats, activeChatId: nextActiveChatId });
    if (auth.status === "authenticated" && chatToDelete?.isSynced) {
      void deleteRemoteChat(chatId).catch(() => {
        setError("Не удалось удалить чат на других устройствах.");
      });
    }
  }

  function renameChat(chatId: string, newTitle: string) {
    const chatToRename = store.chats.find((chat) => chat.id === chatId);
    saveChatStore({
      ...store,
      chats: store.chats.map((chat) =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat,
      ),
    });
    if (auth.status === "authenticated" && chatToRename?.isSynced) {
      void updateRemoteChat(chatId, { title: newTitle }).catch(() => {
        setError("Не удалось обновить название на других устройствах.");
      });
    }
  }

  function toggleFavoriteChat(chatId: string) {
    const chatToUpdate = store.chats.find((chat) => chat.id === chatId);
    if (!chatToUpdate) return;
    const isFavorite = !chatToUpdate.isFavorite;
    const nextOrder = Math.max(0, ...store.chats.map((chat) => chat.updatedAt)) + 1;
    saveChatStore({
      ...store,
      chats: store.chats.map((chat) =>
        chat.id === chatId
          ? { ...chat, isFavorite, updatedAt: nextOrder }
          : chat,
      ),
    });
    if (auth.status === "authenticated" && chatToUpdate.isSynced) {
      void updateRemoteChat(chatId, { isFavorite }).catch(() => {
        setError("Не удалось обновить избранное на других устройствах.");
      });
    }
  }

  function submitHeaderRename() {
    if (!activeChat) return;
    const trimmed = headerRenameValue.trim();
    if (trimmed && trimmed !== activeChat.title) {
      renameChat(activeChat.id, trimmed);
    } else {
      setHeaderRenameValue(activeChat.title);
    }
    setHeaderRenaming(false);
  }

  function changeDraftModel(nextModelId: string) {
    if (activeChat) return;
    saveChatStore({ ...store, draftModelId: nextModelId });
  }

  function stopRequest() {
    userStoppedRef.current = true;
    activeRequestRef.current?.abort();
  }

  async function runAssistantRequest(pending: PendingRequest) {
    if (activeRequestRef.current) return;

    const requestController = new AbortController();
    activeRequestRef.current = requestController;
    userStoppedRef.current = false;
    retryRequestRef.current = null;
    setCanRetry(false);
    setLoadingChatId(pending.chatId);
    setError("");
    setIsStorageError(false);
    setProgressMessage("Отправка запроса...");
    updateAssistantMessage(
      pending.chatId,
      pending.assistantId,
      {
        content: "",
        status: "streaming",
        modelId: pending.modelId,
        notice: undefined,
      },
    );

    let accumulated = "";
    let responseModelId = pending.modelId;
    let animationFrame: number | null = null;
    let storageFailed = false;
    let routingNotice: string | undefined;
    let receivedFirstDelta = false;

    const flush = (status: ChatMessage["status"]) => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      if (!updateAssistantMessage(
        pending.chatId,
        pending.assistantId,
        {
          content: accumulated,
          status,
          modelId: responseModelId,
          notice: routingNotice,
        },
      )) {
        storageFailed = true;
        requestController.abort();
      }
    };

    try {
      const response = await streamChat(
        {
          chatId: pending.chatId,
          title: pending.title,
          assistantMessageId: pending.assistantId,
          model: pending.modelId,
          messages: prepareApiMessages(pending.messages),
          allowFallback: true,
        },
        requestController.signal,
      );

      const result = await consumeChatResponse(response, {
        onDelta(_delta, fullContent) {
          accumulated = fullContent;
          if (!receivedFirstDelta) {
            receivedFirstDelta = true;
            setProgressMessage("Получаем ответ...");
          }
          if (animationFrame === null) {
            animationFrame = requestAnimationFrame(() => flush("streaming"));
          }
        },
        onModel(nextModelId) {
          responseModelId = nextModelId;
          updateAssistantMessage(
            pending.chatId,
            pending.assistantId,
            {
              content: accumulated,
              status: "streaming",
              modelId: responseModelId,
              notice: routingNotice,
            },
          );
        },
        onStatus(status) {
          setProgressMessage(status.message);
        },
      });
      accumulated = result.content;
      responseModelId = result.model ?? responseModelId;
      if (result.fallbackFrom) {
        const finalModel = findModel(responseModelId);
        routingNotice = finalModel?.title ?? responseModelId;
      }

      flush(undefined);
      retryRequestRef.current = null;
      setCanRetry(false);

      const latestStore = getChatSnapshot();
      const nextResponseOrder =
        Math.max(0, ...latestStore.chats.map((chat) => chat.updatedAt)) + 1;
      saveChatStore({
        ...latestStore,
        chats: latestStore.chats.map((chat) =>
          chat.id === pending.chatId
            ? { ...chat, isSynced: auth.status === "authenticated", updatedAt: nextResponseOrder }
            : chat,
        ),
      });
    } catch (requestError) {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;

      if (userStoppedRef.current) {
        if (accumulated) updateAssistantMessage(
          pending.chatId,
          pending.assistantId,
          {
            content: accumulated,
            status: undefined,
            modelId: responseModelId,
            notice: routingNotice,
          },
        );
        else removeAssistantMessage(pending.chatId, pending.assistantId);
        setError("");
        setIsStorageError(false);
        retryRequestRef.current = null;
        setCanRetry(false);
      } else {
        const partialContent =
          requestError instanceof ChatStreamError
            ? requestError.partialContent
            : accumulated;
        accumulated = partialContent;
        updateAssistantMessage(
          pending.chatId,
          pending.assistantId,
          {
            content: partialContent,
            status: "error",
            modelId: responseModelId,
            notice: routingNotice,
          },
        );

        const message = storageFailed
          ? "Не хватает места для ответа. Удалите старые чаты."
          : requestError instanceof Error
            ? requestError.message
            : "Что-то пошло не так. Попробуйте ещё раз.";
        setError(message);
        setIsStorageError(storageFailed);

        if (
          !storageFailed &&
          (!(requestError instanceof ChatStreamError) || requestError.retryable)
        ) {
          retryRequestRef.current = pending;
          setCanRetry(true);
        }
      }
    } finally {
      activeRequestRef.current = null;
      userStoppedRef.current = false;
      setLoadingChatId(null);
      setProgressMessage("");
    }
  }

  function retryLastRequest() {
    const pending = retryRequestRef.current;
    if (pending) {
      setCanRetry(false);
      void runAssistantRequest(pending);
    }
  }

  function sendMessage(content: string, attachments: ChatAttachment[]) {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      attachments: attachments.length ? attachments : undefined,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "streaming",
      modelId,
    };
    const chatId = activeChat?.id ?? crypto.randomUUID();
    const nextOrder = Math.max(0, ...store.chats.map((chat) => chat.updatedAt)) + 1;
    const requestMessages = [...messages, userMessage];
    const nextMessages = [...requestMessages, assistantMessage];
    const nextChat: ChatThread = activeChat
      ? { ...activeChat, messages: nextMessages, updatedAt: nextOrder }
      : {
          id: chatId,
          title: makeChatTitle(content, attachments),
          modelId,
          messages: nextMessages,
          createdAt: nextOrder,
          updatedAt: nextOrder,
        };

    const didSave = saveChatStore({
      ...store,
      activeChatId: chatId,
      chats: activeChat
        ? store.chats.map((chat) => (chat.id === chatId ? nextChat : chat))
        : [nextChat, ...store.chats],
    });
    if (!didSave) {
      setError("Не хватает места для чатов. Удалите старые чаты или большое вложение.");
      setIsStorageError(true);
      return;
    }

    void runAssistantRequest({
      chatId,
      title: nextChat.title,
      modelId,
      messages: requestMessages,
      assistantId: assistantMessage.id,
    });
  }

  return (
    <>
      <main className="app-shell flex h-dvh min-h-130 overflow-hidden">
      <ChatSidebar
        chats={store.chats}
        activeChatId={store.activeChatId}
        isOpen={sidebarOpen}
        isBusy={isLoading}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
        onToggleFavoriteChat={toggleFavoriteChat}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="chat-header flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-5 lg:border-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Открыть список чатов"
            className="app-icon-button flex size-9 items-center justify-center rounded-lg lg:hidden"
          >
            <MenuIcon className="size-5" />
          </button>
          <div ref={headerActionsRef} className="chat-header-chat">
            <div className="min-w-0">
              {headerRenaming && activeChat ? (
                <input
                  ref={headerRenameRef}
                  className="chat-header-rename"
                  aria-label="Новое название чата"
                  value={headerRenameValue}
                  onChange={(event) => setHeaderRenameValue(event.target.value)}
                  onBlur={submitHeaderRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitHeaderRename();
                    if (event.key === "Escape") {
                      setHeaderRenameValue(activeChat.title);
                      setHeaderRenaming(false);
                    }
                  }}
                />
              ) : (
                <div className="chat-header-title truncate text-sm font-medium">
                  {activeChat?.title ?? "Новый чат"}
                </div>
              )}
              {activeChat ? (
                <div className="chat-header-model truncate text-[11px]">
                  {getModel(activeChat.modelId).title}
                </div>
              ) : null}
            </div>
            {activeChat && !headerRenaming ? (
              <button
                ref={headerMenuButtonRef}
                type="button"
                className="chat-header-menu-button"
                aria-label={`Действия с чатом «${activeChat.title}»`}
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
                aria-controls={headerMenuOpen ? headerMenuId : undefined}
                onClick={() => setHeaderMenuOpen((value) => !value)}
              >
                <ChevronDownIcon className="size-4" />
              </button>
            ) : null}
            {activeChat && headerMenuOpen ? (
              <ChatContextMenu
                id={headerMenuId}
                anchorRef={headerMenuButtonRef}
                menuRef={headerMenuRef}
                isFavorite={Boolean(activeChat.isFavorite)}
                onToggleFavorite={() => toggleFavoriteChat(activeChat.id)}
                onRename={() => {
                  setHeaderRenameValue(activeChat.title);
                  setHeaderRenaming(true);
                }}
                onDelete={() => setHeaderDeleteChatId(activeChat.id)}
                onClose={() => setHeaderMenuOpen(false)}
              />
            ) : null}
          </div>
        </header>

        <div
          className="chat-workspace flex min-h-0 flex-1 flex-col"
          data-empty={isEmptyChat}
        >
          <div
            ref={scrollRef}
            className="chat-message-scroll relative min-h-0 flex-1 overflow-y-auto"
          >
            <MessageList
              messages={messages}
              isLoading={loadingChatId === activeChat?.id}
              progressMessage={
                loadingChatId === activeChat?.id ? progressMessage : ""
              }
            />
          </div>

          <div className="chat-composer-dock composer-fade shrink-0 px-3 pb-3 pt-3 sm:px-6 sm:pb-5">
            <div className="chat-composer-width mx-auto w-full">
              {error ? (
                <div
                  className="chat-error mb-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
                  role="alert"
                >
                  <span>{error}</span>
                  {isStorageError ? (
                    <Link
                      href="/settings?tab=data"
                      className="chat-error-storage-action shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium"
                    >
                      Освободить место
                    </Link>
                  ) : canRetry && !isLoading ? (
                    <button
                      type="button"
                      onClick={retryLastRequest}
                      className="chat-error-retry shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium"
                    >
                      Повторить
                    </button>
                  ) : null}
                </div>
              ) : null}
              <ChatComposer
                key={activeChat?.id ?? "new-chat"}
                modelId={modelId}
                modelLocked={Boolean(activeChat?.messages.length)}
                onModelChange={changeDraftModel}
                onSend={sendMessage}
                onStop={stopRequest}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
        </section>
      </main>

      {headerDeleteChatId ? (
        <DeleteConfirmDialog
          onConfirm={() => {
            deleteChat(headerDeleteChatId);
            setHeaderDeleteChatId(null);
          }}
          onCancel={() => setHeaderDeleteChatId(null)}
        />
      ) : null}
    </>
  );
}
