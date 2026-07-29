interface Step {
    description: string;
    number: string;
    title: string;
    actor: string;
}

const steps: Step[] = [
    {
        number: "01",
        title: "Onboard the institution",
        actor: "Tenant Admin",
        description:
            "Set up departments, budgets, and user access so every planning unit starts inside the right workspace.",
    },
    {
        number: "02",
        title: "Build the plan",
        actor: "Department Users",
        description:
            "Structure procurement needs in guided blocks for categories, items, and specifications — budgets calculate as you build.",
    },
    {
        number: "03",
        title: "Review and validate",
        actor: "Procurement Officer",
        description:
            "Validate submissions, watch quota posture, and close readiness gaps before anything is exported.",
    },
    {
        number: "04",
        title: "Export and submit",
        actor: "Procurement leadership",
        description:
            "Generate the official output package and move the consolidated plan into final review and submission.",
    },
];

export function HowItWorks(): JSX.Element {
    return (
        <section
            id="how-it-works"
            aria-label="How it works"
            className="bg-muted/30 px-6 py-28 dark:bg-card/30"
        >
            <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="lg:sticky lg:top-28 lg:self-start">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                        Workflow overview
                    </p>
                    <h2 className="text-balance font-display text-4xl font-semibold tracking-[-0.02em] text-foreground md:text-5xl">
                        From setup to submission in four steps.
                    </h2>
                    <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">
                        Procureline keeps the handoff between departments and
                        procurement leadership visible, structured, and ready for
                        review.
                    </p>
                </div>

                <ol className="divide-y divide-border/70">
                    {steps.map((step) => (
                        <li key={step.number} className="group flex gap-8 py-8 first:pt-0 last:pb-0">
                            <span
                                aria-hidden="true"
                                className="select-none font-display text-6xl font-semibold leading-none tracking-tight text-primary/20 transition-colors duration-300 group-hover:text-primary/50 md:text-7xl"
                            >
                                {step.number}
                            </span>
                            <div className="pt-1.5">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {step.actor}
                                </p>
                                <h3 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-foreground">
                                    {step.title}
                                </h3>
                                <p className="mt-2.5 max-w-lg text-sm leading-7 text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
