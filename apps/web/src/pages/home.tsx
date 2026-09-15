import { BRAND_NAME, TAGLINE } from "@anymarkt/shared";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export function HomePage() {
  return (
    <div className="dark min-h-dvh bg-[#030712] text-white">
      <SiteHeader tone="dark" />
      <main className="relative mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-5xl flex-col justify-center px-5 pb-16 pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-64 w-[min(100%,42rem)] rounded-full bg-blue-500/20 blur-3xl animate-pulse-soft"
        />
        <p className="animate-fade-up font-serif text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
          {BRAND_NAME}
        </p>
        <h1 className="animate-fade-up-delay mt-4 max-w-2xl font-sans text-xl font-medium text-slate-200 sm:text-2xl">
          {TAGLINE}
        </h1>
        <p className="animate-fade-up-delay mt-4 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
          Private group prediction markets for friends, teams, and communities.
          Request beta access, then sign in when you are approved.
        </p>
        <div className="animate-fade-up-delay mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/request-access">
              Request access
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
