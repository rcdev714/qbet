import { BRAND_NAME } from "@anymarkt/shared";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export function SiteHeader({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <header
      className={cn(
        "mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5",
        className,
      )}
    >
      <Link
        to="/"
        className={cn(
          "font-serif text-2xl font-semibold tracking-tight",
          dark ? "text-white" : "text-foreground",
        )}
      >
        {BRAND_NAME}
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/request-access"
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            dark
              ? "text-slate-300 hover:bg-white/10 hover:text-white"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Request access
        </Link>
        <Link
          to="/login"
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
            dark
              ? "bg-white text-[#030712] hover:bg-slate-100"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
