/**
 * Checks if the provided email is in the list of admin emails.
 * The output depends on the EXPO_PUBLIC_ADMIN_EMAIL environment variable,
 * which can be a single email or a comma-separated list of emails.
 *
 * @param email The user's email to check
 * @returns true if the email is in the admin list, false otherwise
 */
export const isAdminEmail = (email?: string | null): boolean => {
    if (!email) return false;

    const adminEmailsVar = process.env.EXPO_PUBLIC_ADMIN_EMAIL;
    if (!adminEmailsVar) return false;

    const adminEmails = adminEmailsVar.split(",").map((e) =>
        e.trim().toLowerCase()
    );
    return adminEmails.includes(email.trim().toLowerCase());
};
