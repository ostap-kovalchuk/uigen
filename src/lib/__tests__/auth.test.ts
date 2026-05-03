import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockSignJWTInstance = {
  setProtectedHeader: vi.fn().mockReturnThis(),
  setExpirationTime: vi.fn().mockReturnThis(),
  setIssuedAt: vi.fn().mockReturnThis(),
  sign: vi.fn().mockResolvedValue("mock-jwt-token"),
};

const mockSignJWT = vi.fn(() => mockSignJWTInstance);
const mockJwtVerify = vi.fn();

vi.mock("jose", () => ({
  SignJWT: mockSignJWT,
  jwtVerify: mockJwtVerify,
}));

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockSet,
    get: mockGet,
    delete: mockDelete,
  })),
}));

const { createSession, getSession, deleteSession } = await import("../auth");

const COOKIE_NAME = "auth-token";

beforeEach(() => {
  vi.clearAllMocks();
  // Restore chainable mock after clearAllMocks
  mockSignJWTInstance.setProtectedHeader.mockReturnThis();
  mockSignJWTInstance.setExpirationTime.mockReturnThis();
  mockSignJWTInstance.setIssuedAt.mockReturnThis();
  mockSignJWTInstance.sign.mockResolvedValue("mock-jwt-token");
  mockSignJWT.mockReturnValue(mockSignJWTInstance);
});

describe("createSession", () => {
  test("signs a JWT with userId and email in the payload", async () => {
    await createSession("user-123", "user@example.com");

    expect(mockSignJWT).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-123", email: "user@example.com" })
    );
    expect(mockSignJWTInstance.setProtectedHeader).toHaveBeenCalledWith({
      alg: "HS256",
    });
    expect(mockSignJWTInstance.setExpirationTime).toHaveBeenCalledWith("7d");
    expect(mockSignJWTInstance.sign).toHaveBeenCalledOnce();
  });

  test("sets the auth-token cookie with the JWT", async () => {
    await createSession("user-123", "user@example.com");

    expect(mockSet).toHaveBeenCalledOnce();
    const [name, token] = mockSet.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(token).toBe("mock-jwt-token");
  });

  test("cookie is httpOnly with sameSite lax and path /", async () => {
    await createSession("user-123", "user@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie is not secure outside of production", async () => {
    await createSession("user-123", "user@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  test("cookie expiry is approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-123", "user@example.com");
    const after = Date.now();

    const [, , options] = mockSet.mock.calls[0];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(options.expires.getTime()).toBeGreaterThanOrEqual(
      before + sevenDaysMs - 1000
    );
    expect(options.expires.getTime()).toBeLessThanOrEqual(
      after + sevenDaysMs + 1000
    );
  });

  test("creates distinct sessions for different users", async () => {
    mockSignJWTInstance.sign
      .mockResolvedValueOnce("token-1")
      .mockResolvedValueOnce("token-2");

    await createSession("user-1", "one@example.com");
    await createSession("user-2", "two@example.com");

    expect(mockSet.mock.calls[0][1]).toBe("token-1");
    expect(mockSet.mock.calls[1][1]).toBe("token-2");
  });
});

describe("getSession", () => {
  test("returns null when no auth cookie is present", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns the SessionPayload when the token is valid", async () => {
    const payload = {
      userId: "user-123",
      email: "user@example.com",
      expiresAt: new Date().toISOString(),
    };
    mockGet.mockReturnValue({ value: "valid-token" });
    mockJwtVerify.mockResolvedValue({ payload });

    const session = await getSession();

    expect(session?.userId).toBe("user-123");
    expect(session?.email).toBe("user@example.com");
  });

  test("passes the cookie token to jwtVerify", async () => {
    mockGet.mockReturnValue({ value: "some-token" });
    mockJwtVerify.mockResolvedValue({ payload: { userId: "u1", email: "e" } });

    await getSession();

    expect(mockJwtVerify).toHaveBeenCalledOnce();
    expect(mockJwtVerify.mock.calls[0][0]).toBe("some-token");
    expect(mockJwtVerify.mock.calls[0][1]).toBeTruthy(); // JWT_SECRET key
  });

  test("returns null when jwtVerify throws (expired or invalid token)", async () => {
    mockGet.mockReturnValue({ value: "bad-token" });
    mockJwtVerify.mockRejectedValue(new Error("JWTExpired"));

    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token that causes a verify error", async () => {
    mockGet.mockReturnValue({ value: "not.a.jwt" });
    mockJwtVerify.mockRejectedValue(new Error("JWSInvalid"));

    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});
