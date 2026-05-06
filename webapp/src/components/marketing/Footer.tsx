import Link from "next/link";
import { ArrowRight, Building2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MARKETING_ACCESS_CTA } from "@/lib/shared/auth/public-entry";

interface FooterLink {
    href: string;
    label: string;
}

interface FooterColumn {
    links: FooterLink[];
    title: string;
}

const columns: FooterColumn[] = [
    {
        title: "Product",
        links: [
            { href: "/#features", label: "Features" },
            { href: "/#how-it-works", label: "How It Works" },
            { href: "/#pricing", label: "Pricing" },
            { href: "/#compliance", label: "Compliance" },
        ],
    },
    {
        title: "Access",
        links: [
            { href: MARKETING_ACCESS_CTA.href, label: MARKETING_ACCESS_CTA.label },
            { href: "/signup", label: "Register University" },
            { href: "/login", label: "Sign In" },
            { href: "mailto:support@procureline.co.ke", label: "Contact Support" },
        ],
    },
];

export function Footer(): JSX.Element {
    return (
        <footer aria-label="Site footer" className="border-t border-border/60 bg-background px-6 py-16">
            <div className="mx-auto max-w-7xl">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold tracking-tight text-foreground">
                                    Procure<span className="text-primary">line</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Procurement planning for modern institutions
                                </p>
                            </div>
                        </div>

                        <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
                            Procureline gives universities a cleaner path to role-based planning,
                            compliance review, and submission-ready procurement outputs.
                        </p>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <Button asChild className="gap-2 rounded-xl px-6">
                                <Link href={MARKETING_ACCESS_CTA.href}>
                                    {MARKETING_ACCESS_CTA.label}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="gap-2 rounded-xl px-6">
                                <a href="mailto:support@procureline.co.ke">
                                    <Mail className="h-4 w-4" />
                                    support@procureline.co.ke
                                </a>
                            </Button>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                    <p className="font-medium text-foreground">
                                        Role-aware onboarding
                                    </p>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Institution setup stays public while provisioned roles continue
                                    through secure, guided access paths.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                                <div className="flex items-center gap-3">
                                    <Mail className="h-5 w-5 text-primary" />
                                    <p className="font-medium text-foreground">Need assistance?</p>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Reach the Procureline team for rollout guidance, pricing
                                    questions, or onboarding support.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-8 sm:grid-cols-2">
                        {columns.map((column) => (
                            <div key={column.title}>
                                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                                    {column.title}
                                </h2>
                                <ul className="mt-4 space-y-3">
                                    {column.links.map((link) => (
                                        <li key={link.label}>
                                            <a
                                                href={link.href}
                                                className="text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator className="my-8" />

                <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <p>Copyright {new Date().getFullYear()} Procureline. All rights reserved.</p>
                    <p>Built for accountable university procurement planning.</p>
                </div>
            </div>
        </footer>
    );
}
