const institutions = [
    { icon: "🏛️", name: "University of Nairobi" },
    { icon: "🎓", name: "Kenyatta University" },
    { icon: "🏫", name: "JKUAT" },
    { icon: "🏢", name: "Moi University" },
    { icon: "🏛️", name: "Pwani University" },
];

export function TrustedBy(): JSX.Element {
    return (
        <section
            aria-label="Trusted by leading institutions"
            className="border-y border-gray-100 bg-gray-50 px-6 py-10 dark:border-border dark:bg-muted"
        >
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Trusted by Leading Kenyan Institutions
                </div>
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                    {institutions.map((inst) => (
                        <div
                            key={inst.name}
                            className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <span className="text-lg">{inst.icon}</span>
                            {inst.name}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
