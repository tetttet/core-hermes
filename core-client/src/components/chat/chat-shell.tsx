"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDownIcon, MenuIcon } from "@/components/icons";
import { AUTO_MODEL_ID, findModel, getModel } from "@/config/models";
import { ChatStreamError, consumeChatResponse, prepareApiMessages } from "@/lib/chat-stream";
import {
  deleteRemoteChat,
  loadRemoteChats,
  loadRemoteMessages,
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
  isAccountChat,
  saveChatStore,
  subscribeToChat,
} from "@/lib/chat-storage";
import { createChatTitle } from "@/lib/chat-title";
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
  webSearchEnabled: boolean;
};

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
  const t = useTranslations("Chat");
  const modelText = useTranslations("Models");
  const locale = useLocale();
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
  const [isChatListLoading, setIsChatListLoading] = useState(true);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const [nextChatsCursor, setNextChatsCursor] = useState<string | null>(null);
  const [chatListError, setChatListError] = useState("");
  const [chatListRetryNonce, setChatListRetryNonce] = useState(0);
  const [loadingOlderChatId, setLoadingOlderChatId] = useState<string | null>(
    null,
  );
  const [historyLoadFailedChatId, setHistoryLoadFailedChatId] = useState<
    string | null
  >(null);
  const [historyRetryNonce, setHistoryRetryNonce] = useState(0);
  const [messageCursors, setMessageCursors] = useState<
    Record<string, string | null>
  >({});
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
  const hydratingChatsRef = useRef(new Set<string>());
  const pendingPrependScrollRef = useRef<{
    chatId: string;
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const skipNextAutoScrollRef = useRef(false);
  const headerMenuId = useId();
  const visibleChats =
    auth.status === "authenticated"
      ? store.chats
      : store.chats.filter((chat) => !isAccountChat(chat));
  const activeChat = visibleChats.find((chat) => chat.id === store.activeChatId);
  const messages = activeChat?.messages ?? EMPTY_MESSAGES;
  const modelId = activeChat?.modelId ?? store.draftModelId;
  const isLoading = loadingChatId !== null;
  const needsRemoteHistory = Boolean(
    activeChat?.isSynced && activeChat.messagesLoaded === false,
  );
  const isChatHistoryLoading =
    needsRemoteHistory && historyLoadFailedChatId !== activeChat?.id;
  const isEmptyChat = messages.length === 0 && !isChatHistoryLoading;

  useEffect(() => {
    void initializeAuth();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (auth.status !== "authenticated") {
      syncedUserRef.current = null;
      queueMicrotask(() => {
        if (cancelled) return;
        setIsChatListLoading(false);
        setIsLoadingMoreChats(false);
        setNextChatsCursor(null);
        setChatListError("");
        setMessageCursors({});
      });
      return () => {
        cancelled = true;
      };
    }
    if (syncedUserRef.current === auth.user.id) return;
    const userId = auth.user.id;
    syncedUserRef.current = userId;

    const localChats = getChatSnapshot().chats;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsChatListLoading(true);
      setChatListError("");
    });
    void loadRemoteChats(localChats)
      .then((page) => {
        if (cancelled) return;
        const latestStore = getChatSnapshot();
        const accountChats = page.items.map((chat) => ({
          ...chat,
          ownerUserId: userId,
        }));
        const loadedIds = new Set(accountChats.map((chat) => chat.id));
        const newLocalChats = latestStore.chats.filter(
          (chat) =>
            !chat.isSynced &&
            (!chat.ownerUserId || chat.ownerUserId === userId) &&
            !loadedIds.has(chat.id),
        );
        const mergedChats = [...accountChats, ...newLocalChats];
        const activeChatId =
          latestStore.activeChatId &&
          mergedChats.some((chat) => chat.id === latestStore.activeChatId)
            ? latestStore.activeChatId
            : null;
        saveChatStore({ ...latestStore, chats: mergedChats, activeChatId });
        setNextChatsCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) {
          syncedUserRef.current = null;
          setChatListError(t("loadChatsError"));
        }
      })
      .finally(() => {
        if (!cancelled) setIsChatListLoading(false);
      });

    return () => {
      cancelled = true;
      if (syncedUserRef.current === userId) {
        syncedUserRef.current = null;
      }
    };
  }, [auth, chatListRetryNonce, t]);

  useEffect(() => {
    if (
      auth.status !== "authenticated" ||
      !activeChat?.isSynced ||
      activeChat.messagesLoaded !== false ||
      historyLoadFailedChatId === activeChat.id ||
      hydratingChatsRef.current.has(activeChat.id)
    ) {
      return;
    }

    const chatId = activeChat.id;
    hydratingChatsRef.current.add(chatId);
    void loadRemoteMessages(chatId, activeChat.messages)
      .then((page) => {
        const latestStore = getChatSnapshot();
        saveChatStore({
          ...latestStore,
          chats: latestStore.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, messages: page.items, messagesLoaded: true }
              : chat,
          ),
        });
        setMessageCursors((current) => ({
          ...current,
          [chatId]: page.nextCursor,
        }));
      })
      .catch(() => {
        setHistoryLoadFailedChatId(chatId);
        if (getChatSnapshot().activeChatId === chatId) {
          setError(t("loadHistoryError"));
        }
      })
      .finally(() => {
        hydratingChatsRef.current.delete(chatId);
      });
  }, [
    activeChat?.id,
    activeChat?.isSynced,
    activeChat?.messages,
    activeChat?.messagesLoaded,
    auth.status,
    historyLoadFailedChatId,
    historyRetryNonce,
    t,
  ]);

  useLayoutEffect(() => {
    const pending = pendingPrependScrollRef.current;
    const scroller = scrollRef.current;
    if (!pending || !scroller || pending.chatId !== activeChat?.id) return;

    scroller.scrollTop =
      pending.scrollTop + scroller.scrollHeight - pending.scrollHeight;
    pendingPrependScrollRef.current = null;
  }, [activeChat?.id, messages]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
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
    if (historyLoadFailedChatId === chatId) {
      setHistoryLoadFailedChatId(null);
      setHistoryRetryNonce((value) => value + 1);
    }
    const latestStore = getChatSnapshot();
    saveChatStore({ ...latestStore, activeChatId: chatId });
  }

  async function loadMoreChats() {
    if (
      auth.status !== "authenticated" ||
      !nextChatsCursor ||
      isLoadingMoreChats
    ) {
      return;
    }

    const cursor = nextChatsCursor;
    setIsLoadingMoreChats(true);
    setChatListError("");
    try {
      const latestStore = getChatSnapshot();
      const page = await loadRemoteChats(latestStore.chats, cursor);
      const afterRequestStore = getChatSnapshot();
      const existingIds = new Set(afterRequestStore.chats.map((chat) => chat.id));
      saveChatStore({
        ...afterRequestStore,
        chats: [
          ...afterRequestStore.chats,
          ...page.items
            .filter((chat) => !existingIds.has(chat.id))
            .map((chat) => ({ ...chat, ownerUserId: auth.user.id })),
        ],
      });
      setNextChatsCursor(page.nextCursor);
    } catch {
      setChatListError(t("loadMoreChatsError"));
    } finally {
      setIsLoadingMoreChats(false);
    }
  }

  function retryChatListLoad() {
    syncedUserRef.current = null;
    setChatListError("");
    setIsChatListLoading(true);
    setChatListRetryNonce((value) => value + 1);
  }

  async function loadOlderMessages() {
    if (!activeChat || loadingOlderChatId || !messageCursors[activeChat.id]) {
      return;
    }

    const chatId = activeChat.id;
    const cursor = messageCursors[chatId]!;
    const scroller = scrollRef.current;
    setLoadingOlderChatId(chatId);
    setError("");
    try {
      const page = await loadRemoteMessages(chatId, activeChat.messages, cursor);
      const latestStore = getChatSnapshot();
      const latestChat = latestStore.chats.find((chat) => chat.id === chatId);
      if (!latestChat) return;
      const existingIds = new Set(
        latestChat.messages.map((message) => message.id),
      );
      if (scroller && latestStore.activeChatId === chatId) {
        pendingPrependScrollRef.current = {
          chatId,
          scrollHeight: scroller.scrollHeight,
          scrollTop: scroller.scrollTop,
        };
        skipNextAutoScrollRef.current = true;
      }
      saveChatStore({
        ...latestStore,
        chats: latestStore.chats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...page.items.filter((message) => !existingIds.has(message.id)),
                  ...chat.messages,
                ],
                messagesLoaded: true,
              }
            : chat,
        ),
      });
      setMessageCursors((current) => ({
        ...current,
        [chatId]: page.nextCursor,
      }));
    } catch {
      setError(t("loadOlderError"));
    } finally {
      setLoadingOlderChatId(null);
    }
  }

  function retryHistoryLoad() {
    if (!activeChat || historyLoadFailedChatId !== activeChat.id) return;
    setError("");
    setHistoryLoadFailedChatId(null);
    setHistoryRetryNonce((value) => value + 1);
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
        setError(t("deleteRemoteError"));
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
        setError(t("renameRemoteError"));
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
        setError(t("favoriteRemoteError"));
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
    setProgressMessage(t("sending"));
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
          webSearchEnabled: pending.webSearchEnabled,
        },
        requestController.signal,
      );

      const result = await consumeChatResponse(response, {
        onDelta(_delta, fullContent) {
          accumulated = fullContent;
          if (!receivedFirstDelta) {
            receivedFirstDelta = true;
            setProgressMessage(t("receiving"));
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
          if (status.phase === "sending") {
            setProgressMessage(t("sending"));
          } else if (status.phase === "processing") {
            const attachments = pending.messages.at(-1)?.attachments ?? [];
            const processingKey = attachments.some(
              (attachment) => attachment.kind === "video",
            )
              ? "processingVideo"
              : attachments.some((attachment) => attachment.kind === "image")
                ? "processingImage"
                : "processing";
            setProgressMessage(t(processingKey));
          } else if (status.phase === "retrying") {
            setProgressMessage(t("retrying"));
          } else if (status.phase === "fallback") {
            setProgressMessage(t("fallback"));
          } else if (status.phase === "slow") {
            setProgressMessage(t("slow"));
          }
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
            ? {
                ...chat,
                isSynced: auth.status === "authenticated",
                ...(auth.status === "authenticated"
                  ? { ownerUserId: auth.user.id }
                  : {}),
                updatedAt: nextResponseOrder,
              }
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
          ? t("storageError")
          : locale === "ru" && requestError instanceof Error
            ? requestError.message
            : t("genericError");
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

  function sendMessage(
    content: string,
    attachments: ChatAttachment[],
    webSearchEnabled: boolean,
  ) {
    const sentAt = Date.now();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: sentAt,
      attachments: attachments.length ? attachments : undefined,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "streaming",
      modelId,
      createdAt: sentAt + 1,
    };
    const chatId = activeChat?.id ?? crypto.randomUUID();
    const nextOrder = Math.max(0, ...store.chats.map((chat) => chat.updatedAt)) + 1;
    const requestMessages = [...messages, userMessage];
    const nextMessages = [...requestMessages, assistantMessage];
    const nextChat: ChatThread = activeChat
      ? {
          ...activeChat,
          messages: nextMessages,
          ...(auth.status === "authenticated"
            ? { ownerUserId: auth.user.id }
            : {}),
          updatedAt: nextOrder,
        }
      : {
          id: chatId,
          title: createChatTitle(content, attachments),
          modelId,
          messages: nextMessages,
          ...(auth.status === "authenticated"
            ? { ownerUserId: auth.user.id }
            : {}),
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
      setError(t("chatStorageError"));
      setIsStorageError(true);
      return;
    }

    void runAssistantRequest({
      chatId,
      title: nextChat.title,
      modelId,
      messages: requestMessages,
      assistantId: assistantMessage.id,
      webSearchEnabled,
    });
  }

  return (
    <>
      <main className="app-shell flex h-dvh min-h-130 overflow-hidden">
        <ChatSidebar
          chats={visibleChats}
          activeChatId={activeChat?.id ?? null}
          isOpen={sidebarOpen}
          isBusy={isLoading}
          isLoadingChats={auth.status === "loading" || isChatListLoading}
          isLoadingMoreChats={isLoadingMoreChats}
          hasMoreChats={Boolean(nextChatsCursor)}
          chatListError={chatListError}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onNewChat={startNewChat}
          onSelectChat={selectChat}
          onDeleteChat={deleteChat}
          onRenameChat={renameChat}
          onToggleFavoriteChat={toggleFavoriteChat}
          onLoadMoreChats={() => void loadMoreChats()}
          onRetryChats={retryChatListLoad}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />

        <section className="flex min-w-0 flex-1 flex-col">
        <header className="chat-header h-14 shrink-0 border-b px-3 sm:px-5 lg:border-0">
          <div className="chat-header-start">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label={t("openChats")}
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
                    aria-label={t("newTitle")}
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
                    {activeChat?.title ?? t("newChat")}
                  </div>
                )}
                {activeChat ? (
                  <div className="chat-header-model truncate text-[11px]">
                    {activeChat.modelId === AUTO_MODEL_ID
                      ? modelText("autoTitle")
                      : getModel(activeChat.modelId).title}
                  </div>
                ) : null}
              </div>
              {activeChat && !headerRenaming ? (
                <button
                  ref={headerMenuButtonRef}
                  type="button"
                  className="chat-header-menu-button"
                  aria-label={t("chatActions", { title: activeChat.title })}
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
              isHistoryLoading={isChatHistoryLoading}
              hasOlderMessages={Boolean(
                activeChat && messageCursors[activeChat.id],
              )}
              isLoadingOlder={loadingOlderChatId === activeChat?.id}
              onLoadOlder={() => void loadOlderMessages()}
              progressMessage={
                loadingChatId === activeChat?.id ? progressMessage : ""
              }
              user={auth.status === "authenticated" ? auth.user : undefined}
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
                      {t("freeSpace")}
                    </Link>
                  ) : historyLoadFailedChatId === activeChat?.id ? (
                    <button
                      type="button"
                      onClick={retryHistoryLoad}
                      className="chat-error-retry shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium"
                    >
                      {t("retry")}
                    </button>
                  ) : canRetry && !isLoading ? (
                    <button
                      type="button"
                      onClick={retryLastRequest}
                      className="chat-error-retry shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium"
                    >
                      {t("retry")}
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
                disabled={needsRemoteHistory}
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
