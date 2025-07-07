# AuthKit React Library

## Installation

```bash
npm install @workos-inc/authkit-react
```

or

```bash
yarn add @workos-inc/authkit-react
```

## Setup

Add your site's URL to the list of allowed origins in the WorkOS dashboard by
clicking on the "Configure CORS" button of the "Authentication" page.

## Usage

```jsx
import { useAuth, AuthKitProvider } from "@workos-inc/authkit-react";

function Root() {
  return (
    <AuthKitProvider clientId="client_123456" apiHostname="auth.example.com">
      <App />
    </AuthKitProvider>
  );
}

function App() {
  const { user, getAccessToken, isLoading, signIn, signUp, signOut } =
    useAuth();

  // This `/login` endpoint should be registered on the "Redirects" page of the
  // WorkOS Dashboard.
  // In a real app, this code would live in a route instead
  // of in the main <App/> component
  React.useEffect(() => {
    if (window.location.pathname === "/login") {
      const searchParams = new URLSearchParams(window.location.search);
      const context = searchParams.get("context") ?? undefined;
      signIn({ context });
    }
  }, [window.location, signIn]);

  if (isLoading) {
    return "Loading...";
  }

  const performMutation = async () => {
    const accessToken = await getAccessToken();
    alert(`API request with accessToken: ${accessToken}`);
  };

  if (user) {
    return (
      <div>
        Hello, {user.email}
        <p>
          <button
            onClick={() => {
              performMutation();
            }}
          >
            Make API Request
          </button>
        </p>
        <p>
          <button onClick={() => signOut()}>Sign out</button>
        </p>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => signIn()}>Sign in</button>{" "}
      <button onClick={() => signUp()}>Sign up</button>
    </>
  );
}
```

## Reference

### `<AuthKitProvider />`

Your app should be wrapped in the `AuthKitProvider` component. This component
takes the following props:

- `clientId` (required): Your `WORKOS_CLIENT_ID`
- `apiHostname`: Defaults to `api.workos.com`. This should be set to your custom Authentication API domain in production.
- `redirectUri`: The url that WorkOS will redirect to upon successful authentication. (Used when constructing sign-in/sign-up URLs).
- `devMode`: Defaults to `true` if window.location is "localhost" or "127.0.0.1". Tokens will be stored in localStorage when this prop is true.
- `onRedirectCallback`: Called after exchanging the
  `authorization_code`. Can be used for things like redirecting to a "return
  to" path in the OAuth state.

### `useAuth`

The `useAuth` hook returns user information and helper functions:

- `isLoading`: true while user information is being obtained from fetch during initial load.
- `user`: The WorkOS `User` object for this session.
- `getAccessToken`: Returns an access token. Will fetch a fresh access token if necessary.
- `signIn`: Redirects the user to the Hosted AuthKit sign-in page. Takes an optional `state` argument.
- `signUp`: Redirects the user to the Hosted AuthKit sign-up page. Takes an optional `state` argument.
- `signOut`: Ends the session.
- `switchToOrganization`: Switches to the given organization. Redirects to the hosted login page if switch is unsuccessful.

The following claims may be populated if the user is part of an organization:

- `organizationId`: The currently-selected organization.
- `role`: The `role` of the user for the current organization.
- `permissions`: Permissions corresponding to this role.
- `featureFlags`: Enabled feature flags for the current organization.

## Passing Data Through Authentication Flows

When building authentication flows, you often need to maintain state across redirects. For example, you might want to return users to the page they were viewing before login or preserve other application state. AuthKit provides a way to pass and retrieve data through the authentication process.

### Using `state`

`state` is used to pass data that you need to retrieve after authentication completes

```tsx
// When signing in, pass your data using the state parameter
function LoginButton() {
  return (
    <button
      onClick={() => {
        signIn({ state: { returnTo: "/dashboard" } });
      }}
    >
      Sign in
    </button>
  );
}

// Then retrieve your data in the onRedirectCallback
function App() {
  return (
    <AuthKitProvider
      clientId="client_123"
      apiHostname="auth.example.com"
      onRedirectCallback={({ state }) => {
        // Access your data here
        if (state?.returnTo) {
          window.location.href = state.returnTo;
        }
      }}
    >
      <YourApp />
    </AuthKitProvider>
  );
}
```

This pattern works with both `signIn` and `signUp` functions.
