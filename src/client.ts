import { type createClient, LoginRequiredError } from "@workos-inc/authkit-js";

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

export const NOOP_CLIENT: Client = {
  signIn: async () => {},
  signUp: async () => {},
  getUser: () => null,
  getAccessToken: () => Promise.reject(new LoginRequiredError()),
  switchToOrganization: () => Promise.resolve(),
  signOut: async () => {},
};
