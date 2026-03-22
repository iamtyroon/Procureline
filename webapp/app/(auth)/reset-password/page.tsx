import type { Metadata } from "next";
import {
    getSingleSearchParam,
    parsePasswordResetExpiresAt,
} from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "@/src/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
    title: "Reset Password — Procureline",
    description:
        "Complete your Procureline password reset with the email link or reset code.",
};

interface ResetPasswordPageProps {
    searchParams: Promise<{
        code?: string | string[] | undefined;
        email?: string | string[] | undefined;
        expiresAt?: string | string[] | undefined;
        platformResetToken?: string | string[] | undefined;
    }>;
}

export default async function ResetPasswordPage({
    searchParams,
}: ResetPasswordPageProps) {
    const resolvedSearchParams = await searchParams;

    return (
        <ResetPasswordForm
            initialCode={getSingleSearchParam(resolvedSearchParams.code)}
            initialEmail={getSingleSearchParam(resolvedSearchParams.email)}
            initialExpiresAt={parsePasswordResetExpiresAt(
                resolvedSearchParams.expiresAt,
            )}
            initialPlatformResetToken={getSingleSearchParam(
                resolvedSearchParams.platformResetToken,
            )}
        />
    );
}
