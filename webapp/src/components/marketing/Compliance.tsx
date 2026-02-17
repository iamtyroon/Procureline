interface ComplianceBadge {
    icon: string;
    label: string;
    percentage: string;
    description: string;
    barWidth: string;
    barColor: string;
}

const badges: ComplianceBadge[] = [
    {
        icon: "👥",
        label: "AGPO",
        percentage: "30%",
        description: "Youth, Women, PWD",
        barWidth: "30%",
        barColor: "bg-primary",
    },
    {
        icon: "♿",
        label: "PWD",
        percentage: "2%",
        description: "Persons with Disability",
        barWidth: "40%", // Visual scale — 2% would be too narrow to see
        barColor: "bg-blue-500",
    },
    {
        icon: "🇰🇪",
        label: "Local Content",
        percentage: "40%",
        description: "Buy Kenya Build Kenya",
        barWidth: "40%",
        barColor: "bg-amber-500",
    },
];

export function Compliance(): JSX.Element {
    return (
        <section
            id="compliance"
            aria-label="GOK compliance"
            className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 py-24 text-white dark:from-emerald-900 dark:to-emerald-950"
        >
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
                {/* Content */}
                <div>
                    <h2 className="mb-6 text-4xl font-bold tracking-tight">
                        100% PPRA Compliant, Automatically
                    </h2>
                    <p className="mb-8 text-lg text-emerald-100">
                        Procureline automatically validates your procurement plan against
                        Government of Kenya requirements. No more manual calculations or
                        audit failures.
                    </p>

                    <div className="mb-8 flex flex-wrap gap-4">
                        {badges.map((badge) => (
                            <div
                                key={badge.label}
                                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg">
                                    {badge.icon}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold">
                                        {badge.label} {badge.percentage}
                                    </div>
                                    <div className="text-xs text-emerald-200">
                                        {badge.description}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white px-6 py-3 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-50">
                        📄 Download Compliance Guide
                    </button>
                </div>

                {/* Compliance Chart Visual */}
                <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-xl dark:border-transparent dark:bg-card">
                    <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        📊 Compliance Tracker
                    </div>

                    <div className="space-y-5">
                        {badges.map((badge) => (
                            <div key={badge.label} className="flex items-center gap-4">
                                <span className="w-16 text-right text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {badge.label}
                                </span>
                                <div className="flex-1">
                                    <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-muted">
                                        <div
                                            className={`h-full rounded-full ${badge.barColor} transition-all duration-1000`}
                                            style={{ width: badge.barWidth }}
                                        />
                                    </div>
                                </div>
                                <span className="w-12 text-right text-sm font-bold text-gray-900 dark:text-white">
                                    {badge.percentage}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 border-t border-gray-200 pt-4 text-center dark:border-border">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                            ✅ All Requirements Met
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
