interface Step {
    number: number;
    title: string;
    description: string;
}

const steps: Step[] = [
    {
        number: 1,
        title: "Setup Departments",
        description:
            "Admin creates departments and invites Departmental Users. Each user gets secure access to their planning workspace.",
    },
    {
        number: 2,
        title: "Plan with Blocks",
        description:
            "Departmental Users build their procurement plans using drag-and-drop blocks. Categories, items, quantities, and budgets — all visual.",
    },
    {
        number: 3,
        title: "Review & Validate",
        description:
            "Procurement Officer reviews submissions, ensures compliance quotas are met, and consolidates the master plan.",
    },
    {
        number: 4,
        title: "Export & Submit",
        description:
            "Generate the official GOK Excel template with one click. Ready for PPRA submission. Done!",
    },
];

export function HowItWorks(): JSX.Element {
    return (
        <section
            id="how-it-works"
            aria-label="How it works"
            className="bg-gray-50 px-6 py-24 text-gray-900 dark:bg-slate-900 dark:text-white"
        >
            <div className="mx-auto max-w-7xl">
                {/* Section Header */}
                <div className="mx-auto mb-16 max-w-2xl text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-primary">
                        🛤️ How It Works
                    </div>
                    <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                        From Chaos to Compliance in 4 Steps
                    </h2>
                    <p className="text-lg text-gray-500 dark:text-gray-400">
                        Streamline your entire procurement planning workflow with
                        Procureline.
                    </p>
                </div>

                {/* Steps Grid */}
                <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Connecting line */}
                    <div className="absolute left-[60px] right-[60px] top-10 hidden h-0.5 bg-gradient-to-r from-primary to-emerald-600 opacity-30 lg:block" />

                    {steps.map((step) => (
                        <div key={step.number} className="relative text-center">
                            <div className="relative z-10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-600 text-3xl font-bold text-white shadow-lg shadow-emerald-500/20">
                                {step.number}
                            </div>
                            <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
                            <p className="text-sm leading-relaxed text-gray-400">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
