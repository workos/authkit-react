"use client";

import * as React from "react";
import {
  AuthenticationResponse,
  createClient,
  getClaims,
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
      setState((prev) => ({
        ...prev,
        user,
        organizationId: organizationId ?? null,
        role,
        permissions,
      }));
    },
    [client]
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

const NOOP_CLIENT: Client = {
  signIn: async () => {},
  signUp: async () => {},
  getUser: () => null,
  getAccessToken: () => Promise.resolve(undefined),
  refreshSession: async () => {},
  signOut: () => {},
};
