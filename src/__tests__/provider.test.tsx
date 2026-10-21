import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClient,
  type OnRefreshResponse,
  type User,
} from "@workos-inc/authkit-js";
import { AuthKitProvider } from "../provider";
import { useAuth } from "../hook";

// Only createClient is faked. Everything else (getClaims, LoginRequiredError)
// is the real implementation, so tokens are decoded exactly as in production.
vi.mock("@workos-inc/authkit-js", async (importActual) => {
  const actual = await importActual<typeof import("@workos-inc/authkit-js")>();
  return { ...actual, createClient: vi.fn() };
});

type AuthKitClient = Awaited<ReturnType<typeof createClient>>;
type ClientOptions = NonNullable<Parameters<typeof createClient>[1]>;

// --- fixtures ----------------------------------------------------------------

function base64Url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeAccessToken(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: "RS256", typ: "JWT" });
  const payload = base64Url({
    sid: "session_123",
    iss: "https://api.workos.com",
    sub: "user_123",
    jti: "jwt_123",
    iat: now,
    exp: now + 3600,
    ...claims,
  });
  return `${header}.${payload}.signature`;
}

function makeUser(id: string): User {
  return {
    object: "user",
    id,
    email: `${id}@example.com`,
    emailVerified: true,
    firstName: "Test",
    lastName: "User",
    profilePictureUrl: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  } as User;
}

const userA = makeUser("user_A");
const userB = makeUser("user_B");

const claimsA = {
  organizationId: "org_A",
  role: "admin",
  roles: ["admin", "member"],
  permissions: ["posts:read", "posts:write"],
  featureFlags: ["beta-dashboard"],
};
const tokenA = makeAccessToken({
  org_id: claimsA.organizationId,
  role: claimsA.role,
  roles: claimsA.roles,
  permissions: claimsA.permissions,
  feature_flags: claimsA.featureFlags,
});

const claimsB = {
  organizationId: "org_B",
  role: "member",
  roles: ["member"],
  permissions: ["posts:read"],
  featureFlags: ["new-billing"],
};
const tokenB = makeAccessToken({
  org_id: claimsB.organizationId,
  role: claimsB.role,
  roles: claimsB.roles,
  permissions: claimsB.permissions,
  feature_flags: claimsB.featureFlags,
});

function refreshResponse(
  user: User,
  accessToken: string,
  organizationId: string,
): OnRefreshResponse {
  return {
    user,
    accessToken,
    organizationId,
    authenticationMethod: "Password",
  };
}

/** A client as createClient() resolves it, holding `user`'s session. */
function makeClient(user: User, accessToken: string): AuthKitClient {
  return {
    getUser: () => user,
    getAccessToken: vi.fn(async () => accessToken),
    signIn: vi.fn(async () => {}),
    signUp: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    switchToOrganization: vi.fn(async () => {}),
    getSignInUrl: vi.fn(async () => ""),
    getSignUpUrl: vi.fn(async () => ""),
  } as unknown as AuthKitClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// --- harness -----------------------------------------------------------------

interface PendingInit {
  clientId: string;
  options: ClientOptions;
  resolve: (client: AuthKitClient) => void;
  reject: (error: unknown) => void;
}

// Every createClient() call parks here until the test settles it.
let inits: PendingInit[] = [];

async function nextInit(count: number): Promise<PendingInit> {
  await waitFor(() => expect(inits).toHaveLength(count));
  return inits[count - 1];
}

/** Let pending promise chains and the React updates they schedule finish. */
async function flush() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

function AuthState() {
  const {
    isLoading,
    user,
    organizationId,
    role,
    roles,
    permissions,
    featureFlags,
  } = useAuth();
  return (
    <pre data-testid="auth" data-loading={String(isLoading)}>
      {JSON.stringify({
        userId: user?.id ?? null,
        organizationId,
        role,
        roles,
        permissions,
        featureFlags,
      })}
    </pre>
  );
}

function readAuth() {
  const el = screen.getByTestId("auth");
  return {
    isLoading: el.dataset.loading === "true",
    ...JSON.parse(el.textContent ?? "{}"),
  };
}

function renderProvider(
  clientId = "client_A",
  { strict = false }: { strict?: boolean } = {},
) {
  const tree = (id: string) => {
    const provider = (
      <AuthKitProvider clientId={id}>
        <AuthState />
      </AuthKitProvider>
    );
    return strict ? <React.StrictMode>{provider}</React.StrictMode> : provider;
  };
  const result = render(tree(clientId));
  return {
    ...result,
    setClientId: (next: string) => result.rerender(tree(next)),
  };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  inits = [];
  vi.mocked(createClient).mockImplementation((clientId, options = {}) => {
    const { promise, resolve, reject } = deferred<AuthKitClient>();
    inits.push({ clientId, options, resolve, reject });
    return promise;
  });
  // Fails the test on anything unexpected (including React act() warnings).
  // Tests that expect an error assert on it and then clear it.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  const unexpectedErrors = [...consoleError.mock.calls];
  vi.mocked(createClient).mockReset();
  vi.restoreAllMocks();
  expect(unexpectedErrors).toEqual([]);
});

// --- tests -------------------------------------------------------------------

