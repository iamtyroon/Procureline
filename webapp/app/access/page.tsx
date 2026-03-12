import type { Metadata } from "next";
import { PublicAccessGate } from "@/src/components/auth/PublicAccessGate";
import { Footer } from "@/src/components/marketing/Footer";
import { Navbar } from "@/src/components/marketing/Navbar";
import { PublicAccessSection } from "@/src/components/marketing/PublicAccessSection";

export const metadata: Metadata = {
    title: "Access - Procureline",
    description:
        "Choose the correct Procureline access path for institution signup, Procurement Officer guidance, Department User guidance, or existing-account sign in.",
};

interface AccessPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccessPage({
    searchParams,
}: AccessPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;

    return (
        <PublicAccessGate>
            <>
                <Navbar />
                <main className="pt-20">
                    <PublicAccessSection searchParams={resolvedSearchParams} />
                </main>
                <Footer />
            </>
        </PublicAccessGate>
    );
}
