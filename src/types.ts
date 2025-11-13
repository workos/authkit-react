import { createClient } from "@workos-inc/authkit-js";

export type Client = Pick<
  Awaited<ReturnType<typeof createClient>>,
  | "signIn"
  | "signUp"
  | "getUser"
  | "getAccessToken"
  | "signOut"
  | "switchToOrganization"
>;

export type CreateClientOptions = NonNullable<
  Parameters<typeof createClient>[1]
>;

// authkit-js emits a "authkit:tokenchange" event when the access token is
// refreshed. In a future version we may expose an API for subscribing to this
// to avoid augmenting the global namespace.
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
