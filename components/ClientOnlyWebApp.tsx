import { useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import { getInitialClientMountState } from "@/lib/web-client-mount.logic";

export function ClientOnlyWebApp({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(getInitialClientMountState(Platform.OS === "web"));

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <>{children}</>;
}
