import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/src/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
    title: "Forgot Password — Procureline",
    description:
        "Request a Procureline password reset email to regain access to your account.",
};

interface ForgotPasswordPageProps {
    searchParams: Promise<{
        continueTo?: string | string[] | undefined;
    }>;
}

export default async function ForgotPasswordPage({
    searchParams,
}: ForgotPasswordPageProps) {
    const resolvedSearchParams = await searchParams;
    const continueTo = Array.isArray(resolvedSearchParams.continueTo)
        ? resolvedSearchParams.continueTo[0]
        : resolvedSearchParams.continueTo;

    return <ForgotPasswordForm continueTo={continueTo} />;
}
