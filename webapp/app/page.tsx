import type { Metadata } from "next";
import { Navbar } from "@/src/components/marketing/Navbar";
import { Hero } from "@/src/components/marketing/Hero";
import { TrustedBy } from "@/src/components/marketing/TrustedBy";
import { Features } from "@/src/components/marketing/Features";
import { HowItWorks } from "@/src/components/marketing/HowItWorks";
import { BlocklyShowcase } from "@/src/components/marketing/BlocklyShowcase";
import { Pricing } from "@/src/components/marketing/Pricing";
import { Compliance } from "@/src/components/marketing/Compliance";
import { Footer } from "@/src/components/marketing/Footer";
import { HomepagePublicAccessExperience } from "@/src/components/marketing/HomepagePublicAccessExperience";

export const metadata: Metadata = {
    title: "Procureline — University Procurement Planning, Simplified",
    description:
        "Transform annual procurement planning with visual block-based tools. Create GOK-compliant plans in hours, not weeks. Export ready-to-submit Excel files. Free forever tier available.",
    keywords: [
        "procurement",
        "university",
        "Kenya",
        "GOK",
        "PPRA",
        "Blockly",
        "compliance",
        "procurement planning",
        "AGPO",
    ],
    openGraph: {
        title: "Procureline — University Procurement Planning, Simplified",
        description:
            "Transform annual procurement planning with visual block-based tools. Create GOK-compliant plans in hours, not weeks.",
        type: "website",
        url: "https://procureline.co.ke",
        siteName: "Procureline",
    },
    twitter: {
        card: "summary_large_image",
        title: "Procureline — University Procurement Planning, Simplified",
        description:
            "Transform annual procurement planning with visual block-based tools. Create GOK-compliant plans in hours, not weeks.",
    },
    robots: "index, follow",
};

const organizationStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            name: "Procureline",
            url: "https://procureline.co.ke",
            description:
                "Procureline helps universities build procurement plans with Blockly-based workflows, automated compliance checks, and export-ready outputs.",
            areaServed: "Kenya",
            email: "support@procureline.co.ke",
        },
        {
            "@type": "WebSite",
            name: "Procureline",
            url: "https://procureline.co.ke",
        },
    ],
};

interface LandingPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LandingPage({
    searchParams,
}: LandingPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;

    return (
        <>
            {/* Skip-to-content link for keyboard users */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:outline-none"
            >
                Skip to main content
            </a>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(organizationStructuredData),
                }}
            />

            <Navbar />

            <main id="main-content" tabIndex={-1}>
                <Hero />
                <HomepagePublicAccessExperience searchParams={resolvedSearchParams} />
                <TrustedBy />
                <Features />
                <HowItWorks />
                <BlocklyShowcase />
                <Compliance />
                <Pricing />
            </main>

            <Footer />
        </>
    );
}
