import { Router, type Request, type Response } from "express";
import type { QueryResult, QueryResultRow } from "pg";
import type { AppContext } from "../context.js";
import type { Profile } from "../lib/cache.js";
import { cookieTransportOptions } from "../lib/cookie-options.js";
import { canonicalEmail, cleanString, boundedInteger } from "../lib/validation.js";
import { fixedWindowLimit } from "../middleware/fixed-window.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPassword, verifyPassword } from "../services/passwords.js";

type UserRow = {
  id: string;
  email: string;
  password_hash?: string;
  first_name: string;
  last_name: string;
  age: number;
  created_at: Date;
  last_active_at: Date;
};

function profile(row: UserRow): Profile {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    age: row.age,
    createdAt: row.created_at.toISOString(),
    lastActiveAt: row.last_active_at.toISOString(),
  };
}

function cookieBase(request: Request, context: AppContext, path = "/") {
  return {
    httpOnly: true,
    path,
    ...cookieTransportOptions(request, context.config),
  };
}

function setAuthCookies(
  response: Response,
  request: Request,
  context: AppContext,
  accessToken: string,
  refreshToken: string,
) {
  const base = cookieBase(request, context);
  response.cookie("access_token", accessToken, {
    ...base,
    maxAge: context.config.accessTokenCookieTtlMs,
  });
  response.cookie("refresh_token", refreshToken, {
    ...cookieBase(request, context, "/api/auth"),
    maxAge: context.config.refreshTokenTtlDays * 86_400_000,
  });
}

function clearAuthCookies(response: Response, request: Request, context: AppContext) {
  response.clearCookie("access_token", cookieBase(request, context));
  response.clearCookie("refresh_token", cookieBase(request, context, "/api/auth"));
}

type Queryable = {
  query<R extends QueryResultRow = never>(config: object): Promise<QueryResult<R>>;
};

async function insertRefreshToken(
  client: Queryable,
  userId: string,
  refresh: ReturnType<AppContext["tokens"]["createRefreshToken"]>,
) {
  await client.query({
    name: "refresh-token-insert",
    text: `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
           VALUES ($1, $2, $3, $4)`,
    values: [refresh.id, userId, refresh.hash, refresh.expiresAt],
  });
}

function surveyAnswers(value: unknown) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return undefined;
  const answers = value.map((item) => {
    if (!item || typeof item !== "object") return undefined;
    const record = item as Record<string, unknown>;
    const questionKey = cleanString(record.questionKey, 64);
    const answer = cleanString(record.answer, 500);
    return questionKey && answer ? { questionKey, answer } : undefined;
  });
  if (answers.some((answer) => !answer)) return undefined;
  const typed = answers as Array<{ questionKey: string; answer: string }>;
  return new Set(typed.map((answer) => answer.questionKey)).size === typed.length
    ? typed
    : undefined;
}

