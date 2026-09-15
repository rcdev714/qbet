import * as React from "react";

import { cn } from "@/lib/utils";

export function Alert({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive" | "success" | "warning";
}) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-xl border px-4 py-3 text-sm",
        variant === "default" && "border-border bg-muted/60 text-foreground",
        variant === "destructive" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "success" &&
          "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        variant === "warning" &&
          "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        className,
      )}
      {...props}
    />
  );
}
