import { jwtVerify, SignJWT } from "jose";
import { authSecret } from "@/lib/env";

// 不依赖 next/headers 与 server-only，所以 proxy.ts 和 Server Actions 都能共用。

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: "customer" | "admin";
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(authSecret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") return null;
    return {
      userId: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role === "admin" ? "admin" : "customer",
    };
  } catch {
    return null;
  }
}
