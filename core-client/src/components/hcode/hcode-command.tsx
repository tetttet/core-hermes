"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { writeToClipboard } from "@/lib/clipboard";

type CopyState = "idle" | "copied" | "error";

type HcodeCommandProps = {
  command: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  errorLabel: string;
};

export function HcodeCommand({
  command,
  label,
  copyLabel,
  copiedLabel,
  errorLabel,
}: HcodeCommandProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function copyCommand() {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    try {
      await writeToClipboard(command);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
      resetTimerRef.current = null;
    }, 1800);
  }

  const buttonLabel =
    copyState === "copied"
      ? copiedLabel
      : copyState === "error"
        ? errorLabel
        : copyLabel;

  return (
    <div className="hcode-command">
      <div className="hcode-command-bar">
        <span>{label}</span>
        <button type="button" onClick={copyCommand} aria-label={buttonLabel}>
          {copyState === "copied" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
          <span>{buttonLabel}</span>
        </button>
      </div>
      <pre><code>{command}</code></pre>
    </div>
  );
}
