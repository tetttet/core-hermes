"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";

export function LogoutConfirmDialog({
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}: {
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("LogoutDialog");
  const common = useTranslations("Common");
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  return (
    <div className="confirm-overlay" onClick={busy ? undefined : onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-title mb-1 text-base font-semibold text-foreground">
          {t("title")}
        </h2>
        <p id={descriptionId} className="confirm-desc mb-5 text-sm text-muted-soft">
          {t("description")}
        </p>
        {error ? <p className="auth-error mb-3" role="alert">{error}</p> : null}
        <div className="confirm-actions flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-btn confirm-btn-cancel px-4"
            onClick={onCancel}
            disabled={busy}
          >
            {common("cancel")}
          </button>
          <button
            type="button"
            className="confirm-btn confirm-btn-delete px-4"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t("confirming") : t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
