import { Card } from "@/components/ui/card";

interface FeatureItem {
    icon: string;
    title: string;
    description: string;
    gradient: string;
}

const features: FeatureItem[] = [
    {
        icon: "🧊",
        title: "Visual Block Planning",
        description:
            "Drag-and-drop procurement items using our intuitive Blockly-based interface. No spreadsheet expertise required.",
        gradient: "from-emerald-500 to-emerald-600",
    },
    {
        icon: "🛡️",
        title: "Automatic Compliance",
        description:
            "Built-in validation for AGPO (30%), PWD (2%), and Local Content (40%) requirements. Never fail an audit again.",
        gradient: "from-blue-500 to-blue-600",
    },
    {
        icon: "📤",
        title: "Excel Export",
        description:
            "Export your plan to the official GOK Excel template format. Ready for submission to PPRA in one click.",
        gradient: "from-amber-500 to-amber-600",
    },
    {
        icon: "👥",
        title: "Multi-Department",
        description:
            "Manage procurement across all departments. Each DU creates their plan, PO consolidates and validates.",
        gradient: "from-purple-500 to-purple-600",
    },
    {
        icon: "📊",
        title: "Budget Tracking",
        description:
            "Real-time budget monitoring with visual dashboards. Track spending against allocation by department and category.",
        gradient: "from-red-500 to-red-600",
    },
    {
        icon: "🕐",
        title: "Audit Trail",
        description:
            "Complete history of all changes. Know who modified what and when for full accountability and transparency.",
        gradient: "from-teal-500 to-teal-600",
    },
];

export function Features(): JSX.Element {
    return (
        <section
            id="features"
            aria-label="Features"
            className="bg-background px-6 py-24"
        >
            <div className="mx-auto max-w-7xl">
                {/* Section Header */}
                <div className="mx-auto mb-16 max-w-2xl text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                        ⭐ Features
                    </div>
                    <h2 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
                        Everything You Need for Procurement Planning
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Purpose-built tools designed specifically for Kenyan universities and
                        the PPRA procurement cycle.
                    </p>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <Card
                            key={feature.title}
                            className="group border-border/50 bg-muted/30 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-border hover:bg-card hover:shadow-md"
                        >
                            <div
                                className={`mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-2xl text-white shadow-sm`}
                            >
                                {feature.icon}
                            </div>
                            <h3 className="mb-3 text-lg font-semibold text-foreground">
                                {feature.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {feature.description}
                            </p>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
