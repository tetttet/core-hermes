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

const GENERIC_GREETINGS: Record<DayPeriod, string[]> = {
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

function personalizedGreetings(period: DayPeriod, user: GreetingUser) {
  const firstName = user.firstName.trim();
  const fullName = `${firstName} ${user.lastName.trim()}`.trim();

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

export function getWelcomeGreeting(date: Date, user?: GreetingUser) {
  const period = getDayPeriod(date.getHours());
  const greetings = user?.firstName.trim()
    ? personalizedGreetings(period, user)
    : GENERIC_GREETINGS[period];
  const timeSlot = Math.floor(date.getTime() / (15 * 60 * 1_000));
  return greetings[((timeSlot % greetings.length) + greetings.length) % greetings.length];
}
