export { useAuth } from "./hook";
export { AuthKitProvider } from "./provider";
export {
  getClaims,
  AuthKitError,
  LoginRequiredError,
} from "@workos-inc/authkit-js";
export type {
  User,
  AuthenticationMethod,
  AuthenticationResponse,
  JWTPayload,
  OnRefreshResponse,
} from "@workos-inc/authkit-js";
export type { Impersonator } from "./state";
