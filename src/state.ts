import { User } from '@workos-inc/authkit-js';

export interface State {
  isLoading: boolean;
  user: User | null;
}

export const initialState: State = {
  isLoading: true,
  user: null,
};
