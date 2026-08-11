import {
  currentUser,
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  register as apiRegister,
  type SurveyAnswer,
  type UserProfile,
} from "./core-api";

export type AuthSnapshot =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authenticated"; user: UserProfile };

const SERVER_SNAPSHOT: AuthSnapshot = { status: "loading", user: null };
let snapshot: AuthSnapshot = SERVER_SNAPSHOT;
let initialization: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function publish(next: AuthSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void refreshSession().then((refreshed) => {
      if (refreshed) scheduleRefresh();
      else publish({ status: "guest", user: null });
    });
  }, 12 * 60 * 1_000);
}

export function subscribeToAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthSnapshot() {
  return snapshot;
}

export function getAuthServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function initializeAuth() {
  if (snapshot.status !== "loading") return Promise.resolve();
  if (initialization) return initialization;
  initialization = currentUser()
    .then((user) => {
      if (!user) {
        publish({ status: "guest", user: null });
        return;
      }
      publish({ status: "authenticated", user });
      scheduleRefresh();
    })
    .catch(() => publish({ status: "guest", user: null }))
    .finally(() => {
      initialization = null;
    });
  return initialization;
}

export async function signIn(email: string, password: string) {
  const result = await apiLogin(email, password);
  publish({ status: "authenticated", user: result.user });
  scheduleRefresh();
  return result.user;
}

export async function signUp(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  age: number;
  survey: SurveyAnswer[];
}) {
  const result = await apiRegister(input);
  publish({ status: "authenticated", user: result.user });
  scheduleRefresh();
  return result.user;
}

export async function signOut() {
  await apiLogout();
  if (refreshTimer) clearTimeout(refreshTimer);
  publish({ status: "guest", user: null });
}
