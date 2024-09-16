"use client";

import * as React from "react";
import {
  AuthenticationResponse,
  createClient,
  getClaims,
  LoginRequiredError,
} from "@workos-inc/authkit-js";
import { Context } from "./context";
import { Client, CreateClientOptions } from "./types";
import { initialState } from "./state";

interface AuthKitProviderProps extends CreateClientOptions {
  clientId: string;
  children: React.ReactNode;
}

export function AuthKitProvider(props: AuthKitProviderProps) {
  const {
    clientId,
    devMode,
    apiHostname,
    https,
    port,
    redirectUri,
    children,
    onRedirectCallback,
  } = props;
  const [client, setClient] = React.useState<Client>(NOOP_CLIENT);
  const [state, setState] = React.useState(initialState);

  const onRefresh = React.useCallback(
    ({ user, accessToken, organizationId }: AuthenticationResponse) => {
      const { role = null, permissions = [] } = getClaims(accessToken);
      setState((prev) => {
        const next = {
          ...prev,
          user,
          organizationId: organizationId ?? null,
          role,
          permissions,
        };
        return isEquivalentWorkOSSession(prev, next) ? prev : next;
      });
    },
    [client],
  );

  React.useEffect(() => {
    function initialize() {
      const timeoutId = setTimeout(() => {
        createClient(clientId, {
          apiHostname,
          port,
          https,
          redirectUri,
          devMode,
          onRedirectCallback,
          onRefresh,
        }).then(async (client) => {
          const user = client.getUser();
          setClient(client);
          setState((prev) => ({ ...prev, isLoading: false, user }));
        });
      });

      return () => {
        clearTimeout(timeoutId);
      };
    }

    setClient(NOOP_CLIENT);
    setState(initialState);

    return initialize();
  }, [clientId, apiHostname, https, port, redirectUri]);

  return (
    <Context.Provider value={{ ...client, ...state }}>
      {children}
    </Context.Provider>
  );
}

// poor-man's "deep equality" check
function isEquivalentWorkOSSession(
  a: typeof initialState,
  b: typeof initialState,
) {
  return (
    a.user?.updatedAt === b.user?.updatedAt &&
    a.organizationId === b.organizationId &&
    a.role === b.role &&
    a.permissions.every((perm, i) => perm === b.permissions[i])
  );
}

const NOOP_CLIENT: Client = {
  signIn: async () => {},
  signUp: async () => {},
  getUser: () => null,
  getAccessToken: () => Promise.reject(new LoginRequiredError()),
  signOut: () => {},
};
