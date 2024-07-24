# AuthKit React Library

## Installation

```bash
npm install @workos-inc/authkit-react
```

or

```bash
yarn add @workos-inc/authkit-react
```

## Usage

```jsx
import { useAuth, AuthKitProvider } from "@workos-inc/authkit-react";

function Root() {
  return (
    <AuthKitProvider clientId="client_123456">
      <App />
    </AuthKitProvider>
  );
}

function App() {
  const { user, getAccessToken, isLoading, signIn, signUp, signOut } = useAuth();
  if (isLoading) {
    return <Spinner />;
  }

  const performMutation = async () => {
    const accessToken = await getAccessToken();
    console.log("api request with accessToken", accessToken);
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

* `clientId` (required): Your `WORKOS_CLIENT_ID`
* `redirectUri`: The url that WorkOS will redirect to upon successful authentication. (Used when constructing sign-in/sign-up URLs).
* `devMode`: Defaults to `true` if window.location is "localhost" or "127.0.0.1". Tokens will be stored in localStorage when this prop is true.
* `onRedirectCallback`: Called after exchanging the
  `authorization_code`. Can be used for things like redirecting to a "return
  to" path in the OAuth state.

### `useAuth`

The `useAuth` hook returns user information and helper functions:

* `isLoading`: true while user information is being obtained from fetch during initial load.
* `user`: The WorkOS `User` object for this session.
* `getAccessToken`: Returns an access token. Will fetch a fresh access token if necessary.
* `signIn`: Redirects the user to the Hosted AuthKit sign-in page. Takes an optional `state` argument.
* `signUp`: Redirects the user to the Hosted AuthKit sign-up page. Takes an optional `state` argument.
* `signOut`: Ends the session.
