"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { findModel } from "@/config/models";
import {
  getWelcomeGreeting,
  type GreetingUser,
} from "@/lib/welcome-greeting";
import type { ChatMessage } from "@/types/chat";
import { AttachmentPreview } from "./attachment-preview";
import { CopyMessageButton } from "./copy-message-button";
import { MarkdownMessage } from "./markdown-message";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  isHistoryLoading?: boolean;
  hasOlderMessages?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
  progressMessage: string;
  user?: GreetingUser;
};

export function MessageList({
  messages,
  isLoading,
  isHistoryLoading = false,
  hasOlderMessages = false,
  isLoadingOlder = false,
  onLoadOlder,
  progressMessage,
  user,
}: MessageListProps) {
  const t = useTranslations("Messages");
  const locale = useLocale();
  const hasMessages = messages.length > 0;
  const greeting = useWelcomeGreeting(user, locale, t("defaultGreeting"));

  function localizedTimestamp(timestamp: number) {
    const formatted = formatMessageTimestamp(timestamp, locale);
    if (formatted.relative === "today") return t("today", { time: formatted.value });
    if (formatted.relative === "yesterday") return t("yesterday", { time: formatted.value });
    return formatted.value;
  }

  return (
    <>
      <div
        className="empty-chat-state pointer-events-none absolute inset-0 flex items-center justify-center px-6 pb-24 text-center"
        data-visible={!hasMessages && !isHistoryLoading}
        aria-hidden={hasMessages || isHistoryLoading}
      >
        <h1 className="empty-chat-title text-2xl font-serif tracking-[-0.025em] sm:text-[38px]">
          {greeting}
        </h1>
      </div>

      {isHistoryLoading && !hasMessages ? <MessageHistorySkeleton /> : null}

      {hasMessages ? (
        <div className="chat-message-list mx-auto w-full max-w-3xl space-y-7 px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
          {hasOlderMessages && onLoadOlder ? (
            <div className="flex justify-center">
              <button
                type="button"
                className="chat-load-older"
                disabled={isLoadingOlder}
                onClick={onLoadOlder}
              >
                {isLoadingOlder ? t("loading") : t("showEarlier")}
              </button>
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className="chat-message text-[15px] leading-7"
            >
              {message.role === "user" ? (
                <div className="user-message-group ml-auto w-fit max-w-[92%] sm:max-w-[85%]">
                  <div className="user-message rounded-2xl rounded-br-md p-2">
                    {message.attachments?.length ? (
                      <AttachmentPreview attachments={message.attachments} />
                    ) : null}
                    {message.content ? (
                      <div className="px-2 py-0.5">
                        <MarkdownMessage>{message.content}</MarkdownMessage>
                      </div>
                    ) : null}
                  </div>
                  <div className="user-message-meta" aria-label={t("messageActions")}>
                    {message.createdAt ? (
                      <time dateTime={new Date(message.createdAt).toISOString()}>
                        {localizedTimestamp(message.createdAt)}
                      </time>
                    ) : null}
                    {message.content ? (
                      <CopyMessageButton
                        content={message.content}
                        subject="message"
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="px-1">
                  {message.content ? (
                    <MarkdownMessage>{message.content}</MarkdownMessage>
                  ) : null}
                  {message.status === "streaming" && !message.content ? (
                    <TypingIndicator progressMessage={progressMessage} />
                  ) : null}
                  {message.status === "error" ? (
                    <p className="message-error mt-2 text-xs leading-5">
                      {message.content
                        ? t("partial")
                        : t("missing")}
                    </p>
                  ) : null}
                  {message.content && message.status !== "streaming" ? (
                    <div className="message-actions mt-1">
                      <CopyMessageButton content={message.content} />
                      {message.notice ? (
                        <span className="message-routing-notice">
                          {t("fallbackModel", { model: getRoutingModelName(message, t("otherModel")) })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          ))}

          {isLoading &&
          !messages.some((message) => message.status === "streaming") ? (
            <TypingIndicator progressMessage={progressMessage} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function useWelcomeGreeting(user: GreetingUser | undefined, locale: string, fallback: string) {
  const [greeting, setGreeting] = useState(fallback);

  useEffect(() => {
    const update = () =>
      setGreeting(getWelcomeGreeting(new Date(), user, locale, fallback));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [fallback, locale, user]);

  return greeting;
}

function formatMessageTimestamp(timestamp: number, locale: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDifference = Math.round(
    (startOfToday.getTime() - startOfMessageDay.getTime()) / 86_400_000,
  );

  if (dayDifference === 0) return { relative: "today" as const, value: time };
  if (dayDifference === 1) return { relative: "yesterday" as const, value: time };

  const calendarDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
  return { relative: null, value: `${calendarDate}, ${time}` };
}

function MessageHistorySkeleton() {
  const t = useTranslations("Messages");
  return (
    <div
      className="chat-history-skeleton mx-auto w-full max-w-3xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12"
      role="status"
      aria-label={t("loadingHistory")}
    >
      <div className="chat-history-skeleton-row chat-history-skeleton-row-user">
        <span className="chat-history-skeleton-line chat-history-skeleton-line-short" />
        <span className="chat-history-skeleton-line chat-history-skeleton-line-medium" />
      </div>
      <div className="chat-history-skeleton-row">
        <span className="chat-history-skeleton-line chat-history-skeleton-line-long" />
        <span className="chat-history-skeleton-line chat-history-skeleton-line-medium" />
        <span className="chat-history-skeleton-line chat-history-skeleton-line-short" />
      </div>
      <span className="sr-only">{t("loadingHistoryLong")}</span>
    </div>
  );
}

function getRoutingModelName(message: ChatMessage, fallback: string) {
  if (message.modelId) {
    const model = findModel(message.modelId);
    if (model) return model.title;
  }

  return message.notice ?? fallback;
}

function TypingIndicator({ progressMessage = "" }: { progressMessage?: string }) {
  const t = useTranslations("Messages");
  const label = progressMessage || t("thinking");

  return (
    <div
      className="flex items-center gap-2 px-1 py-2"
      role="status"
      aria-label={t("thinkingAria")}
    >
      <span className="typing-logo-wrap" aria-hidden="true">
        <Image
          src="/yahya.svg"
          alt=""
          width={28}
          height={28}
          unoptimized
          className="typing-logo"
        />
      </span>
      <span className="typing-label">{label}</span>
    </div>
  );
}
