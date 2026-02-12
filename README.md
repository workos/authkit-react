# AuthKit React

Add authentication to your React app with WorkOS AuthKit. Handles sign-in, sign-up, token refresh, and session management via a hosted OAuth flow.

## Installation

```bash
npm install @workos-inc/authkit-react
```

## Quick Start

### 1. Configure the WorkOS Dashboard

- Add a **Redirect URI** (e.g. `http://localhost:5173`) on the **Redirects** page. This is where WorkOS sends users after they authenticate.
- Add your app's origin (e.g. `http://localhost:5173`) to the allowed origins list on the **Authentication** page of the [WorkOS Dashboard](https://dashboard.workos.com).

### 2. Wrap your app in `AuthKitProvider`

```jsx
import { AuthKitProvider } from "@workos-inc/authkit-react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")).render(
  <AuthKitProvider clientId="client_01ABC123DEF456">
    <App />
  </AuthKitProvider>,
);
```

### 3. Add a `/login` route

Some authentication flows are initiated outside your app — for example, when an admin impersonates a user from the WorkOS Dashboard, or when a third-party triggers login via your app's sign-in endpoint. These flows redirect the user to a well-known login path in your app, which must then start the OAuth flow.

Register a `/login` URL (e.g. `http://localhost:5173/login`) as the **sign-in endpoint** on the same **Redirects** page, then handle it in your app:

```jsx
import { useAuth } from "@workos-inc/authkit-react";
import { useEffect } from "react";

function LoginRoute() {
  const { signIn } = useAuth();

  useEffect(() => {
    signIn();
  }, [signIn]);

  return <div>Redirecting...</div>;
}
```

In a router-based app this would be a dedicated route component. In a simple app you can handle it inline:

```jsx
function App() {
  const { isLoading, user, signIn } = useAuth();

  useEffect(() => {
    if (window.location.pathname === "/login") {
      signIn();
    }
  }, [signIn]);

  // ... rest of your app
}
```

### 4. Use the `useAuth` hook

