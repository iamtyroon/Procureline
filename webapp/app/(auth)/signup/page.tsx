import { resolveSelfServeTier } from "@/lib/marketing/pricing";
import { SignupFlow } from "@/src/components/auth/SignupFlow";

interface SignupPageProps {
    searchParams: Promise<{
        tier?: string | string[] | undefined;
    }>;
}

export default async function SignupPage({
    searchParams,
}: SignupPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;
    const selectedTier = resolveSelfServeTier(resolvedSearchParams.tier);

    if (selectedTier.shouldWarn) {
        console.warn(
            "[signup] Unsupported tier query parameter received; defaulting to free.",
        );
    }

    return <SignupFlow selectedTier={selectedTier.tier} />;
}
