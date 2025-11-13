"use client";

import * as React from "react";
import type { Client } from "./client";
import type { State } from "./state";

export interface AuthKitContextValue {
  client: Client;
  state: State;
}

export const AuthKitContext = React.createContext<AuthKitContextValue | null>(
  null,
);
AuthKitContext.displayName = "AuthKitContext";
