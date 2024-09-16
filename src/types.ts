import { createClient } from "@workos-inc/authkit-js";

export type Client = Awaited<ReturnType<typeof createClient>>;
export type CreateClientOptions = NonNullable<
  Parameters<typeof createClient>[1]
>;
