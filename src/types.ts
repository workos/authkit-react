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
