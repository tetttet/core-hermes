"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { writeToClipboard } from "@/lib/clipboard";

type CopyMessageButtonProps = {
  content: string;
  subject?: "answer" | "message";
};

export function CopyMessageButton({
  content,
  subject = "answer",
}: CopyMessageButtonProps) {
  const t = useTranslations("Copy");
  const messageText = useTranslations("Messages");
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
      ? t("copied")
      : copyState === "error"
        ? t("failed")
        : t("copy");
  const subjectLabel = messageText(subject);

  return (
    <button
      type="button"
      className="message-copy-button"
      onClick={handleCopy}
      aria-label={`${label} ${subjectLabel}`}
      title={`${label} ${subjectLabel}`}
    >
      {copyState === "copied" ? (
        <CheckIcon className="message-copy-icon" />
      ) : (
        <CopyIcon className="message-copy-icon" />
      )}
    </button>
  );
}
