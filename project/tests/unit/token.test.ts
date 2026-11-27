import { beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/server/auth/token";

beforeAll(() => {
  process.env.AUTH_SECRET = "unit-test-secret-unit-test-secret-1234";
});

describe("session token", () => {
  const payload = { userId: "u1", email: "a@b.co", name: "A", role: "admin" as const };

  it("round-trips a signed session", async () => {
    const token = await signSession(payload);
    expect(await verifySession(token)).toEqual(payload);
  });

  it("rejects tampered or missing tokens", async () => {
    const token = await signSession(payload);
    expect(await verifySession(token.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession("garbage")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession(payload);
    process.env.AUTH_SECRET = "another-secret-another-secret-another-1";
    expect(await verifySession(token)).toBeNull();
    process.env.AUTH_SECRET = "unit-test-secret-unit-test-secret-1234";
  });
});
