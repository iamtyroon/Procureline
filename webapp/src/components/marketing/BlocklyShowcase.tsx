import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const blocklyFeatures = [
    "Drag-and-drop categories, items, and specifications",
    "Real-time budget calculations as you build",
    "Pre-built item library with standard specifications",
    "Instant compliance validation as you add items",
];

interface ItemRow {
    name: string;
    qty: string;
    unit: string;
    total: string;
}

interface CategoryBlock {
    name: string;
    total: string;
    items: ItemRow[];
}

const categories: CategoryBlock[] = [
    {
        name: "ICT Equipment",
        total: "4,925,000",
        items: [
            { name: "Laptops (HP ProBook)", qty: "50", unit: "85,000", total: "4,250,000" },
            { name: "Printers (LaserJet)", qty: "15", unit: "45,000", total: "675,000" },
        ],
    },
    {
        name: "Office Furniture",
        total: "950,000",
        items: [
            { name: "Ergonomic Chairs", qty: "20", unit: "25,000", total: "500,000" },
            { name: "Executive Desks", qty: "10", unit: "45,000", total: "450,000" },
        ],
    },
];

export function BlocklyShowcase(): JSX.Element {
    return (
        <section
            aria-label="Blockly feature showcase"
            className="bg-background px-6 py-28"
        >
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                        The Blockly editor
                    </p>
                    <h2 className="text-balance font-display text-4xl font-semibold tracking-[-0.02em] text-foreground md:text-5xl">
                        Build plans like building blocks.
                    </h2>
                    <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
                        The visual editor makes procurement planning intuitive. No
                        complex spreadsheets, no formulas to remember. Drag, drop,
                        done.
                    </p>

                    <ul className="mt-8 flex flex-col gap-3.5">
                        {blocklyFeatures.map((feature) => (
                            <li key={feature} className="flex items-start gap-3">
                                <Check
                                    className="mt-1 h-[18px] w-[18px] flex-shrink-0 text-primary"
                                    strokeWidth={2.5}
                                />
                                <span className="text-[15px] leading-7 text-muted-foreground">
                                    {feature}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <Button
                        asChild
                        size="lg"
                        className="mt-9 rounded-lg px-8 py-6 text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 active:scale-[0.98]"
                    >
                        <Link href="/signup">See it in action</Link>
                    </Button>
                </div>

                {/* Dark workspace canvas, matching the real editor */}
                <div className="overflow-hidden rounded-2xl border border-border/60 shadow-2xl shadow-emerald-950/20">
                    <div className="flex items-center gap-2 border-b border-white/[0.07] bg-[#121212] px-4 py-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                        <span className="ml-3 font-mono text-[11px] tracking-wide text-white/40">
                            dept-ict.plan · editing
                        </span>
                    </div>
                    <div className="bg-dot-grid-canvas overflow-x-auto p-6 font-mono text-xs sm:p-8">
                        {/* Department block */}
                        <div className="w-fit min-w-full">
                            <div className="w-fit rounded-md rounded-bl-none bg-[#1db363] px-4 py-2.5 font-semibold text-white shadow-md">
                                ⯈ Dept: ICT
                                <span className="mx-2 opacity-40">|</span>
                                Budget: KES 15,000,000
                            </div>

                            <div className="border-l-[6px] border-[#1db363] pl-4 pt-3">
                                {categories.map((category) => (
                                    <div key={category.name} className="mb-4 last:mb-0">
                                        <div className="w-fit rounded-md rounded-bl-none bg-[#4b8bf5] px-4 py-2.5 font-medium text-white shadow-md">
                                            Category: {category.name}
                                        </div>
                                        <div className="border-l-[6px] border-[#4b8bf5] pl-4 pt-2.5">
                                            {category.items.map((item) => (
                                                <div
                                                    key={item.name}
                                                    className="mb-2 flex w-fit items-center gap-3 whitespace-nowrap rounded-md bg-[#f0a020] px-4 py-2.5 text-white shadow-md"
                                                >
                                                    <span className="font-medium">
                                                        ⯈ Item: {item.name}
                                                    </span>
                                                    <span className="rounded-full bg-[#f4d197] px-2 py-0.5 text-[11px] font-semibold text-[#7a5210]">
                                                        Qty {item.qty}
                                                    </span>
                                                    <span className="opacity-80">
                                                        Unit {item.unit}
                                                    </span>
                                                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">
                                                        KES {item.total}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="w-fit rounded-b-md bg-[#4b8bf5]/80 px-4 py-1.5 text-[11px] text-white/90">
                                            Total {category.name}: KES {category.total}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-1 w-fit rounded-md rounded-tl-none bg-[#1db363] px-4 py-2.5 font-semibold text-white shadow-md">
                                Total: KES 5,875,000
                                <span className="mx-2 opacity-40">|</span>
                                <span className="font-normal opacity-80">
                                    Remaining: KES 9,125,000
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
