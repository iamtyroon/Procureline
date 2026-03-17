import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    CheckCircle2,
    Download,
    Landmark,
    ShieldCheck,
    Users2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ComplianceRequirement {
    description: string;
    icon: LucideIcon;
    label: string;
    progress: number;
    toneClassName: string;
    value: string;
}

const requirements: ComplianceRequirement[] = [
    {
        description: "Youth, women, and PWD supplier allocation target",
        icon: Users2,
        label: "AGPO",
        progress: 30,
        toneClassName: "bg-primary/10 text-primary",
        value: "30%",
    },
    {
        description: "Persons with disability requirement tracked in review",
        icon: ShieldCheck,
        label: "PWD",
        progress: 40,
        toneClassName: "bg-secondary text-secondary-foreground",
        value: "2%",
    },
    {
        description: "Buy Kenya Build Kenya local-content planning threshold",
        icon: Landmark,
        label: "Local content",
        progress: 40,
        toneClassName: "bg-accent text-accent-foreground",
        value: "40%",
    },
];

export function Compliance(): JSX.Element {
    return (
        <section id="compliance" aria-label="GOK compliance" className="px-6 py-24">
            <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_34%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.45))] p-8 shadow-xl lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:p-10">
                <div>
                    <Badge
                        variant="secondary"
                        className="mb-4 gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Compliance intelligence
                    </Badge>
                    <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground">
                        Government compliance stays visible while plans are still in motion.
                    </h2>
                    <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                        Procureline keeps statutory thresholds attached to the planning workflow so
                        teams can resolve risks before export and submission.
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        {requirements.map((requirement) => {
                            const Icon = requirement.icon;

                            return (
                                <Card
                                    key={requirement.label}
                                    className="border-border/60 bg-card/80 shadow-sm"
                                >
                                    <CardContent className="p-5">
                                        <div
                                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${requirement.toneClassName}`}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <p className="mt-4 text-lg font-semibold text-foreground">
                                            {requirement.label}
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {requirement.value} requirement
                                        </p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                        <Button type="button" size="lg" className="gap-2 rounded-xl px-6">
                            <Download className="h-4 w-4" />
                            Download compliance guide
                        </Button>
                        <Button
                            type="button"
                            size="lg"
                            variant="outline"
                            className="gap-2 rounded-xl px-6"
                        >
                            <BarChart3 className="h-4 w-4" />
                            Review dashboard posture
                        </Button>
                    </div>
                </div>

                <Card className="border-border/60 bg-card/92 shadow-lg">
                    <CardHeader className="pb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl text-foreground">
                                    Compliance tracker
                                </CardTitle>
                                <CardDescription className="mt-1 text-sm text-muted-foreground">
                                    Live posture for fiscal-year procurement planning
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-0">
                        {requirements.map((requirement) => {
                            const Icon = requirement.icon;

                            return (
                                <div
                                    key={requirement.label}
                                    className="rounded-2xl border border-border/60 bg-muted/20 p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl ${requirement.toneClassName}`}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground">
                                                    {requirement.label}
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                    {requirement.description}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-foreground"
                                        >
                                            {requirement.value}
                                        </Badge>
                                    </div>

                                    <Progress
                                        value={requirement.progress}
                                        className="mt-4 h-2.5 bg-muted"
                                    />
                                </div>
                            );
                        })}

                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                <p className="font-semibold text-foreground">
                                    All tracked requirements are within the current planning guardrails.
                                </p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Procurement leadership can continue review without waiting for a
                                separate compliance spreadsheet.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
