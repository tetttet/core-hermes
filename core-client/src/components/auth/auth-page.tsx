"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  initializeAuth,
  signIn,
  signUp,
  subscribeToAuth,
} from "@/lib/auth-store";

type AuthMode = "signin" | "signup";

type SignUpData = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  age: string;
  discovery: string;
  goal: string;
  frequency: string;
};

const INITIAL_SIGN_UP: SignUpData = {
  email: "",
  password: "",
  confirmPassword: "",
  firstName: "",
  lastName: "",
  age: "",
  discovery: "",
  goal: "",
  frequency: "",
};

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const auth = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );

  useEffect(() => {
    void initializeAuth();
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") router.replace("/");
  }, [auth.status, router]);

  return (
    <main className="auth-page" data-mode={mode}>
      <section className="auth-form-panel">
        <div className="auth-form-inner">
          <Link href="/" className="auth-brand" aria-label="Hermes — на главную">
            <Image src="/yahya.svg" alt="" width={30} height={30} unoptimized />
            <span>Hermes</span>
          </Link>
          {mode === "signin" ? (
            <SignInForm onSuccess={() => router.replace("/")} />
          ) : (
            <SignUpForm onSuccess={() => router.replace("/")} />
          )}
        </div>
      </section>

      <aside className="auth-art-panel" aria-hidden="true">
        <Image
          src={mode === "signin" ? "/auth-sign-in.webp" : "/auth-sign-up.webp"}
          alt=""
          fill
          priority
          sizes="(max-width: 820px) 100vw, 50vw"
          className="auth-art-image"
        />
        <div className="auth-art-scrim" />
        <div className="auth-art-copy">
          <span>{mode === "signin" ? "Продолжайте мысль" : "Начните с вопроса"}</span>
          <p>
            {mode === "signin"
              ? "Ваши диалоги и идеи снова рядом."
              : "Создайте пространство для работы, поиска и новых идей."}
          </p>
        </div>
      </aside>
    </main>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      onSuccess();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form-content">
      <div className="auth-heading">
        <div className="auth-kicker">Вход</div>
        <h1>С возвращением</h1>
        <p>Войдите, чтобы продолжить работу без гостевых ограничений.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <AuthField label="Email" htmlFor="signin-email">
          <input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </AuthField>
        <AuthField label="Пароль" htmlFor="signin-password">
          <input
            id="signin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Введите пароль"
            required
          />
        </AuthField>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <button type="submit" className="auth-primary-button" disabled={submitting}>
          {submitting ? "Входим…" : "Войти"}
        </button>
      </form>
      <p className="auth-switch">
        Нет аккаунта? <Link href="/sign-up">Создать аккаунт</Link>
      </p>
    </div>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(INITIAL_SIGN_UP);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update<Key extends keyof SignUpData>(key: Key, value: SignUpData[Key]) {
    setData((current) => ({ ...current, [key]: value }));
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (!data.email.trim()) return "Введите email";
      if (data.password.length < 10) return "Пароль должен содержать минимум 10 символов";
      if (data.password !== data.confirmPassword) return "Пароли не совпадают";
    }
    if (step === 2) {
      const age = Number(data.age);
      if (!data.firstName.trim() || !data.lastName.trim()) return "Заполните имя и фамилию";
      if (!Number.isInteger(age) || age < 13 || age > 120) return "Укажите корректный возраст";
    }
    return "";
  }

  function nextStep() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStep((current) => Math.min(3, current + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      nextStep();
      return;
    }
    if (!data.discovery || !data.goal || !data.frequency) {
      setError("Ответьте на три коротких вопроса");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await signUp({
        email: data.email.trim(),
        password: data.password,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        age: Number(data.age),
        survey: [
          { questionKey: "discovery_source", answer: data.discovery },
          { questionKey: "primary_goal", answer: data.goal },
          { questionKey: "usage_frequency", answer: data.frequency },
        ],
      });
      onSuccess();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Не удалось создать аккаунт",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const headings = [
    ["Ваш аккаунт", "Начните с email и надёжного пароля."],
    ["Расскажите о себе", "Это поможет сделать профиль понятным и живым."],
    ["Последний шаг", "Три коротких ответа — и всё готово."],
  ] as const;
  const heading = headings[step - 1]!;

  return (
    <div className="auth-form-content auth-signup-content">
      <div className="auth-heading">
        <div className="auth-kicker">Регистрация · шаг {step} из 3</div>
        <h1>{heading[0]}</h1>
        <p>{heading[1]}</p>
      </div>
      <div className="auth-progress" aria-label={`Шаг ${step} из 3`}>
        {[1, 2, 3].map((item) => (
          <span key={item} data-active={item <= step} />
        ))}
      </div>
      <form className="auth-form" onSubmit={submit}>
        {step === 1 ? (
          <>
            <AuthField label="Email" htmlFor="signup-email">
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={data.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="you@example.com"
                required
              />
            </AuthField>
            <div className="auth-field-row">
              <AuthField label="Пароль" htmlFor="signup-password">
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={data.password}
                  onChange={(event) => update("password", event.target.value)}
                  placeholder="Минимум 10 символов"
                  required
                />
              </AuthField>
              <AuthField label="Повторите пароль" htmlFor="signup-confirm">
                <input
                  id="signup-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={data.confirmPassword}
                  onChange={(event) => update("confirmPassword", event.target.value)}
                  placeholder="Ещё раз"
                  required
                />
              </AuthField>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="auth-field-row">
              <AuthField label="Имя" htmlFor="signup-first-name">
                <input
                  id="signup-first-name"
                  autoComplete="given-name"
                  value={data.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                  placeholder="Имя"
                  required
                />
              </AuthField>
              <AuthField label="Фамилия" htmlFor="signup-last-name">
                <input
                  id="signup-last-name"
                  autoComplete="family-name"
                  value={data.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                  placeholder="Фамилия"
                  required
                />
              </AuthField>
            </div>
            <AuthField label="Возраст" htmlFor="signup-age">
              <input
                id="signup-age"
                type="number"
                inputMode="numeric"
                min={13}
                max={120}
                value={data.age}
                onChange={(event) => update("age", event.target.value)}
                placeholder="Например, 24"
                required
              />
            </AuthField>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <AuthSelect
              id="signup-discovery"
              label="Откуда вы узнали о Hermes?"
              value={data.discovery}
              onChange={(value) => update("discovery", value)}
              options={["Поиск", "Социальные сети", "От друзей", "Другое"]}
            />
            <AuthSelect
              id="signup-goal"
              label="Главная цель использования"
              value={data.goal}
              onChange={(value) => update("goal", value)}
              options={["Работа", "Учёба", "Программирование", "Личные задачи"]}
            />
            <AuthSelect
              id="signup-frequency"
              label="Как часто планируете пользоваться?"
              value={data.frequency}
              onChange={(value) => update("frequency", value)}
              options={["Каждый день", "Несколько раз в неделю", "Иногда"]}
            />
          </>
        ) : null}

        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <div className="auth-form-actions">
          {step > 1 ? (
            <button
              type="button"
              className="auth-secondary-button"
              onClick={() => {
                setError("");
                setStep((current) => current - 1);
              }}
            >
              Назад
            </button>
          ) : null}
          <button type="submit" className="auth-primary-button" disabled={submitting}>
            {submitting ? "Создаём…" : step === 3 ? "Создать аккаунт" : "Продолжить"}
          </button>
        </div>
      </form>
      <p className="auth-switch">
        Уже есть аккаунт? <Link href="/sign-in">Войти</Link>
      </p>
    </div>
  );
}

function AuthField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="auth-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function AuthSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="" disabled>Выберите вариант</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