export function authRouter(context: AppContext) {
  const router = Router();
  const authLimit = fixedWindowLimit({ maximum: 10, windowMs: 15 * 60 * 1_000 });

  router.post("/register", authLimit, async (request, response) => {
    const email = canonicalEmail(request.body?.email);
    const password = cleanString(request.body?.password, 200, 10);
    const firstName = cleanString(request.body?.firstName, 80);
    const lastName = cleanString(request.body?.lastName, 80);
    const age = boundedInteger(request.body?.age, 13, 120);
    const survey = surveyAnswers(request.body?.survey);
    if (!email || !password || !firstName || !lastName || !age || !survey) {
      response.status(400).json({
        error: "Проверьте email, пароль (минимум 10 символов), профиль и 2–3 ответа опросника",
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    const refresh = context.tokens.createRefreshToken();
    try {
      const inserted = await context.database.query<UserRow>({
        name: "user-register",
        text: `WITH new_user AS (
                 INSERT INTO users (email, password_hash, first_name, last_name, age)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, email, first_name, last_name, age, created_at, last_active_at
               ), survey_rows AS (
                 INSERT INTO user_survey (user_id, question_key, answer)
                 SELECT new_user.id, item.question_key, item.answer
                 FROM new_user
                 CROSS JOIN unnest($6::varchar[], $7::varchar[])
                   AS item(question_key, answer)
               ), refresh_row AS (
                 INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
                 SELECT $8, new_user.id, $9, $10 FROM new_user
               )
               SELECT id, email, first_name, last_name, age, created_at, last_active_at
               FROM new_user`,
        values: [
          email,
          passwordHash,
          firstName,
          lastName,
          age,
          survey.map((item) => item.questionKey),
          survey.map((item) => item.answer),
          refresh.id,
          refresh.hash,
          refresh.expiresAt,
        ],
      });
      const user = inserted.rows[0];
      if (!user) throw new Error("user insert returned no row");

      const userProfile = profile(user);
      context.caches.profiles.set(user.id, userProfile);
      const accessToken = await context.tokens.createAccessToken(user.id);
      setAuthCookies(response, request, context, accessToken, refresh.token);
      response.status(201).json({ user: userProfile, accessToken });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        response.status(409).json({ error: "Пользователь с таким email уже существует" });
        return;
      }
      throw error;
    }
  });

  router.post("/login", authLimit, async (request, response) => {
    const email = canonicalEmail(request.body?.email);
    const password = cleanString(request.body?.password, 200, 1);
    if (!email || !password) {
      response.status(400).json({ error: "Некорректный email или пароль" });
      return;
    }
    const result = await context.database.query<UserRow>({
      name: "user-login",
      text: `SELECT id, email, password_hash, first_name, last_name, age,
                    created_at, last_active_at
             FROM users
             WHERE email = $1`,
      values: [email],
    });
    const user = result.rows[0];
    if (!user?.password_hash || !(await verifyPassword(user.password_hash, password))) {
      response.status(401).json({ error: "Некорректный email или пароль" });
      return;
    }

    const refresh = context.tokens.createRefreshToken();
    await insertRefreshToken(context.database, user.id, refresh);
    const accessToken = await context.tokens.createAccessToken(user.id);
    const userProfile = profile(user);
    context.caches.profiles.set(user.id, userProfile);
    context.activity.touch(user.id);
    setAuthCookies(response, request, context, accessToken, refresh.token);
    response.json({ user: userProfile, accessToken });
  });

  router.post("/refresh", authLimit, async (request, response) => {
    const parsed = context.tokens.parseRefreshToken(request.cookies.refresh_token);
    if (!parsed) {
      clearAuthCookies(response, request, context);
      response.status(401).json({ error: "Сессия истекла" });
      return;
    }
    const replacement = context.tokens.createRefreshToken();
    const result = await context.database.query<UserRow>({
      name: "refresh-token-rotate",
      text: `WITH current_token AS (
               UPDATE refresh_tokens
               SET revoked_at = now()
               WHERE id = $1 AND token_hash = $2
                 AND revoked_at IS NULL AND expires_at > now()
               RETURNING user_id
             ), replacement_token AS (
               INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
               SELECT $3, user_id, $4, $5 FROM current_token
               RETURNING user_id
             )
             SELECT u.id, u.email, u.first_name, u.last_name, u.age,
                    u.created_at, u.last_active_at
             FROM replacement_token rt
             JOIN users u ON u.id = rt.user_id`,
      values: [
        parsed.id,
        parsed.hash,
        replacement.id,
        replacement.hash,
        replacement.expiresAt,
      ],
    });
    const user = result.rows[0];
    if (!user) {
      clearAuthCookies(response, request, context);
      response.status(401).json({ error: "Сессия истекла" });
      return;
    }
    const accessToken = await context.tokens.createAccessToken(user.id);
    setAuthCookies(response, request, context, accessToken, replacement.token);
    context.activity.touch(user.id);
    response.json({ accessToken });
  });

  router.post("/logout", async (request, response) => {
    const parsed = context.tokens.parseRefreshToken(request.cookies.refresh_token);
    if (parsed) {
      await context.database.query({
        name: "refresh-token-revoke",
        text: `UPDATE refresh_tokens SET revoked_at = now()
               WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
        values: [parsed.id, parsed.hash],
      });
    }
    clearAuthCookies(response, request, context);
    response.status(204).end();
  });

  router.get("/me", requireAuth, async (request, response) => {
    const userId = request.auth!.id;
    const cached = context.caches.profiles.get(userId);
    if (cached) {
      response.json({ user: cached });
      return;
    }
    const result = await context.database.query<UserRow>({
      name: "user-profile",
      text: `SELECT id, email, first_name, last_name, age, created_at, last_active_at
             FROM users WHERE id = $1`,
      values: [userId],
    });
    const user = result.rows[0];
    if (!user) {
      response.status(404).json({ error: "Пользователь не найден" });
      return;
    }
    const userProfile = profile(user);
    context.caches.profiles.set(userId, userProfile);
    response.json({ user: userProfile });
  });

  return router;
}
