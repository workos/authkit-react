import { User } from "@workos-inc/authkit-js";

export interface Impersonator {
  email: string;
  reason: string | null;
}

export interface State {
  isLoading: boolean;
  user: User | null;
  role: string | null;
  roles: string[] | null;
  organizationId: string | null;
  permissions: string[];
  featureFlags: string[];
  impersonator: Impersonator | null;
}

export const initialState: State = {
  isLoading: true,
  user: null,
  role: null,
  roles: null,
  organizationId: null,
  permissions: [],
  featureFlags: [],
  impersonator: null,
};
