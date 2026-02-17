import Link from "next/link";
import { Button } from "@/components/ui/button";

const blocklyFeatures = [
    "Drag-and-drop categories, items, and specifications",
    "Real-time budget calculations as you build",
    "Pre-built item library with standard specifications",
    "Instant compliance validation as you add items",
];

export function BlocklyShowcase(): JSX.Element {
    // Manual adjustment variables for the container border dimensions
    const containerWidth = "800px";
    const containerHeight = "auto";

    return (
        <section
            aria-label="Blockly feature showcase"
            className="bg-gradient-to-b from-white to-gray-50 px-6 py-24 dark:from-background dark:to-background"
        >
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
                {/* Content */}
                <div>
                    <h2 className="mb-6 text-4xl font-bold tracking-tight text-foreground">
                        Build Plans Like Building Blocks
                    </h2>
                    <p className="mb-8 text-lg text-muted-foreground">
                        Our visual Blockly-based editor makes procurement planning intuitive.
                        No complex spreadsheets, no formulas to remember. Just drag, drop,
                        and done.
                    </p>

                    <div className="mb-8 flex flex-col gap-4">
                        {blocklyFeatures.map((feature) => (
                            <div key={feature} className="flex items-start gap-4">
                                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                                    ✓
                                </div>
                                <span className="text-[15px] text-muted-foreground">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <Link href="/signup">
                        <Button
                            size="lg"
                            className="rounded-lg bg-primary px-8 py-6 text-base font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                        >
                            See It In Action
                        </Button>
                    </Link>
                </div>

                {/* Blockly Visual Mockup */}
                <div>
                    <div
                        className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                        style={{ width: containerWidth, height: containerHeight }}
                    >
                        <div className="min-h-[450px] w-fit min-w-full rounded-xl bg-muted/30 p-4 sm:p-8 dark:bg-muted/10 font-mono text-xs sm:text-sm">
                            <div className="inline-block min-w-full">
                                {/* Level 1: Department Block */}
                                <div className="relative mb-8">
                                    <div className="relative z-20 flex cursor-default items-center rounded-l-md rounded-r-lg border-l-4 border-l-indigo-500 bg-indigo-500/10 px-4 py-3 font-bold text-indigo-700 dark:text-indigo-400 transition-transform hover:translate-x-1 hover:shadow-md whitespace-nowrap">
                                        {/* Top Notch */}
                                        <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-indigo-500/10 border-t border-x border-indigo-500/20"></div>
                                        {/* Bottom Socket */}
                                        <div className="absolute -bottom-1.5 left-4 h-2 w-8 rounded-b-sm bg-background/50 border-b border-x border-border/10 z-30"></div>

                                        <span className="mr-2 text-xl">🏢</span> Department: ICT <span className="mx-2 opacity-30">|</span> Allocated Budget: KES 15,000,000
                                    </div>

                                    {/* Department Contents (Nested) */}
                                    <div className="ml-4 sm:ml-8 border-l-2 border-dashed border-indigo-500/20 pl-4 pt-6">

                                        {/* Level 2: Category 1 */}
                                        <div className="relative mb-6">
                                            <div className="relative z-10 flex cursor-default items-center rounded-l-md rounded-r-lg border-l-4 border-l-primary/50 bg-primary/10 px-4 py-3 font-semibold text-primary transition-transform hover:translate-x-1 hover:shadow-md whitespace-nowrap">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-primary/10 border-t border-x border-primary/20"></div>
                                                <div className="absolute -bottom-1.5 left-4 h-2 w-8 rounded-b-sm bg-background/50 border-b border-x border-border/10 z-20"></div>

                                                <span className="mr-2 text-lg">📂</span> Category: ICT Equipment
                                            </div>

                                            {/* Category Contents */}
                                            <div className="ml-6 border-l-2 border-dashed border-primary/20 pl-4 pt-4">

                                                {/* Item 1 (Merged) */}
                                                <div className="relative z-10 mb-2 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-emerald-500/10 border-t border-x border-emerald-500/20"></div>

                                                    <div className="flex items-center font-medium text-emerald-700 dark:text-emerald-400 min-w-max">
                                                        <span className="mr-2 text-lg">💻</span> Item: Laptops (HP ProBook)
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20"></div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground/80 whitespace-nowrap">
                                                        <span>Qty: 50</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 85,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Total: 4,250,000</span>
                                                    </div>
                                                </div>

                                                {/* Item 2 (Merged) */}
                                                <div className="relative z-10 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-emerald-500/10 border-t border-x border-emerald-500/20"></div>

                                                    <div className="flex items-center font-medium text-emerald-700 dark:text-emerald-400 min-w-max">
                                                        <span className="mr-2 text-lg">🖨️</span> Item: Printers (LaserJet)
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20"></div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground/80 whitespace-nowrap">
                                                        <span>Qty: 15</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 45,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Total: 675,000</span>
                                                    </div>
                                                </div>

                                            </div>

                                            {/* Category Closer */}
                                            <div className="relative z-10 mt-4 flex cursor-default items-center rounded-l-md rounded-r-lg border-l-4 border-l-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary/80 transition-transform hover:translate-x-1 whitespace-nowrap">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-primary/10 border-t border-x border-primary/20"></div>
                                                <span className="mr-2">📁</span> Total ICT Equipment: <span className="ml-2 font-bold">KES 4,925,000</span>
                                            </div>
                                        </div>

                                        {/* Level 2: Category 2 */}
                                        <div className="relative mb-6">
                                            <div className="relative z-10 flex cursor-default items-center rounded-l-md rounded-r-lg border-l-4 border-l-primary/50 bg-primary/10 px-4 py-3 font-semibold text-primary transition-transform hover:translate-x-1 hover:shadow-md whitespace-nowrap">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-primary/10 border-t border-x border-primary/20"></div>
                                                <div className="absolute -bottom-1.5 left-4 h-2 w-8 rounded-b-sm bg-background/50 border-b border-x border-border/10 z-20"></div>

                                                <span className="mr-2 text-lg">🪑</span> Category: Office Furniture
                                            </div>

                                            {/* Category Contents */}
                                            <div className="ml-6 border-l-2 border-dashed border-primary/20 pl-4 pt-4">

                                                {/* Item 1 (Merged) */}
                                                <div className="relative z-10 mb-2 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-emerald-500/10 border-t border-x border-emerald-500/20"></div>

                                                    <div className="flex items-center font-medium text-emerald-700 dark:text-emerald-400 min-w-max">
                                                        <span className="mr-2 text-xl">🪑</span> Item: Ergonomic Chairs
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20"></div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground/80 whitespace-nowrap">
                                                        <span>Qty: 20</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 25,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Total: 500,000</span>
                                                    </div>
                                                </div>

                                                {/* Item 2 (Merged) */}
                                                <div className="relative z-10 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-emerald-500/10 border-t border-x border-emerald-500/20"></div>

                                                    <div className="flex items-center font-medium text-emerald-700 dark:text-emerald-400 min-w-max">
                                                        <span className="mr-2 text-xl">🖥️</span> Item: Executive Desks
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20"></div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground/80 whitespace-nowrap">
                                                        <span>Qty: 10</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 45,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Total: 450,000</span>
                                                    </div>
                                                </div>

                                            </div>

                                            {/* Category Closer */}
                                            <div className="relative z-10 mt-4 flex cursor-default items-center rounded-l-md rounded-r-lg border-l-4 border-l-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary/80 transition-transform hover:translate-x-1 whitespace-nowrap">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-primary/10 border-t border-x border-primary/20"></div>
                                                <span className="mr-2">📁</span> Total Office Furniture: <span className="ml-2 font-bold">KES 950,000</span>
                                            </div>
                                        </div>

                                    </div>

                                    {/* Department Closer */}
                                    <div className="relative z-20 mt-8 flex cursor-default items-center rounded-l-md rounded-r-lg border-l-4 border-l-indigo-500/50 bg-indigo-500/5 px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400 transition-transform hover:translate-x-1 whitespace-nowrap">
                                        <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm bg-indigo-500/10 border-t border-x border-indigo-500/20"></div>
                                        <span className="mr-2 text-lg">🏢</span> Department Total: <span className="ml-2 font-bold">KES 5,875,000</span>
                                        <span className="mx-3 opacity-30">|</span>
                                        <span className="text-muted-foreground text-xs font-normal">Remaining: KES 9,125,000</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
