import { User } from "@workos-inc/authkit-js";

export interface Impersonator {
  email: string;
  reason: string | null;
}

type Status =
  | "initial"
  | "loading"
  | "authenticated"
  | "authenticated-refreshed"
  | "unauthenticated";

interface SharedState {
  status: Status;
  user: User | null;
  role: string | null;
  roles: string[] | null;
  organizationId: string | null;
  permissions: string[];
  featureFlags: string[];
  impersonator: Impersonator | null;
  accessToken: string | null;
}

interface InitialState extends SharedState {
  status: "initial";
  isLoading: true;
  user: null;
  role: null;
  roles: null;
  organizationId: null;
  permissions: [];
  featureFlags: [];
  impersonator: null;
  accessToken: null;
}

interface LoadingState extends SharedState {
  status: "loading";
  isLoading: true;
  user: null;
  role: null;
  roles: null;
  organizationId: null;
  permissions: [];
  featureFlags: [];
  impersonator: null;
  accessToken: null;
}

interface AuthenticatedState extends SharedState {
  status: "authenticated";
  isLoading: false;
  user: User;
  accessToken: string | null;
}

interface AuthenticatedRefreshedState extends SharedState {
  status: "authenticated-refreshed";
  isLoading: false;
  user: User;
  accessToken: string;
}

interface UnauthenticatedState extends SharedState {
  status: "unauthenticated";
  isLoading: false;
  user: null;
  accessToken: null;
}

// TODO: Add error states
export type State =
  | InitialState
  | LoadingState
  | AuthenticatedState
  | AuthenticatedRefreshedState
  | UnauthenticatedState;

export const INITIAL_STATE: InitialState = {
  status: "initial",
  isLoading: true,
  user: null,
  role: null,
  roles: null,
  organizationId: null,
  permissions: [],
  featureFlags: [],
  impersonator: null,
  accessToken: null,
};

export const LOADING_STATE: LoadingState = {
  ...INITIAL_STATE,
  status: "loading",
};
