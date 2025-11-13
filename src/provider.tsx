"use client";

import * as React from "react";
import {
  createClient,
  getClaims,
  LoginRequiredError,
  OnRefreshResponse,
} from "@workos-inc/authkit-js";
import { AuthKitContext } from "./context";
import type { Client, CreateClientOptions } from "./client";
import { INITIAL_STATE, LOADING_STATE, State } from "./state";

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
  const [state, setState] = React.useState<State>(INITIAL_STATE);

  const handleRefresh = React.useCallback(
    (response: OnRefreshResponse) => {
      const {
        user,
        accessToken,
        organizationId = null,
        impersonator = null,
      } = response;
      const {
        role = null,
        roles = null,
        permissions = [],
        feature_flags: featureFlags = [],
      } = getClaims(accessToken);
      setState((prev) => {
        const next = {
          status: "authenticated-refreshed",
          isLoading: false,
          user,
          organizationId,
          role,
          roles,
          permissions,
          featureFlags,
          impersonator,
          accessToken,
        } satisfies State;
        return isEquivalentWorkOSSession(prev, next) ? prev : next;
      });
      onRefresh?.(response);
    },
    [client],
  );

  React.useEffect(() => {
    let isCurrentRun = true;
    function initialize() {
      const timeoutId = window.setTimeout(() => {
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
        }).then((client) => {
          if (!isCurrentRun) {
            return;
          }

          const user = client.getUser();
          setClient({
            getAccessToken: client.getAccessToken.bind(client),
            getUser: client.getUser.bind(client),
            signIn: client.signIn.bind(client),
            signUp: client.signUp.bind(client),
            signOut: client.signOut.bind(client),
            switchToOrganization: client.switchToOrganization.bind(client),
          });
          setState((prev) =>
            user
              ? {
                  ...prev,
                  status: "authenticated",
                  isLoading: false,
                  user,
                }
              : {
                  ...prev,
                  status: "unauthenticated",
                  isLoading: false,
                  user: null,
                  accessToken: null,
                },
          );
        });
      });

      return () => {
        isCurrentRun = false;
        window.clearTimeout(timeoutId);
      };
    }

    setClient(NOOP_CLIENT);
    setState(LOADING_STATE);

    return initialize();
  }, [clientId, apiHostname, https, port, redirectUri, refreshBufferInterval]);

  return (
    <AuthKitContext.Provider value={{ client, state }}>
      {children}
    </AuthKitContext.Provider>
  );
}

// poor-man's "deep equality" check
function isEquivalentWorkOSSession(a: State, b: State) {
  return (
    a.status === b.status &&
    a.user?.updatedAt === b.user?.updatedAt &&
    a.organizationId === b.organizationId &&
    a.role === b.role &&
    a.roles === b.roles &&
    a.permissions.length === b.permissions.length &&
    a.permissions.every((perm, i) => perm === b.permissions[i]) &&
    a.featureFlags.length === b.featureFlags.length &&
    a.featureFlags.every((flag, i) => flag === b.featureFlags[i]) &&
    a.impersonator?.email === b.impersonator?.email &&
    a.impersonator?.reason === b.impersonator?.reason &&
    a.accessToken === b.accessToken
  );
}

const NOOP_CLIENT: Client = {
  signIn: async () => {},
  signUp: async () => {},
  getUser: () => null,
  getAccessToken: () => Promise.reject(new LoginRequiredError()),
  switchToOrganization: () => Promise.resolve(),
  signOut: async () => {},
};
