import * as React from "react";
import type { State } from "./state";
import type { Client } from "./client";
import { AuthKitContext } from "./context";

export function useAuth(): Client & State {
  const context = React.useContext(AuthKitContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthKitProvider");
  }

  return React.useMemo(
    () => ({ ...context.client, ...context.state }),
    [context.client, context.state],
  );
}
