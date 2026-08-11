import { createHash, randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { AppConfig } from "../config.js";
import { isUuid } from "./validation.js";

export type AuthUser = { id: string };

export type RefreshToken = {
  id: string;
  token: string;
  hash: string;
  expiresAt: Date;
};

export class TokenService {
  readonly #secret: Uint8Array;

  constructor(private readonly config: AppConfig) {
    this.#secret = new TextEncoder().encode(config.jwtAccessSecret);
  }

  async createAccessToken(userId: string) {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(userId)
      .setIssuer(this.config.jwtIssuer)
      .setAudience(this.config.jwtAudience)
      .setIssuedAt()
      .setExpirationTime(this.config.accessTokenTtl)
      .sign(this.#secret);
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    const result = await jwtVerify(token, this.#secret, {
      algorithms: ["HS256"],
      issuer: this.config.jwtIssuer,
      audience: this.config.jwtAudience,
    });
    if (!isUuid(result.payload.sub)) throw new Error("invalid token subject");
    return { id: result.payload.sub };
  }

  createRefreshToken(): RefreshToken {
    const id = randomUUID();
    const secret = randomBytes(32).toString("base64url");
    const token = `${id}.${secret}`;
    return {
      id,
      token,
      hash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + this.config.refreshTokenTtlDays * 86_400_000),
    };
  }

  parseRefreshToken(token: unknown) {
    if (typeof token !== "string" || token.length > 200) return undefined;
    const dot = token.indexOf(".");
    if (dot < 0) return undefined;
    const id = token.slice(0, dot);
    return isUuid(id) ? { id, hash: this.hashRefreshToken(token) } : undefined;
  }

  hashRefreshToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
