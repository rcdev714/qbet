import { getPublicEnv } from "./public-env";

/**
 * UI-only admin hint. Authoritative admin checks use DB `is_admin` via `is_app_admin()`.
 */
export const isAdminEmail = (email?: string | null): boolean => {
    if (!email) return false;

    const adminEmailsVar = getPublicEnv().adminEmail;
    if (!adminEmailsVar) return false;

    const adminEmails = adminEmailsVar.split(",").map((e: string) =>
        e.trim().toLowerCase()
    );
    return adminEmails.includes(email.trim().toLowerCase());
};

/**
 * True when the user is an app admin via DB flag or configured admin email.
 */
export function isAppAdmin(
    user?: { email?: string | null; is_admin?: boolean | null } | null,
): boolean {
    return user?.is_admin === true || isAdminEmail(user?.email);
}
