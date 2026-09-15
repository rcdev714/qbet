import {
  BetaAccessAlreadySubmittedError,
  betaAccessService,
  formatBetaAccessSubmitError,
  getWhatsAppContactUrl,
  saveSubmittedIntent,
  WHATSAPP_CONTACT_DISPLAY,
} from "@anymarkt/shared";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";

const BETA_COUNTRIES = [
  { code: "EC", label: "Ecuador" },
  { code: "US", label: "United States" },
  { code: "MX", label: "Mexico" },
  { code: "CO", label: "Colombia" },
  { code: "BR", label: "Brazil" },
] as const;

export function RequestAccessPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("EC");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prefill = params.get("email") ?? user?.email ?? "";
    if (prefill) setEmail(prefill);
  }, [params, user?.email]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !fullName.trim() || !countryCode) {
      setError("Please fill in email, full name, and country.");
      return;
    }

    setSubmitting(true);
    try {
      const requestId = await betaAccessService.submitRequest({
        email,
        fullName,
        countryCode,
        message: message || null,
      });
      await saveSubmittedIntent(email, requestId);
      setSubmittedEmail(email.trim().toLowerCase());
      setSubmitted(true);
      setAlreadySubmitted(false);
    } catch (err) {
      if (err instanceof BetaAccessAlreadySubmittedError) {
        setAlreadySubmitted(true);
        setSubmittedEmail(email.trim().toLowerCase());
        setError(null);
      } else {
        setError(formatBetaAccessSubmitError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-5 pb-16 pt-4">
        <Card className="animate-fade-up border-border/80 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Request beta access</CardTitle>
            <CardDescription>
              Private beta for Ecuador first. We will email you when approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitted ? (
              <Alert variant="success" className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Request submitted</p>
                  <p className="mt-1 text-muted-foreground">
                    We will reach out at <strong>{submittedEmail}</strong> when
                    your access is approved.
                  </p>
                </div>
              </Alert>
            ) : null}

            {alreadySubmitted ? (
              <Alert variant="warning">
                You already submitted a request for{" "}
                <strong>{submittedEmail || email}</strong>. Check your inbox for
                an approval email, or contact us on WhatsApp.
              </Alert>
            ) : null}

            {error ? <Alert variant="destructive">{error}</Alert> : null}

            {!submitted ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {BETA_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How did you hear about Anymarkt?"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit request"}
                </Button>
              </form>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Already approved? Sign in</Link>
              </Button>
            )}

            <a
              href={getWhatsAppContactUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              WhatsApp {WHATSAPP_CONTACT_DISPLAY}
              <ExternalLink className="size-3.5" />
            </a>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
