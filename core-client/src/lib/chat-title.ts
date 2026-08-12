import type { ChatAttachment } from "@/types/chat";

const MAX_TITLE_LENGTH = 54;

const INTRO_PATTERNS = [
  /^(?:привет|здравствуй(?:те)?|доброе утро|добрый день|добрый вечер)[\s!,.—–-]*/iu,
  /^(?:пожалуйста[\s,]*)?(?:помоги(?:те)?(?:\s+мне)?|помочь(?:\s+мне)?|можешь(?:\s+ли)?(?:\s+ты)?|мог(?:ла|ли)?\s+бы\s+ты)[\s,:—–-]+/iu,
  /^(?:я\s+хочу|мне\s+нужно|нужно)(?:[\s,]+чтобы\s+ты)?[\s,:—–-]+/iu,
  /^(?:please\s+)?(?:help\s+me|can\s+you|could\s+you|i\s+(?:want|need)\s+you\s+to)[\s,:—–-]+/iu,
];

function cleanPrompt(content: string) {
  let result = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/giu, (url) => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })
    .replace(/^[#>*_`~\s-]+/u, "")
    .replace(/\s+/g, " ")
    .trim();

  for (let pass = 0; pass < 2; pass += 1) {
    for (const pattern of INTRO_PATTERNS) result = result.replace(pattern, "");
  }

  const sentence = result.match(/^(.+?)(?:[.!?](?:\s|$)|$)/u)?.[1]?.trim();
  return (sentence || result)
    .replace(/^["'«„“]+|["'»“”.,!?;:—–-]+$/gu, "")
    .trim();
}

function truncateAtWord(value: string) {
  if (value.length <= MAX_TITLE_LENGTH) return value;

  const shortened = value.slice(0, MAX_TITLE_LENGTH - 1);
  const lastSpace = shortened.lastIndexOf(" ");
  const safeCut = lastSpace >= 30 ? shortened.slice(0, lastSpace) : shortened;
  return `${safeCut.trim()}…`;
}

function capitalize(value: string) {
  if (!value) return value;
  return value.slice(0, 1).toLocaleUpperCase("ru-RU") + value.slice(1);
}

export function createChatTitle(
  content: string,
  attachments: ChatAttachment[],
) {
  const cleaned = cleanPrompt(content);
  if (cleaned) return truncateAtWord(capitalize(cleaned));

  if (attachments.length > 1) return `Разбор ${attachments.length} файлов`;
  if (attachments[0]?.name) {
    return truncateAtWord(`Разбор ${attachments[0].name}`);
  }

  return "Новый чат";
}
