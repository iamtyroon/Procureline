import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    FileSpreadsheet,
    History,
    ShieldCheck,
    Users2,
    Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface FeatureItem {
    description: string;
    icon: LucideIcon;
    iconClassName: string;
    title: string;
}

const features: FeatureItem[] = [
    {
        description:
            "Model categories, items, quantities, and specifications in a guided planning flow instead of a fragile spreadsheet.",
        icon: Workflow,
        iconClassName: "bg-primary/10 text-primary",
        title: "Visual planning workspace",
    },
    {
        description:
            "Keep AGPO, PWD, and local-content requirements visible as teams build, review, and submit departmental plans.",
        icon: ShieldCheck,
        iconClassName: "bg-secondary text-secondary-foreground",
        title: "Built-in compliance controls",
    },
    {
        description:
            "Export submission-ready outputs for review and filing without reformatting the planning data by hand.",
        icon: FileSpreadsheet,
        iconClassName: "bg-accent text-accent-foreground",
        title: "Submission-ready exports",
    },
    {
        description:
            "Coordinate tenant admins, procurement officers, and department users with clean role boundaries and shared visibility.",
        icon: Users2,
        iconClassName: "bg-primary/10 text-primary",
        title: "Role-based collaboration",
    },
    {
        description:
            "Monitor budget posture, submission progress, and departmental readiness from one fiscal-year dashboard.",
        icon: BarChart3,
        iconClassName: "bg-secondary text-secondary-foreground",
        title: "Budget and progress intelligence",
    },
    {
        description:
            "Preserve an auditable history of activity so reviews, approvals, and corrections stay attributable and transparent.",
        icon: History,
        iconClassName: "bg-accent text-accent-foreground",
        title: "Reliable audit history",
    },
];

export function Features(): JSX.Element {
    return (
        <section id="features" aria-label="Features" className="bg-background px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <Badge
                        variant="secondary"
                        className="mb-4 gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
                    >
                        <Workflow className="h-4 w-4" />
                        Platform capabilities
                    </Badge>
                    <h2 className="text-4xl font-semibold tracking-tight text-foreground">
                        A procurement operating system built for institutional planning.
                    </h2>
                    <p className="mt-4 text-lg leading-8 text-muted-foreground">
                        Every surface on Procureline is designed to help universities plan faster,
                        validate earlier, and submit with more confidence.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {features.map((feature) => {
                        const Icon = feature.icon;

                        return (
                            <Card
                                key={feature.title}
                                className="border-border/60 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                            >
                                <CardHeader className="pb-4">
                                    <div
                                        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${feature.iconClassName}`}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <CardTitle className="text-xl text-foreground">
                                        {feature.title}
                                    </CardTitle>
                                    <CardDescription className="mt-3 text-sm leading-7 text-muted-foreground">
                                        {feature.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
