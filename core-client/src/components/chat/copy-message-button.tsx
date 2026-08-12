"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { writeToClipboard } from "@/lib/clipboard";

type CopyMessageButtonProps = {
  content: string;
  subject?: "ответ" | "сообщение";
};

export function CopyMessageButton({
  content,
  subject = "ответ",
}: CopyMessageButtonProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  async function handleCopy() {
    try {
      await writeToClipboard(content);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopyState("idle"), 2000);
  }

  const label =
    copyState === "copied"
      ? "Скопировано"
      : copyState === "error"
        ? "Не удалось"
        : "Копировать";

  return (
    <button
      type="button"
      className="message-copy-button"
      onClick={handleCopy}
      aria-label={`${label} ${subject}`}
      title={`${label} ${subject}`}
    >
      {copyState === "copied" ? (
        <CheckIcon className="message-copy-icon" />
      ) : (
        <CopyIcon className="message-copy-icon" />
      )}
    </button>
  );
}
