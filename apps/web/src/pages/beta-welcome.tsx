import {
  betaAccessService,
  saveApprovedIntent,
} from "@anymarkt/shared";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { SiteHeader } from "@/components/site-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BetaWelcomePage() {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const token = params.get("token");
    if (!token) {
      setError("This approval link is missing a token. Request access again or contact support.");
      setLoading(false);
      return;
    }

    betaAccessService
      .resolveApprovalToken(token)
      .then(async (resolved) => {
        if (!mounted) return;
        if (!resolved) {
          setError("This approval link is invalid or expired.");
          return;
        }
        setEmail(resolved.email);
        await saveApprovedIntent({
          email: resolved.email,
          requestId: resolved.request_id,
          approvalToken: token,
        });
      })
      .catch(() => {
        if (mounted) setError("This approval link is invalid or expired.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [params]);

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col justify-center px-5 pb-16 pt-8">
        <Card className="animate-fade-up border-border/80 bg-card/90 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle>Beta welcome</CardTitle>
            <CardDescription>
              Finish setup with the email from your approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm">Validating your approval link…</p>
              </div>
            ) : error ? (
              <>
                <Alert variant="destructive">{error}</Alert>
                <Button asChild className="w-full">
                  <Link to="/request-access">Request access</Link>
                </Button>
              </>
            ) : (
              <>
                <Alert variant="success" className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="font-semibold">You are approved</p>
                    <p className="mt-1">
                      Welcome{email ? `, ${email}` : ""}. Create your account to
                      enter the beta.
                    </p>
                  </div>
                </Alert>
                <Button asChild className="w-full" size="lg">
                  <Link
                    to={`/login?mode=signup${email ? `&email=${encodeURIComponent(email)}` : ""}`}
                  >
                    Sign up
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link
                    to={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                  >
                    Sign in instead
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
