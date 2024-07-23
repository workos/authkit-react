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
function Root() {
  return (
    <WorkOSProvider clientId="client_123456">
      <App />
    </WorkOSProvider>
  );
}

function App() {
  const { user, getAccessToken, isLoading, signIn, signOut } = useAuth();
  if (isLoading) {
    return <Spinner />
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
