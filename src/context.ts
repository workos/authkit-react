"use client";

import * as React from "react";
import { Client } from "./types";
import { State, initialState } from "./state";

export interface ContextValue extends Client, State {
  accessToken: string | null;
}

export const Context = React.createContext<ContextValue>({
  ...initialState,
  signIn: () => Promise.reject(),
  signUp: () => Promise.reject(),
  getUser: () => null,
  getAccessToken: () => Promise.reject(),
  signOut: () => Promise.reject(),
  switchToOrganization: () => Promise.reject(),
  accessToken: null,
});
