import { getPublicEnv } from "./public-env";

/**
 * Checks if the provided email is in the list of admin emails.
 * Reads from app.config.js extra via getPublicEnv() so web production export works.
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
