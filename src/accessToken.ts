import { getClaims, type JwtPayload } from "@workos-inc/authkit-js";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useAuth } from "./hook";

interface TokenState {
  token: string | undefined;
  loading: boolean;
  error: Error | null;
}

type TokenAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; token: string | undefined }
  | { type: "FETCH_ERROR"; error: Error }
  | { type: "RESET" };

function tokenReducer(state: TokenState, action: TokenAction): TokenState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, token: action.token };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "RESET":
      return { ...state, token: undefined, loading: false, error: null };
    // istanbul ignore next
    default:
      return state;
  }
}

const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
const MIN_REFRESH_DELAY_SECONDS = 15; // minimum delay before refreshing token
const RETRY_DELAY_SECONDS = 300; // 5 minutes

interface TokenData {
  exp: number;
  timeUntilExpiry: number;
  isExpiring: boolean;
}

function parseToken(token: string): TokenData | null {
  try {
    const claims = getClaims(token);
    const now = Date.now() / 1000;
    const exp = claims.exp ?? 0;
    const timeUntilExpiry = exp - now;
    const isExpiring = timeUntilExpiry <= TOKEN_EXPIRY_BUFFER_SECONDS;

    return { exp, timeUntilExpiry, isExpiring };
  } catch {
    return null;
  }
}

function getRefreshDelay(timeUntilExpiry: number): number {
  const refreshTime = Math.max(
    timeUntilExpiry - TOKEN_EXPIRY_BUFFER_SECONDS,
    MIN_REFRESH_DELAY_SECONDS,
  );
  return refreshTime * 1000; // convert to milliseconds
}

/**
 * A hook that manages access tokens with automatic refresh.
 *
 * @example
 * ```ts
 * const { accessToken, loading, error, refresh } = useAccessToken();
 * ```
 *
 * @returns An object containing the access token, loading state, error state, and a refresh function.
 */
export function useAccessToken() {
  const auth = useAuth();
  const user = auth.user;
  const userId = user?.id;
  const [state, dispatch] = useReducer(tokenReducer, {
    token: undefined,
    loading: false,
    error: null,
  });

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const fetchingRef = useRef(false);

  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = undefined;
    }
  }, []);

  const updateToken = useCallback(async () => {
    if (fetchingRef.current || !auth) {
      return;
    }

    fetchingRef.current = true;
    dispatch({ type: "FETCH_START" });
    try {
      let token = await auth.getAccessToken();
      if (token) {
        const tokenData = parseToken(token);
        if (!tokenData || tokenData.isExpiring) {
          // Force refresh by getting a new token
          // The authkit-js client handles refresh internally
          token = await auth.getAccessToken();
        }
      }

      dispatch({ type: "FETCH_SUCCESS", token });

      if (token) {
        const tokenData = parseToken(token);
        if (tokenData) {
          const delay = getRefreshDelay(tokenData.timeUntilExpiry);
          clearRefreshTimeout();
          refreshTimeoutRef.current = setTimeout(updateToken, delay);
        }
      }

      return token;
    } catch (error) {
      dispatch({
        type: "FETCH_ERROR",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      refreshTimeoutRef.current = setTimeout(
        updateToken,
        RETRY_DELAY_SECONDS * 1000,
      );
    } finally {
      fetchingRef.current = false;
    }
  }, [auth, clearRefreshTimeout]);

  const refresh = useCallback(async () => {
    if (fetchingRef.current || !auth) {
      return;
    }

    fetchingRef.current = true;
    dispatch({ type: "FETCH_START" });

    try {
      // The authkit-js client handles token refresh internally
      const token = await auth.getAccessToken();

      dispatch({ type: "FETCH_SUCCESS", token });

      if (token) {
        const tokenData = parseToken(token);
        if (tokenData) {
          const delay = getRefreshDelay(tokenData.timeUntilExpiry);
          clearRefreshTimeout();
          refreshTimeoutRef.current = setTimeout(updateToken, delay);
        }
      }

      return token;
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      dispatch({ type: "FETCH_ERROR", error: typedError });
      refreshTimeoutRef.current = setTimeout(
        updateToken,
        RETRY_DELAY_SECONDS * 1000,
      );
    } finally {
      fetchingRef.current = false;
    }
  }, [auth, clearRefreshTimeout, updateToken]);

  useEffect(() => {
    if (!user) {
      dispatch({ type: "RESET" });
      clearRefreshTimeout();
      return;
    }
    updateToken();

    return clearRefreshTimeout;
  }, [userId, updateToken, clearRefreshTimeout]);

  return {
    accessToken: state.token,
    loading: state.loading,
    error: state.error,
    refresh,
  };
}

type TokenClaims<T> = Partial<JwtPayload & T>;

/**
 * Extracts token claims from the access token.
 *
 * @example
 * ```ts
 * const { customClaim } = useTokenClaims<{ customClaim: string }>();
 * console.log(customClaim);
 * ```
 *
 * @return The token claims as a record of key-value pairs.
 */
export function useTokenClaims<T = Record<string, unknown>>(): TokenClaims<T> {
  const { accessToken } = useAccessToken();

  return useMemo(() => {
    if (!accessToken) {
      return {};
    }

    try {
      return getClaims<T>(accessToken);
    } catch {
      return {};
    }
  }, [accessToken]);
}
