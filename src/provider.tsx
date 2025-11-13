"use client";

import * as React from "react";
import {
  createClient,
  getClaims,
  LoginRequiredError,
  OnRefreshResponse,
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
          ...prev,
          user,
          organizationId,
          role,
          roles,
          permissions,
          featureFlags,
          impersonator,
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

  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  React.useEffect(() => {
    const handleAccessTokenChange = (
      event: CustomEvent<{ accessToken: string }>,
    ) => {
      setAccessToken(event.detail.accessToken);
    };

    // authkit-js emits a "authkit:tokenchange" event when the access token is
    // refreshed. We want to use this to update the state with the new access
    // token so that it is available and up-to-date at render-time.
    window.addEventListener("authkit:tokenchange", handleAccessTokenChange);
    return () => {
      window.removeEventListener(
        "authkit:tokenchange",
        handleAccessTokenChange,
      );
    };
  }, []);

  return (
    <Context.Provider value={{ ...client, ...state, accessToken }}>
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
    a.roles === b.roles &&
    a.permissions.length === b.permissions.length &&
    a.permissions.every((perm, i) => perm === b.permissions[i]) &&
    a.featureFlags.length === b.featureFlags.length &&
    a.featureFlags.every((flag, i) => flag === b.featureFlags[i]) &&
    a.impersonator?.email === b.impersonator?.email &&
    a.impersonator?.reason === b.impersonator?.reason
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

// TODO: Move this to a global declaration file. Requires some re-configuring of tsconfig.json.
declare global {
  interface CustomEventMap {
    "authkit:tokenchange": CustomEvent<{ accessToken: string }>;
  }
  interface Window {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void;
    removeEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void;
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): void;
  }
}
