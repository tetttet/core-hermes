"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { XIcon } from "@/components/icons";
import type { ChatAttachment } from "@/types/chat";

type AttachmentPreviewProps = {
  attachments: ChatAttachment[];
  onRemove?: (id: string) => void;
  compact?: boolean;
};

export function AttachmentPreview({
  attachments,
  onRemove,
  compact = false,
}: AttachmentPreviewProps) {
  const t = useTranslations("Composer");
  if (attachments.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "px-2 pt-2" : "mb-3"}`}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className={`group relative overflow-hidden rounded-xl border border-black/10 bg-[#e8e6e0] ${
            compact ? "h-16 w-20" : "h-36 w-44 max-w-full"
          }`}
        >
          {attachment.kind === "image" ? (
            <Image
              src={attachment.dataUrl}
              alt={attachment.name}
              fill
              unoptimized
              sizes={compact ? "80px" : "176px"}
              className="object-cover"
            />
          ) : (
            <video
              src={attachment.dataUrl}
              controls={!compact}
              muted={compact}
              playsInline
              preload="metadata"
              className="size-full object-cover"
              aria-label={attachment.name}
            />
          )}

          {compact ? (
            <div className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[9px] text-white">
              {attachment.name}
            </div>
          ) : null}

          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              aria-label={t("removeAttachment", { name: attachment.name })}
              className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
