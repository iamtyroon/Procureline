import type { LucideIcon } from "lucide-react";
import {
    ArrowRight,
    ClipboardCheck,
    Send,
    ShieldCheck,
    Users,
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

interface Step {
    description: string;
    icon: LucideIcon;
    number: string;
    title: string;
}

const steps: Step[] = [
    {
        description:
            "Tenant Admin sets up departments, budgets, and user access so every planning unit starts inside the right workspace.",
        icon: Users,
        number: "01",
        title: "Onboard the institution",
    },
    {
        description:
            "Department users structure procurement needs in guided blocks for categories, items, and specifications.",
        icon: Workflow,
        number: "02",
        title: "Build the plan",
    },
    {
        description:
            "Procurement leadership validates submissions, watches quota posture, and closes any readiness gaps before export.",
        icon: ShieldCheck,
        number: "03",
        title: "Review and validate",
    },
    {
        description:
            "Generate the official output package and move the consolidated plan into final review and submission.",
        icon: Send,
        number: "04",
        title: "Export and submit",
    },
];

export function HowItWorks(): JSX.Element {
    return (
        <section
            id="how-it-works"
            aria-label="How it works"
            className="bg-muted/20 px-6 py-24"
        >
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <Badge
                        variant="secondary"
                        className="mb-4 gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
                    >
                        <ClipboardCheck className="h-4 w-4" />
                        Workflow overview
                    </Badge>
                    <h2 className="text-4xl font-semibold tracking-tight text-foreground">
                        A clear four-step path from setup to submission.
                    </h2>
                    <p className="mt-4 text-lg leading-8 text-muted-foreground">
                        Procureline keeps the handoff between departments and procurement leadership
                        visible, structured, and ready for review.
                    </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-4">
                    {steps.map((step, index) => {
                        const Icon = step.icon;

                        return (
                            <div key={step.number} className="relative">
                                <Card className="h-full border-border/60 bg-card/80 shadow-sm">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground"
                                            >
                                                {step.number}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <CardTitle className="text-xl text-foreground">
                                            {step.title}
                                        </CardTitle>
                                        <CardDescription className="mt-3 text-sm leading-7 text-muted-foreground">
                                            {step.description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>

                                {index < steps.length - 1 ? (
                                    <div className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 xl:block">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground">
                                            <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