describe("AuthKitProvider initialization", () => {
  describe("onRefresh during init versus after it", () => {
    // Regression test for #87: init used to settle with
    // `{ ...initialState, isLoading: false, user }`, wiping the organization
    // onRefresh had just set. authkit-js calls onRefresh before createClient
    // resolves whenever init establishes a session, so this is the real flow.
    it("keeps the organization from an onRefresh that fires before createClient resolves", async () => {
      renderProvider();
      const init = await nextInit(1);

      act(() =>
        init.options.onRefresh!(refreshResponse(userA, tokenA, "org_A")),
      );
      expect(readAuth()).toMatchObject({ isLoading: true, ...claimsA });

      init.resolve(makeClient(userA, tokenA));
      await flush();

      expect(readAuth()).toEqual({
        isLoading: false,
        userId: userA.id,
        ...claimsA,
      });
    });

    it("applies an onRefresh that fires after createClient resolves", async () => {
      renderProvider();
      const init = await nextInit(1);
      act(() =>
        init.options.onRefresh!(refreshResponse(userA, tokenA, "org_A")),
      );
      init.resolve(makeClient(userA, tokenA));
      await flush();
      expect(readAuth()).toMatchObject({ isLoading: false, ...claimsA });

      // e.g. switchToOrganization() refreshing into another organization.
      act(() =>
        init.options.onRefresh!(refreshResponse(userA, tokenB, "org_B")),
      );
      await flush();

      expect(readAuth()).toEqual({
        isLoading: false,
        userId: userA.id,
        ...claimsB,
      });
    });
  });

  it("clears organization claims when onRefresh delivers a token without org_id", async () => {
    renderProvider();
    const init = await nextInit(1);
    act(() => init.options.onRefresh!(refreshResponse(userA, tokenA, "org_A")));
    init.resolve(makeClient(userA, tokenA));
    await flush();

    // A refresh into a session outside any organization.
    const tokenWithoutOrg = makeAccessToken({});
    act(() =>
      init.options.onRefresh!({
        user: userA,
        accessToken: tokenWithoutOrg,
        authenticationMethod: "Password",
      }),
    );
    await flush();

    expect(readAuth()).toEqual({
      isLoading: false,
      userId: userA.id,
      organizationId: null,
      role: null,
      roles: null,
      permissions: [],
      featureFlags: [],
    });
  });

  it("logs and settles signed out when createClient rejects", async () => {
    renderProvider();
    const init = await nextInit(1);

    const error = new Error("code exchange failed");
    init.reject(error);
    await flush();

    expect(readAuth()).toEqual({
      isLoading: false,
      userId: null,
      organizationId: null,
      role: null,
      roles: null,
      permissions: [],
      featureFlags: [],
    });
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockClear();
  });

  it("lets the second init count under StrictMode double effects", async () => {
    let effectRuns = 0;
    function EffectProbe() {
      React.useEffect(() => {
        effectRuns += 1;
      }, []);
      return null;
    }
    render(
      <React.StrictMode>
        <EffectProbe />
      </React.StrictMode>,
    );
    // Sanity check: this environment really double-invokes effects.
    expect(effectRuns).toBe(2);
    cleanup();

    renderProvider("client_A", { strict: true });
    const init = await nextInit(1);
    await flush();
    // The first effect was cleaned up before its createClient() timer fired.
    expect(createClient).toHaveBeenCalledTimes(1);

    act(() => init.options.onRefresh!(refreshResponse(userA, tokenA, "org_A")));
    init.resolve(makeClient(userA, tokenA));
    await flush();

    expect(readAuth()).toEqual({
      isLoading: false,
      userId: userA.id,
      ...claimsA,
    });
  });

  describe("superseded init (props change mid-flight)", () => {
    it("ignores the old init resolving late", async () => {
      const { setClientId } = renderProvider("client_A");
      const staleInit = await nextInit(1);

      setClientId("client_B");
      const currentInit = await nextInit(2);
      expect(currentInit.clientId).toBe("client_B");

      act(() =>
        currentInit.options.onRefresh!(refreshResponse(userB, tokenB, "org_B")),
      );
      currentInit.resolve(makeClient(userB, tokenB));
      await flush();
      expect(readAuth()).toEqual({
        isLoading: false,
        userId: userB.id,
        ...claimsB,
      });

      staleInit.resolve(makeClient(userA, tokenA));
      await flush();

      expect(readAuth()).toEqual({
        isLoading: false,
        userId: userB.id,
        ...claimsB,
      });
    });

    it("ignores the old init rejecting late", async () => {
      const { setClientId } = renderProvider("client_A");
      const staleInit = await nextInit(1);

      setClientId("client_B");
      const currentInit = await nextInit(2);

      // The stale rejection must neither end loading nor log.
      staleInit.reject(new Error("stale init failed"));
      await flush();
      expect(screen.getByTestId("auth")).toHaveAttribute(
        "data-loading",
        "true",
      );

      act(() =>
        currentInit.options.onRefresh!(refreshResponse(userB, tokenB, "org_B")),
      );
      currentInit.resolve(makeClient(userB, tokenB));
      await flush();

      expect(readAuth()).toEqual({
        isLoading: false,
        userId: userB.id,
        ...claimsB,
      });
    });
  });
});
