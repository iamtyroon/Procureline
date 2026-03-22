import type { Metadata } from "next";
import { getSingleSearchParam } from "@/lib/auth/password-reset";
import { readPlatformAdminRequestContext } from "@/lib/platform-admin/request-context";
import { PlatformAdminLoginForm } from "@/src/components/auth/PlatformAdminLoginForm";

export const metadata: Metadata = {
    title: "Platform Admin Login - Procureline",
    description: "Secure sign-in for Procureline Platform Administrators.",
};

interface PlatformAdminLoginPageProps {
    searchParams: Promise<{
        reason?: string | string[] | undefined;
    }>;
}

export default async function PlatformAdminLoginPage({
    searchParams,
}: PlatformAdminLoginPageProps) {
    const resolvedSearchParams = await searchParams;
    const requestContext = await readPlatformAdminRequestContext();

    return (
        <PlatformAdminLoginForm
            reason={getSingleSearchParam(resolvedSearchParams.reason) ?? null}
            requestContext={requestContext}
        />
    );
}
