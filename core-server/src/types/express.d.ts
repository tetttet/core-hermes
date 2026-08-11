import type { AuthUser } from "../lib/tokens.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
