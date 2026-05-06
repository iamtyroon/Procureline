import { redirect } from "next/navigation";
import { buildPricingRedirectTarget } from "@/lib/shared/marketing/pricing";

interface PricingPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PricingPage({
    searchParams,
}: PricingPageProps): Promise<never> {
    redirect(buildPricingRedirectTarget(await searchParams));
}
