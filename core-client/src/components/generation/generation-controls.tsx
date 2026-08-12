"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ImageIcon,
  SlidersIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_MODELS,
  IMAGE_STYLES,
  type ImageAspectRatio,
  type ImageModelId,
  type ImageQuality,
  type ImageStyleId,
} from "@/lib/image-generation";

type GenerationControlsProps = {
  prompt: string;
  model: ImageModelId;
  style: ImageStyleId;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  seed: string;
  maxPromptLength: number;
  isGenerating: boolean;
  onPromptChange: (value: string) => void;
  onModelChange: (value: ImageModelId) => void;
  onStyleChange: (value: ImageStyleId) => void;
  onAspectRatioChange: (value: ImageAspectRatio) => void;
  onQualityChange: (value: ImageQuality) => void;
  onSeedChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ComposerSelect({
  label,
  value,
  disabled,
  icon,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  icon: ReactNode;
  options: Array<{ value: string; label: string; description?: string }>;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="generation-composer-select" ref={rootRef} data-open={isOpen}>
      <button
        type="button"
        className="generation-composer-select-trigger"
        aria-label={`${label}: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="generation-composer-select-icon" aria-hidden="true">{icon}</span>
        <span>{selected.label}</span>
        <ChevronDownIcon className="size-4" />
      </button>
      {isOpen ? (
        <div className="generation-composer-menu" role="listbox" aria-label={label}>
          <div className="generation-composer-menu-title">{label}</div>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              <span className="generation-composer-menu-check">
                {option.value === value ? <CheckIcon className="size-4" /> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function GenerationControls({
  prompt,
  model,
  style,
  aspectRatio,
  quality,
  seed,
  maxPromptLength,
  isGenerating,
  onPromptChange,
  onModelChange,
  onStyleChange,
  onAspectRatioChange,
  onQualityChange,
  onSeedChange,
  onSubmit,
}: GenerationControlsProps) {
  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form
      id="generation-controls"
      className="generation-composer"
      onSubmit={onSubmit}
    >
      <div className="generation-composer-inner">
        <div className="generation-composer-input-row">
          <textarea
            id="generation-prompt"
            aria-label="Промпт"
            value={prompt}
            maxLength={maxPromptLength}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder="Опишите изображение: сюжет, композицию, свет, цвета и детали…"
            rows={2}
            disabled={isGenerating}
          />
          <button
            type="submit"
            className="generation-composer-submit"
            disabled={isGenerating || !prompt.trim()}
            aria-label={isGenerating ? "Изображение создаётся" : "Создать изображение"}
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <Image
                src="/yahya.svg"
                alt=""
                width={21}
                height={21}
                unoptimized
                className="generation-composer-logo"
              />
            ) : (
              <ArrowUpIcon className="size-5" />
            )}
          </button>
        </div>

        <div className="generation-composer-toolbar">
          <div className="generation-composer-options">
            <ComposerSelect
              label="Модель"
              value={model}
              disabled={isGenerating}
              icon={<SparklesIcon className="size-4" />}
              options={IMAGE_MODELS.map((item) => ({
                value: item.id,
                label: item.name,
                description: item.description,
              }))}
              onChange={(value) => onModelChange(value as ImageModelId)}
            />

            <ComposerSelect
              label="Формат"
              value={aspectRatio}
              disabled={isGenerating}
              icon={<ImageIcon className="size-4" />}
              options={IMAGE_ASPECT_RATIOS.map((item) => ({
                value: item.id,
                label: `${item.id} · ${item.name}`,
                description: `${item.width} × ${item.height}`,
              }))}
              onChange={(value) => onAspectRatioChange(value as ImageAspectRatio)}
            />

            <ComposerSelect
              label="Стиль"
              value={style}
              disabled={isGenerating}
              icon={<SlidersIcon className="size-4" />}
              options={IMAGE_STYLES.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(value) => onStyleChange(value as ImageStyleId)}
            />

            <ComposerSelect
              label="Качество"
              value={quality}
              disabled={isGenerating}
              icon={<span className="generation-quality-mark">HD</span>}
              options={[
                { value: "standard", label: "Стандарт", description: "20 шагов" },
                { value: "high", label: "Высокое", description: "28 шагов" },
              ]}
              onChange={(value) => onQualityChange(value as ImageQuality)}
            />

            <label className="generation-composer-seed">
              <span>Seed</span>
              <input
                aria-label="Seed"
                value={seed}
                maxLength={32}
                onChange={(event) => onSeedChange(event.target.value)}
                placeholder="случайный"
                disabled={isGenerating}
              />
            </label>
          </div>

          <span className="generation-composer-counter">
            {prompt.length} / {maxPromptLength}
          </span>
        </div>
      </div>
      <p className="generation-composer-note">
        Enter — создать · Shift + Enter — новая строка · результаты сохраняются локально
      </p>
    </form>
  );
}
