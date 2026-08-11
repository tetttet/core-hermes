"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import {
  AUTO_MODEL_ID,
  MODELS,
  modelAccepts,
  type AttachmentKind,
  type ModelOption,
} from "@/config/models";

type ModelSelectorProps = {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  locked?: boolean;
  attachmentKinds?: readonly AttachmentKind[];
};

const SHORT_MODEL_TITLES: Record<string, string> = {
  [AUTO_MODEL_ID]: "Auto",
  "google/gemma-4-31b-it:free": "Gemma 4",
  "google/gemma-4-26b-a4b-it:free": "Gemma 4 Fast",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": "Nemotron Omni",
  "nvidia/nemotron-nano-12b-v2-vl:free": "Nemotron Vision",
  "openrouter/free": "Auto Free",
  "nvidia/nemotron-3-ultra-550b-a55b:free": "Nemotron Ultra",
  "inclusionai/ling-3.0-flash:free": "Ling Flash",
  "poolside/laguna-s-2.1:free": "Laguna",
  "nvidia/nemotron-3-super-120b-a12b:free": "Nemotron Super",
};

const SHORT_MODEL_DESCRIPTIONS: Record<string, string> = {
  [AUTO_MODEL_ID]: "Сам выберет лучшую модель",
  "google/gemma-4-31b-it:free": "Фото и документы",
  "google/gemma-4-26b-a4b-it:free": "Быстрый анализ фото и видео",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free":
    "Сложные визуальные задачи",
  "nvidia/nemotron-nano-12b-v2-vl:free": "Распознавание деталей",
  "openrouter/free": "Бесплатный автоматический выбор",
  "nvidia/nemotron-3-ultra-550b-a55b:free": "Глубокий анализ и логика",
  "inclusionai/ling-3.0-flash:free": "Быстрые ответы и переводы",
  "poolside/laguna-s-2.1:free": "Код и технические задачи",
  "nvidia/nemotron-3-super-120b-a12b:free":
    "Баланс скорости и качества",
};

function shortModelTitle(model: ModelOption) {
  return SHORT_MODEL_TITLES[model.id] ?? model.title;
}

function shortModelDescription(model: ModelOption) {
  return SHORT_MODEL_DESCRIPTIONS[model.id] ?? model.description;
}

function ModelItem({
  model,
  selected,
  recommended,
  onSelect,
}: {
  model: ModelOption;
  selected: boolean;
  recommended?: boolean;
  onSelect: (modelId: string) => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={() => onSelect(model.id)}
      className="model-menu-item group/item flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold leading-5">
            {shortModelTitle(model)}
          </span>
          {recommended ? (
            <span className="model-recommended-tag shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em]">
              Совет
            </span>
          ) : null}
        </span>
        <span className="model-menu-description mt-0.5 block text-[11px] leading-[15px]">
          {shortModelDescription(model)}
        </span>
      </span>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        {selected ? <CheckIcon className="size-4" /> : null}
      </span>
    </button>
  );
}

export function ModelSelector({
  value,
  onChange,
  disabled,
  locked,
  attachmentKinds = [],
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const availableModels = MODELS.filter((model) =>
    attachmentKinds.every((kind) => modelAccepts(model.id, kind)),
  );
  const featuredModels = availableModels.filter((model) => model.recommended);
  const otherModels = availableModels.filter((model) => !model.recommended);
  const selectedModel =
    availableModels.find((model) => model.id === value) ?? availableModels[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsOtherOpen(false);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsOtherOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectModel(nextModelId: string) {
    onChange(nextModelId);
    setIsOpen(false);
    setIsOtherOpen(false);
  }

  if (!selectedModel) return null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={locked ? "Модель закреплена за этим чатом" : "Выбрать модель"}
        onClick={() => {
          setIsOpen((current) => !current);
          setIsOtherOpen(false);
        }}
        className="model-selector flex h-8 max-w-[180px] cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-medium outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate">{shortModelTitle(selectedModel)}</span>
        <ChevronDownIcon
          className={`size-4 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Выбор модели"
          className="model-menu absolute bottom-full left-0 z-50 mb-2 w-[min(310px,calc(100vw_-_32px))] rounded-2xl border p-1.5 shadow-2xl"
          onMouseLeave={() => setIsOtherOpen(false)}
        >
          <div className="model-menu-label px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
            Лучшие модели
          </div>
          {featuredModels.map((model, index) => (
            <ModelItem
              key={model.id}
              model={model}
              selected={model.id === value}
              recommended={index === 0}
              onSelect={selectModel}
            />
          ))}

          {otherModels.length ? (
            <div
              className="model-other-menu relative mt-1 border-t pt-1"
              onMouseEnter={() => setIsOtherOpen(true)}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isOtherOpen}
                onClick={() => setIsOtherOpen((current) => !current)}
                className="model-menu-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-5">
                    Другие модели
                  </span>
                  <span className="model-menu-description block text-[11px] leading-4">
                    Ещё {otherModels.length} вариантов
                  </span>
                </span>
                <ChevronDownIcon className="size-4 shrink-0 -rotate-90" />
              </button>

              {isOtherOpen ? (
                <div className="model-submenu sm:absolute sm:bottom-0 sm:left-full sm:w-[310px] sm:pl-2">
                  <div
                    role="menu"
                    aria-label="Другие модели"
                    className="model-menu mt-1 max-h-[240px] overflow-y-auto rounded-2xl border p-1.5 shadow-2xl sm:mt-0"
                  >
                    {otherModels.map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        selected={model.id === value}
                        onSelect={selectModel}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
