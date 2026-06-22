import React, { ReactNode } from "react";

import { WalletProvider } from "@/contexts/WalletContext";

export function WalletShell({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
