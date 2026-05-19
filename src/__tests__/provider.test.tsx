import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, act, waitFor, cleanup } from "@testing-library/react";

// --- helpers ----------------------------------------------------------------

/** Encode a JWT-shaped payload (header.payload.signature, no crypto). */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

const ORG_ID = "org_01KEWJVGA8A9WS4QT6F22MBCS8";
const ROLE = "member";
const PERMISSIONS = ["read:docs"];
const FEATURE_FLAGS = ["new-dashboard"];

const accessToken = fakeJwt({
  sid: "session_123",
  iss: "https://api.workos.com",
  sub: "user_123",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  jti: "jwt_123",
  org_id: ORG_ID,
  role: ROLE,
  roles: [ROLE],
  permissions: PERMISSIONS,
  feature_flags: FEATURE_FLAGS,
});

const fakeUser = {
  id: "user_123",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  profilePictureUrl: null,
  updatedAt: "2024-01-01T00:00:00Z",
  emailVerified: true,
  object: "user" as const,
};

// --- mocks ------------------------------------------------------------------

// Capture the onRefresh passed into createClient so we can trigger it manually.
let capturedOnRefresh: ((response: any) => void) | undefined;

vi.mock("@workos-inc/authkit-js", async () => {
  // We re-implement getClaims because the real one lives in the package
  // and we're mocking the whole module.
  function getClaims(token: string) {
    const [, body] = token.split(".");
    return JSON.parse(atob(body));
  }

  return {
    getClaims,
    LoginRequiredError: class LoginRequiredError extends Error {},
    createClient: vi.fn(
      (_clientId: string, options?: { onRefresh?: (r: any) => void }) => {
        capturedOnRefresh = options?.onRefresh;
        return Promise.resolve({
          getUser: () => fakeUser,
          getAccessToken: () => Promise.resolve(accessToken),
          signIn: async () => {},
          signUp: async () => {},
          signOut: async () => {},
          switchToOrganization: async () => {},
          getSignInUrl: async () => "",
          getSignUpUrl: async () => "",
        });
      },
    ),
  };
});

// Must be imported **after** vi.mock so the mock is in effect.
import { AuthKitProvider } from "../provider";
import { Context } from "../context";

// --- tests ------------------------------------------------------------------

/** Small consumer that renders context values as data attributes. */
function AuthConsumer() {
  const ctx = React.useContext(Context);
  return (
    <div
      data-testid="auth"
      data-loading={String(ctx.isLoading)}
      data-org={ctx.organizationId ?? "null"}
      data-role={ctx.role ?? "null"}
      data-permissions={JSON.stringify(ctx.permissions)}
      data-feature-flags={JSON.stringify(ctx.featureFlags)}
    />
  );
}

describe("AuthKitProvider", () => {
  beforeEach(() => {
    capturedOnRefresh = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  it("populates organizationId from access token after createClient resolves", async () => {
    const { getByTestId } = render(
      <AuthKitProvider clientId="client_test">
        <AuthConsumer />
      </AuthKitProvider>,
    );

    // Initially loading
    expect(getByTestId("auth").dataset.loading).toBe("true");

    // Wait for the setTimeout(0) + createClient promise to resolve
    await waitFor(() => {
      const el = getByTestId("auth");
      expect(el.dataset.loading).toBe("false");
      expect(el.dataset.org).toBe(ORG_ID);
      expect(el.dataset.role).toBe(ROLE);
      expect(el.dataset.permissions).toBe(JSON.stringify(PERMISSIONS));
      expect(el.dataset.featureFlags).toBe(JSON.stringify(FEATURE_FLAGS));
    });
  });

  it("reads auth metadata from access token claims, not just initialState", async () => {
    // Regression test for issue #87.
    // The old code did: setState({ ...initialState, isLoading: false, user })
    // which always set organizationId to null (from initialState).
    // The fix reads org_id, role, permissions, etc. from the JWT claims.
    const { getByTestId } = render(
      <AuthKitProvider clientId="client_test">
        <AuthConsumer />
      </AuthKitProvider>,
    );

    await waitFor(() => {
      const el = getByTestId("auth");
      expect(el.dataset.loading).toBe("false");
      // These MUST come from the JWT, not from initialState (which has null/[]).
      expect(el.dataset.org).toBe(ORG_ID);
      expect(el.dataset.role).toBe(ROLE);
      expect(el.dataset.permissions).not.toBe("[]");
      expect(el.dataset.featureFlags).not.toBe("[]");
    });
  });

  it("does NOT overwrite organizationId set by onRefresh with null", async () => {
    // This is the exact regression described in issue #87.
    // Sequence: onRefresh fires with org_id → .then() callback must NOT
    // reset organizationId to null.
    const { getByTestId } = render(
      <AuthKitProvider clientId="client_test">
        <AuthConsumer />
      </AuthKitProvider>,
    );

    // Wait for initial load to complete
    await waitFor(() => {
      expect(getByTestId("auth").dataset.loading).toBe("false");
    });

    // Now simulate onRefresh being called with an organizationId
    act(() => {
      capturedOnRefresh?.({
        user: fakeUser,
        accessToken,
        organizationId: ORG_ID,
      });
    });

    // The organizationId should still be the one from onRefresh
    await waitFor(() => {
      expect(getByTestId("auth").dataset.org).toBe(ORG_ID);
    });
  });
});
