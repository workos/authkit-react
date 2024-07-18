import * as React from "react";
import { Context } from "./context";

export function useAuth() {
  const context = React.useContext(Context);

  if (!context) {
    throw new Error("useAuth must be used within a WorkOSProvider");
  }

  return context;
}
