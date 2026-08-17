"use client";

import hljs from "highlight.js/lib/common";
import { useTranslations } from "next-intl";
import {
  isValidElement,
  memo,
  type ComponentPropsWithoutRef,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { writeToClipboard } from "@/lib/clipboard";

type MarkdownMessageProps = {
  children: string;
};

function normalizeMathDelimiters(markdown: string) {
  let fenceMarker: "`" | "~" | null = null;
  let fenceLength = 0;

  return markdown
    .split("\n")
    .map((line) => {
      const fenceMatch = /^(?: {0,3})(`{3,}|~{3,})/.exec(line);

      if (fenceMatch) {
        const marker = fenceMatch[1][0] as "`" | "~";
        const length = fenceMatch[1].length;

        if (fenceMarker === null) {
          fenceMarker = marker;
          fenceLength = length;
        } else if (marker === fenceMarker && length >= fenceLength) {
          fenceMarker = null;
          fenceLength = 0;
        }

        return line;
      }

      if (fenceMarker !== null) return line;

      let normalized = "";
      let index = 0;

      while (index < line.length) {
        if (line[index] === "`") {
          let tickCount = 1;
          while (line[index + tickCount] === "`") tickCount += 1;

          const delimiter = "`".repeat(tickCount);
          const closingIndex = line.indexOf(delimiter, index + tickCount);

          if (closingIndex !== -1) {
            normalized += line.slice(index, closingIndex + tickCount);
            index = closingIndex + tickCount;
            continue;
          }
        }

        const isLatexDelimiter =
          line[index] === "\\" &&
          line[index - 1] !== "\\" &&
          ["(", ")", "[", "]"].includes(line[index + 1]);

        if (isLatexDelimiter) {
          normalized += line[index + 1] === "(" || line[index + 1] === ")" ? "$" : "$$";
          index += 2;
          continue;
        }

        normalized += line[index];
        index += 1;
      }

      return normalized;
    })
    .join("\n");
}

const sanitizeSchema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target"],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-[\w-]+$/],
    ],
  },
};

function SafeLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);

  return (
    <a
      {...props}
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer noopener" : undefined}
    >
      {children}
    </a>
  );
}

const languageNames: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cpp: "C++",
  cs: "C#",
  csharp: "C#",
  css: "CSS",
  go: "Go",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  md: "Markdown",
  markdown: "Markdown",
  php: "PHP",
  plaintext: "Text",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  ruby: "Ruby",
  rust: "Rust",
  scss: "SCSS",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  text: "Text",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return "";
}

function getCodeLanguage(node: ReactNode) {
  if (!isValidElement<{ className?: string }>(node)) return undefined;
  return /(?:^|\s)language-([\w-]+)/.exec(node.props.className ?? "")?.[1]?.toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type CodeBlockProps = {
  code: string;
  language?: string;
};

const CodeBlock = memo(function CodeBlock({ code, language }: CodeBlockProps) {
  const t = useTranslations("Copy");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightedCode = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return escapeHtml(code);
    }
  }, [code, language]);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  async function handleCopy() {
    try {
      await writeToClipboard(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopyState("idle"), 2000);
  }

  const languageLabel = language
    ? (["plaintext", "text"].includes(language)
        ? t("text")
        : languageNames[language] ?? language.toUpperCase())
    : t("code");
  const copyLabel =
    copyState === "copied"
      ? t("copied")
      : copyState === "error"
        ? t("failed")
        : t("copy");

  return (
    <figure className="code-block">
      <figcaption className="code-block__toolbar">
        <span className="code-block__language">{languageLabel}</span>
        <button
          type="button"
          className="code-block__copy"
          onClick={handleCopy}
          aria-label={`${copyLabel}: ${languageLabel}`}
        >
          {copyState === "copied" ? (
            <CheckIcon className="code-block__copy-icon" />
          ) : (
            <CopyIcon className="code-block__copy-icon" />
          )}
          <span className="sr-only" aria-live="polite">
            {copyLabel}
          </span>
        </button>
      </figcaption>
      <div className="code-block__scroller">
        <pre>
          <code
            className={`hljs${language ? ` language-${language}` : ""}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </figure>
  );
});

function MarkdownPre({ children }: ComponentPropsWithoutRef<"pre">) {
  const code = getNodeText(children).replace(/\n$/, "");
  return <CodeBlock code={code} language={getCodeLanguage(children)} />;
}

export const MarkdownMessage = memo(function MarkdownMessage({
  children,
}: MarkdownMessageProps) {
  const normalizedMarkdown = useMemo(
    () => normalizeMathDelimiters(children),
    [children],
  );

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        components={{
          a: SafeLink,
          pre: MarkdownPre,
          input: (props) => <input {...props} disabled />,
          table: ({ children: tableChildren, ...props }) => (
            <div className="markdown-table-wrap">
              <table {...props}>{tableChildren}</table>
            </div>
          ),
        }}
      >
        {normalizedMarkdown}
      </ReactMarkdown>
    </div>
  );
});
