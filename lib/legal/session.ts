const PENDING_POLICY_CONSENT_KEY = "anymarket:pending-policy-consent";

export function markPendingPolicyConsent() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PENDING_POLICY_CONSENT_KEY, "1");
}

export function consumePendingPolicyConsent(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const pending = sessionStorage.getItem(PENDING_POLICY_CONSENT_KEY) === "1";
  if (pending) {
    sessionStorage.removeItem(PENDING_POLICY_CONSENT_KEY);
  }
  return pending;
}
