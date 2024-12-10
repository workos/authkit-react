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
    onRefresh,
    onRefreshFailure,
    onRedirectCallback,
    refreshBufferInterval,
  } = props;
  const [client, setClient] = React.useState<Client>(NOOP_CLIENT);
  const [state, setState] = React.useState(initialState);

  const handleRefresh = React.useCallback(
    (response: AuthenticationResponse) => {
      const { user, accessToken, organizationId } = response;
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
      onRefresh?.(response);
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
          onRefresh: handleRefresh,
          onRefreshFailure,
          refreshBufferInterval,
        }).then(async (client) => {
          const user = client.getUser();
          setClient({
            getAccessToken: client.getAccessToken.bind(client),
            getUser: client.getUser.bind(client),
            signIn: client.signIn.bind(client),
            signUp: client.signUp.bind(client),
            signOut: client.signOut.bind(client),
            switchToOrganization: client.switchToOrganization.bind(client),
          });
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
  }, [clientId, apiHostname, https, port, redirectUri, refreshBufferInterval]);

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
  switchToOrganization: () => Promise.resolve(),
  signOut: () => {},
};
