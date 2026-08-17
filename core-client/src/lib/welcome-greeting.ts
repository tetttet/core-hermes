export type GreetingUser = {
  firstName: string;
  lastName: string;
};

type DayPeriod = "morning" | "day" | "evening" | "night";

function getDayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 23) return "evening";
  return "night";
}

const GENERIC_GREETINGS_RU: Record<DayPeriod, string[]> = {
  morning: [
    "Доброе утро! Начнём?",
    "Доброе утро! Чем могу помочь?",
    "Есть идеи на утро?",
  ],
  day: [
    "Добрый день! Чем помочь?",
    "Что важного сделаем сегодня?",
    "Готов помочь. Начнём?",
  ],
  evening: [
    "Добрый вечер! Начнём?",
    "Чем помочь сегодня вечером?",
    "Завершим день с пользой?",
  ],
  night: [
    "Ещё не спите? Помочь?",
    "Я рядом. Чем помочь?",
    "Поздняя идея? Запишем?",
  ],
};

const GENERIC_GREETINGS_EN: Record<DayPeriod, string[]> = {
  morning: ["Good morning! Shall we start?", "Good morning! How can I help?", "Any ideas for this morning?"],
  day: ["Good afternoon! How can I help?", "What should we get done today?", "Ready when you are. Shall we start?"],
  evening: ["Good evening! Shall we start?", "How can I help this evening?", "Let’s end the day well."],
  night: ["Still awake? How can I help?", "I’m here. How can I help?", "A late-night idea? Let’s capture it."],
};

function personalizedGreetings(period: DayPeriod, user: GreetingUser, locale: string) {
  const firstName = user.firstName.trim();
  const fullName = `${firstName} ${user.lastName.trim()}`.trim();

  if (locale === "en") {
    const greetings: Record<DayPeriod, string[]> = {
      morning: [`Good morning, ${firstName}!`, "Good morning! How can I help?", `${firstName}, what’s the plan?`, `${fullName}, shall we start?`],
      day: [`Good afternoon, ${firstName}!`, "What should we get done today?", `${firstName}, where should we start?`, `${fullName}, I’m ready to help.`],
      evening: [`Good evening, ${firstName}!`, "Let’s end the day well.", `${firstName}, how can I help?`, `${fullName}, good to see you.`],
      night: [`${firstName}, still awake?`, "A late-night idea? Let’s capture it.", `I’m here, ${firstName}.`, `${fullName}, I’m ready to help.`],
    };
    return greetings[period];
  }

  const greetings: Record<DayPeriod, string[]> = {
    morning: [
      `Доброе утро, ${firstName}!`,
      "Доброе утро! Чем могу помочь?",
      `${firstName}, какие планы?`,
      `${fullName}, начнём?`,
    ],
    day: [
      `Добрый день, ${firstName}!`,
      "Что важного сделаем сегодня?",
      `${firstName}, с чего начнём?`,
      `${fullName}, я готов помочь.`,
    ],
    evening: [
      `Добрый вечер, ${firstName}!`,
      "Завершим день с пользой?",
      `${firstName}, чем помочь?`,
      `${fullName}, рад вас видеть.`,
    ],
    night: [
      `${firstName}, ещё не спите?`,
      "Поздняя идея? Запишем?",
      `Я рядом, ${firstName}.`,
      `${fullName}, я готов помочь.`,
    ],
  };

  return greetings[period];
}

export function getWelcomeGreeting(date: Date, user?: GreetingUser, locale = "ru") {
  const period = getDayPeriod(date.getHours());
  const greetings = user?.firstName.trim()
    ? personalizedGreetings(period, user, locale)
    : locale === "en"
      ? GENERIC_GREETINGS_EN[period]
      : GENERIC_GREETINGS_RU[period];
  const timeSlot = Math.floor(date.getTime() / (15 * 60 * 1_000));
  return greetings[((timeSlot % greetings.length) + greetings.length) % greetings.length];
}
