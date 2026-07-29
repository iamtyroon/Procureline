import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComplianceRequirement {
    description: string;
    label: string;
    value: string;
}

const requirements: ComplianceRequirement[] = [
    {
        label: "AGPO",
        value: "30%",
        description: "Allocation reserved for youth, women, and PWD-owned suppliers",
    },
    {
        label: "PWD",
        value: "2%",
        description: "Persons-with-disability supplier requirement tracked in review",
    },
    {
        label: "Local content",
        value: "40%",
        description: "Local-content planning threshold under Buy Kenya Build Kenya",
    },
];

export function Compliance(): JSX.Element {
    return (
        <section
            id="compliance"
            aria-label="Compliance"
            className="bg-muted/30 px-6 py-28 dark:bg-card/30"
        >
            <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                        Compliance, built in
                    </p>
                    <h2 className="text-balance font-display text-4xl font-semibold tracking-[-0.02em] text-foreground md:text-5xl">
                        Statutory thresholds live inside the plan, not in a separate
                        spreadsheet.
                    </h2>
                    <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                        Procurement rules are attached to the planning workflow itself,
                        so quota gaps surface while a plan is still editable — not
                        after it has been exported and filed. Kenya&apos;s public
                        procurement thresholds ship configured out of the box.
                    </p>

                    <Button
                        asChild
                        size="lg"
                        className="mt-9 rounded-lg px-8 py-6 text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 active:scale-[0.98]"
                    >
                        <Link href="/signup">Start planning</Link>
                    </Button>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card p-2 shadow-lg">
                    <div className="divide-y divide-border/60">
                        {requirements.map((requirement) => (
                            <div
                                key={requirement.label}
                                className="flex items-baseline gap-6 px-6 py-6"
                            >
                                <span className="w-24 flex-shrink-0 font-display text-3xl font-semibold tabular-nums tracking-tight text-primary">
                                    {requirement.value}
                                </span>
                                <div>
                                    <p className="font-semibold text-foreground">
                                        {requirement.label}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        {requirement.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="m-2 flex items-start gap-3 rounded-xl bg-primary/[0.07] px-5 py-4">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                        <p className="text-sm leading-6 text-muted-foreground">
                            <span className="font-medium text-foreground">
                                Checked on every edit.
                            </span>{" "}
                            Each threshold is validated as blocks are added, so review
                            starts with posture already known.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
