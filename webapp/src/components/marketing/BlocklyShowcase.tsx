import Link from "next/link";
import { Button } from "@/components/ui/button";

const blocklyFeatures = [
    "Drag-and-drop categories, items, and specifications",
    "Real-time budget calculations as you build",
    "Pre-built item library with standard specifications",
    "Instant compliance validation as you add items",
];

export function BlocklyShowcase(): JSX.Element {
    const containerWidth = "800px";
    const containerHeight = "auto";

    return (
        <section
            aria-label="Blockly feature showcase"
            className="bg-gradient-to-b from-white to-gray-50 px-6 py-24 dark:from-background dark:to-background"
        >
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
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
                                    OK
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

                <div>
                    <div
                        className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                        style={{ width: containerWidth, height: containerHeight }}
                    >
                        <div className="min-h-[450px] w-fit min-w-full rounded-xl bg-muted/30 p-4 font-mono text-xs sm:p-8 sm:text-sm dark:bg-muted/10">
                            <div className="inline-block min-w-full">
                                <div className="relative mb-8">
                                    <div className="relative z-20 flex cursor-default items-center whitespace-nowrap rounded-l-md rounded-r-lg border-l-4 border-l-indigo-500 bg-indigo-500/10 px-4 py-3 font-bold text-indigo-700 transition-transform hover:translate-x-1 hover:shadow-md dark:text-indigo-400">
                                        <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-indigo-500/20 bg-indigo-500/10" />
                                        <div className="absolute -bottom-1.5 left-4 z-30 h-2 w-8 rounded-b-sm border-x border-b border-border/10 bg-background/50" />
                                        Department: ICT
                                        <span className="mx-2 opacity-30">|</span>
                                        Allocated Budget: KES 15,000,000
                                    </div>

                                    <div className="ml-4 border-l-2 border-dashed border-indigo-500/20 pl-4 pt-6 sm:ml-8">
                                        <div className="relative mb-6">
                                            <div className="relative z-10 flex cursor-default items-center whitespace-nowrap rounded-l-md rounded-r-lg border-l-4 border-l-primary/50 bg-primary/10 px-4 py-3 font-semibold text-primary transition-transform hover:translate-x-1 hover:shadow-md">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-primary/20 bg-primary/10" />
                                                <div className="absolute -bottom-1.5 left-4 z-20 h-2 w-8 rounded-b-sm border-x border-b border-border/10 bg-background/50" />
                                                Category: ICT Equipment
                                            </div>

                                            <div className="ml-6 border-l-2 border-dashed border-primary/20 pl-4 pt-4">
                                                <div className="relative z-10 mb-2 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-emerald-500/20 bg-emerald-500/10" />
                                                    <div className="min-w-max font-medium text-emerald-700 dark:text-emerald-400">
                                                        Item: Laptops (HP ProBook)
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20" />
                                                    <div className="flex items-center gap-3 whitespace-nowrap text-xs text-muted-foreground/80">
                                                        <span>Qty: 50</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 85,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                            Total: 4,250,000
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="relative z-10 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-emerald-500/20 bg-emerald-500/10" />
                                                    <div className="min-w-max font-medium text-emerald-700 dark:text-emerald-400">
                                                        Item: Printers (LaserJet)
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20" />
                                                    <div className="flex items-center gap-3 whitespace-nowrap text-xs text-muted-foreground/80">
                                                        <span>Qty: 15</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 45,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                            Total: 675,000
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative z-10 mt-4 flex cursor-default items-center whitespace-nowrap rounded-l-md rounded-r-lg border-l-4 border-l-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary/80 transition-transform hover:translate-x-1">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-primary/20 bg-primary/10" />
                                                Total ICT Equipment:
                                                <span className="ml-2 font-bold">KES 4,925,000</span>
                                            </div>
                                        </div>

                                        <div className="relative mb-6">
                                            <div className="relative z-10 flex cursor-default items-center whitespace-nowrap rounded-l-md rounded-r-lg border-l-4 border-l-primary/50 bg-primary/10 px-4 py-3 font-semibold text-primary transition-transform hover:translate-x-1 hover:shadow-md">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-primary/20 bg-primary/10" />
                                                <div className="absolute -bottom-1.5 left-4 z-20 h-2 w-8 rounded-b-sm border-x border-b border-border/10 bg-background/50" />
                                                Category: Office Furniture
                                            </div>

                                            <div className="ml-6 border-l-2 border-dashed border-primary/20 pl-4 pt-4">
                                                <div className="relative z-10 mb-2 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-emerald-500/20 bg-emerald-500/10" />
                                                    <div className="min-w-max font-medium text-emerald-700 dark:text-emerald-400">
                                                        Item: Ergonomic Chairs
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20" />
                                                    <div className="flex items-center gap-3 whitespace-nowrap text-xs text-muted-foreground/80">
                                                        <span>Qty: 20</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 25,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                            Total: 500,000
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="relative z-10 flex cursor-default flex-row items-center gap-4 rounded-l-md rounded-r-lg border-l-4 border-l-emerald-500 bg-emerald-500/10 px-4 py-3 transition-transform hover:translate-x-1 hover:shadow-md">
                                                    <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-emerald-500/20 bg-emerald-500/10" />
                                                    <div className="min-w-max font-medium text-emerald-700 dark:text-emerald-400">
                                                        Item: Executive Desks
                                                    </div>
                                                    <div className="h-4 w-px bg-emerald-500/20" />
                                                    <div className="flex items-center gap-3 whitespace-nowrap text-xs text-muted-foreground/80">
                                                        <span>Qty: 10</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Unit: 45,000</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                            Total: 450,000
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative z-10 mt-4 flex cursor-default items-center whitespace-nowrap rounded-l-md rounded-r-lg border-l-4 border-l-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary/80 transition-transform hover:translate-x-1">
                                                <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-primary/20 bg-primary/10" />
                                                Total Office Furniture:
                                                <span className="ml-2 font-bold">KES 950,000</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-20 mt-8 flex cursor-default items-center whitespace-nowrap rounded-l-md rounded-r-lg border-l-4 border-l-indigo-500/50 bg-indigo-500/5 px-4 py-3 font-semibold text-indigo-600 transition-transform hover:translate-x-1 dark:text-indigo-400">
                                        <div className="absolute -top-1.5 left-4 h-2 w-8 rounded-t-sm border-x border-t border-indigo-500/20 bg-indigo-500/10" />
                                        Department Total:
                                        <span className="ml-2 font-bold">KES 5,875,000</span>
                                        <span className="mx-3 opacity-30">|</span>
                                        <span className="text-xs font-normal text-muted-foreground">
                                            Remaining: KES 9,125,000
                                        </span>
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