```jsx
import { useAuth } from "@workos-inc/authkit-react";

function App() {
  const { isLoading, user, signIn, signUp, signOut, getAccessToken } =
    useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div>
        <button onClick={() => signIn()}>Sign In</button>
        <button onClick={() => signUp()}>Sign Up</button>
      </div>
    );
  }

  return (
    <div>
      <p>Hello, {user.firstName ?? user.email}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

That's it — you have a fully authenticated React app.

## API Reference

### `<AuthKitProvider />`

Wrap your app in this component to provide authentication context.

| Prop                    | Type                   | Required | Description                                                                                                                                      |
| ----------------------- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `clientId`              | `string`               | Yes      | Your WorkOS Client ID (starts with `client_`)                                                                                                    |
| `apiHostname`           | `string`               | No       | Your custom Authentication API domain. Defaults to api.workos.com. In production, this should be set to a domain you own (e.g. auth.example.com) |
| `devMode`               | `boolean`              | No       | Stores tokens in localStorage. Auto-enabled on `localhost` and `127.0.0.1`.                                                                      |
| `onRedirectCallback`    | `(params) => void`     | No       | Called after a successful authentication. Use to restore app state or navigate.                                                                  |
| `onRefresh`             | `(response) => void`   | No       | Called when the access token is refreshed.                                                                                                       |
| `onRefreshFailure`      | `({ signIn }) => void` | No       | Called when token refresh fails. Receives `signIn` to trigger re-authentication.                                                                 |
| `onBeforeAutoRefresh`   | `() => boolean`        | No       | Called before automatic refresh. Return `false` to skip.                                                                                         |
| `refreshBufferInterval` | `number`               | No       | Seconds before token expiration to trigger refresh.                                                                                              |

### `useAuth()`

Returns the current auth state and helper methods. Must be called inside `<AuthKitProvider>`.

#### State

| Property               | Type                           | Description                                                |
| ---------------------- | ------------------------------ | ---------------------------------------------------------- |
| `isLoading`            | `boolean`                      | `true` during initial authentication check                 |
| `user`                 | `User \| null`                 | The authenticated user, or `null`                          |
| `organizationId`       | `string \| null`               | The user's current organization                            |
| `role`                 | `string \| null`               | The user's role in the current organization                |
| `roles`                | `string[] \| null`             | All roles for the user in the current organization         |
| `permissions`          | `string[]`                     | Permissions for the user's role                            |
| `featureFlags`         | `string[]`                     | Feature flags enabled for the organization                 |
| `impersonator`         | `Impersonator \| null`         | Set when an admin is impersonating this user               |
| `authenticationMethod` | `AuthenticationMethod \| null` | How the user authenticated (e.g. `"GoogleOAuth"`, `"SSO"`) |

#### Methods

| Method                 | Signature                                            | Description                                    |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `signIn`               | `(opts?) => Promise<void>`                           | Redirect to the AuthKit sign-in page           |
| `signUp`               | `(opts?) => Promise<void>`                           | Redirect to the AuthKit sign-up page           |
| `signOut`              | `(opts?) => void`                                    | End the session and sign the user out          |
| `getAccessToken`       | `(opts?) => Promise<string>`                         | Get a valid access token, refreshing if needed |
| `getUser`              | `() => User \| null`                                 | Synchronously get the current user             |
| `switchToOrganization` | `({ organizationId, signInOpts? }) => Promise<void>` | Switch to a different organization             |
| `getSignInUrl`         | `(opts?) => Promise<string>`                         | Get the sign-in URL without redirecting        |
| `getSignUpUrl`         | `(opts?) => Promise<string>`                         | Get the sign-up URL without redirecting        |

#### `signIn` / `signUp` Options

```ts
{
  state?: any;                // Data to persist through the auth flow
  organizationId?: string;    // Pre-select an organization
  loginHint?: string;         // Pre-fill the email field
  invitationToken?: string;   // Accept an invitation during sign-up
  screenHint?: "sign-in" | "sign-up"; // Which screen to show
}
```

#### `signOut` Options

```ts
{
  returnTo?: string;   // URL to navigate to after sign-out
}
```

### `User`

```ts
interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  profilePictureUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
  lastSignInAt: string | null;
  externalId: string | undefined;
}
```

### `getClaims(accessToken)`

Decodes a JWT access token and returns its claims.

```ts
import { getClaims } from "@workos-inc/authkit-react";

const token = await getAccessToken();
const claims = getClaims(token);
// claims.sub, claims.org_id, claims.role, claims.permissions, etc.
```

### Error Classes

- **`AuthKitError`** — Base error class for AuthKit errors.
- **`LoginRequiredError`** — Thrown by `getAccessToken()` when no user is authenticated.

## Recipes

### Making Authenticated API Calls

```jsx
function Dashboard() {
  const { getAccessToken } = useAuth();

  async function fetchData() {
    const token = await getAccessToken();
    const res = await fetch("/api/data", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }

  // ...
}
```

### Passing Data Through Auth Flows

Use `state` to preserve data across the authentication redirect:

```jsx
// Pass state when starting sign-in
<button onClick={() => signIn({ state: { returnTo: "/dashboard" } })}>
  Sign In
</button>
```

```jsx
// Retrieve it in onRedirectCallback
<AuthKitProvider
  clientId="client_01ABC123DEF456"
  onRedirectCallback={({ state }) => {
    if (state?.returnTo) {
      window.location.href = state.returnTo;
    }
  }}
>
  <App />
</AuthKitProvider>
```

### Handling Token Refresh Failures

```jsx
<AuthKitProvider
  clientId="client_01ABC123DEF456"
  onRefreshFailure={({ signIn }) => {
    // Session expired — prompt re-authentication
    signIn();
  }}
>
  <App />
</AuthKitProvider>
```

### Multi-Organization Switching

```jsx
function OrgSwitcher({ organizations }) {
  const { switchToOrganization, organizationId } = useAuth();

  return (
    <select
      value={organizationId ?? ""}
      onChange={(e) => switchToOrganization({ organizationId: e.target.value })}
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
```

### Role-Based UI

```jsx
function AdminPanel() {
  const { role, permissions } = useAuth();

  if (role !== "admin") return null;

  return (
    <div>
      <h2>Admin Panel</h2>
      {permissions.includes("users:manage") && <UserManagement />}
    </div>
  );
}
```
