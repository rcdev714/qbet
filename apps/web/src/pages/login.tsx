import { formatAuthError, getBetaAccessIntent } from "@anymarkt/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

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
import { useAuth } from "@/contexts/auth-context";

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signupMode = params.get("mode") === "signup";

  const [isLogin, setIsLogin] = useState(!signupMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [approvedIntent, setApprovedIntent] = useState(false);

  useEffect(() => {
    setIsLogin(params.get("mode") !== "signup");
  }, [params]);

  useEffect(() => {
    const paramEmail = params.get("email");
    if (paramEmail) {
      setEmail(paramEmail);
      return;
    }
    void getBetaAccessIntent().then((intent) => {
      if (intent?.email) setEmail(intent.email);
      if (intent?.status === "approved") setApprovedIntent(true);
    });
  }, [params]);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
      } else {
        const { user: newUser, error: signUpError } = await signUp(email, password);
        if (signUpError) throw signUpError;
        if (!newUser) {
          setInfo("Check your email to confirm your account, then sign in.");
          setIsLogin(true);
        }
      }
    } catch (err) {
      setError(
        formatAuthError(err, {
          invalidCredentials: "Invalid email or password.",
          userAlreadyExists: "An account with this email already exists.",
          weakPassword: "Password is too weak. Use at least 6 characters.",
          invalidEmail: "Please enter a valid email address.",
          generic: "Something went wrong. Please try again.",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-4">
        <Card className="animate-fade-up border-border/80 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>{isLogin ? "Sign in" : "Create account"}</CardTitle>
            <CardDescription>
              {approvedIntent
                ? "Your beta access is approved — create your account to continue."
                : "Use the email from your beta approval when signing up."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            {info ? <Alert variant="success">{info}</Alert> : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {!isLogin ? (
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? "Please wait…"
                  : isLogin
                    ? "Sign in"
                    : "Create account"}
              </Button>
            </form>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={submitting}
              onClick={() => void signInWithGoogle()}
            >
              Continue with Google
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setIsLogin((v) => !v);
                setError(null);
                setInfo(null);
              }}
            >
              {isLogin
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              No invite yet?{" "}
              <Link to="/request-access" className="font-medium text-primary hover:underline">
                Request access
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
