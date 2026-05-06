import { resolveSelfServeTier } from "@/lib/shared/marketing/pricing";
import { SignupFlow } from "@/src/components/auth/SignupFlow";

interface SignupPageProps {
    searchParams: Promise<{
        email?: string | string[] | undefined;
        invite?: string | string[] | undefined;
        organizationName?: string | string[] | undefined;
        step?: string | string[] | undefined;
        tier?: string | string[] | undefined;
    }>;
}

export default async function SignupPage({
    searchParams,
}: SignupPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;
    const selectedTier = resolveSelfServeTier(resolvedSearchParams.tier);
    const initialEmail = Array.isArray(resolvedSearchParams.email)
        ? resolvedSearchParams.email[0]
        : resolvedSearchParams.email;
    const inviteToken = Array.isArray(resolvedSearchParams.invite)
        ? resolvedSearchParams.invite[0]
        : resolvedSearchParams.invite;
    const initialOrganizationName = Array.isArray(
        resolvedSearchParams.organizationName,
    )
        ? resolvedSearchParams.organizationName[0]
        : resolvedSearchParams.organizationName;
    const initialStep = Array.isArray(resolvedSearchParams.step)
        ? resolvedSearchParams.step[0]
        : resolvedSearchParams.step;

    if (selectedTier.shouldWarn) {
        console.warn(
            "[signup] Unsupported tier query parameter received; defaulting to free.",
        );
    }

    return (
        <SignupFlow
            initialEmail={initialEmail?.trim() || undefined}
            initialOrganizationName={initialOrganizationName?.trim() || undefined}
            initialStep={initialStep === "verify" ? "verify" : undefined}
            inviteToken={inviteToken?.trim() || undefined}
            selectedTier={selectedTier.tier}
        />
    );
}
