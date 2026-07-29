import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    FileSpreadsheet,
    History,
    ShieldCheck,
    Users2,
    Workflow,
} from "lucide-react";

interface FeatureItem {
    description: string;
    icon: LucideIcon;
    title: string;
    className: string;
}

const features: FeatureItem[] = [
    {
        title: "Visual planning workspace",
        description:
            "Model categories, items, quantities, and specifications in a guided planning flow instead of a fragile spreadsheet. Every block carries its own budget math, so totals stay correct as the plan grows.",
        icon: Workflow,
        className: "md:col-span-4",
    },
    {
        title: "Built-in compliance controls",
        description:
            "AGPO, PWD, and local-content requirements stay visible as teams build, review, and submit departmental plans.",
        icon: ShieldCheck,
        className: "md:col-span-2",
    },
    {
        title: "Submission-ready exports",
        description:
            "Export official outputs for review and filing without reformatting planning data by hand.",
        icon: FileSpreadsheet,
        className: "md:col-span-2",
    },
    {
        title: "Role-based collaboration",
        description:
            "Tenant admins, procurement officers, and department users work with clean role boundaries and shared visibility.",
        icon: Users2,
        className: "md:col-span-2",
    },
    {
        title: "Budget and progress intelligence",
        description:
            "Monitor budget posture, submission progress, and departmental readiness from one fiscal-year dashboard.",
        icon: BarChart3,
        className: "md:col-span-2",
    },
    {
        title: "Reliable audit history",
        description:
            "Every review, approval, and correction stays attributable and transparent — a full history your auditors can actually follow, without a single extra spreadsheet.",
        icon: History,
        className: "md:col-span-6",
    },
];

export function Features(): JSX.Element {
    return (
        <section id="features" aria-label="Features" className="bg-background px-6 py-28">
            <div className="mx-auto max-w-7xl">
                <div className="mb-16 max-w-2xl">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                        Platform capabilities
                    </p>
                    <h2 className="text-balance font-display text-4xl font-semibold tracking-[-0.02em] text-foreground md:text-5xl">
                        A procurement operating system for institutional planning.
                    </h2>
                    <p className="mt-5 text-lg leading-8 text-muted-foreground">
                        Every surface on Procureline helps institutions plan faster,
                        validate earlier, and submit with more confidence.
                    </p>
                </div>

                <div className="grid gap-5 md:grid-cols-6">
                    {features.map((feature) => {
                        const Icon = feature.icon;

                        return (
                            <article
                                key={feature.title}
                                className={`group relative overflow-hidden rounded-2xl bg-muted/40 p-7 transition-colors duration-300 hover:bg-muted/70 dark:bg-card/60 dark:hover:bg-card ${feature.className}`}
                            >
                                <div
                                    className="bg-dot-grid pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
                                    aria-hidden="true"
                                />
                                <div className="relative">
                                    <Icon
                                        className="h-6 w-6 text-primary"
                                        strokeWidth={1.75}
                                    />
                                    <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-foreground">
                                        {feature.title}
                                    </h3>
                                    <p className="mt-2.5 max-w-prose text-sm leading-7 text-muted-foreground">
                                        {feature.description}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
