import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_ACCESS_CTA } from "@/lib/shared/auth/public-entry";

const stats = [
    { label: "Hours saved per planning cycle", value: "40+" },
    { label: "Roles in one shared workflow", value: "4" },
    { label: "Statutory quotas tracked live", value: "3" },
] as const;

export function Hero(): JSX.Element {
    return (
        <section
            aria-label="Hero section"
            className="relative overflow-hidden bg-background px-6 pb-24 pt-36"
        >
            {/* Workspace dot grid, fading toward the bottom */}
            <div
                className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_20%,transparent_85%)]"
                aria-hidden="true"
            />

            <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                    <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                        Visual procurement planning for institutions
                    </p>

                    <h1 className="text-balance font-display text-5xl font-semibold leading-[1.04] tracking-[-0.03em] text-foreground md:text-7xl">
                        Annual plans,
                        <br />
                        built like{" "}
                        <span className="relative whitespace-nowrap text-primary">
                            blocks.
                        </span>
                    </h1>

                    <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">
                        Drag departments, categories, and items into a compliant
                        annual procurement plan — then export a submission-ready
                        Excel file. Hours, not weeks.
                    </p>

                    <div className="mt-9 flex flex-wrap items-center gap-4">
                        <Button
                            asChild
                            size="lg"
                            className="rounded-lg px-8 py-6 text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 active:scale-[0.98]"
                        >
                            <Link href={MARKETING_ACCESS_CTA.href}>
                                {MARKETING_ACCESS_CTA.label}
                            </Link>
                        </Button>
                        <a
                            href="#pricing"
                            className="text-base font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                        >
                            View pricing
                        </a>
                    </div>

                    <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground/80">
                        Institutions self-serve on Free, Starter, and Professional.
                        Procurement Officers and Department Users join through the
                        role-aware access path.
                    </p>

                    <dl className="mt-12 grid max-w-lg grid-cols-3 divide-x divide-border/70">
                        {stats.map((stat, index) => (
                            <div
                                key={stat.label}
                                className={index === 0 ? "pr-6" : "px-6"}
                            >
                                <dd className="font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                                    {stat.value}
                                </dd>
                                <dt className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {stat.label}
                                </dt>
                            </div>
                        ))}
                    </dl>
                </div>

                {/* Product canvas window — always dark, like the real Blockly workspace */}
                <div className="relative">
                    <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#121212] shadow-2xl shadow-emerald-950/20">
                        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                            <span className="ml-3 font-mono text-[11px] tracking-wide text-white/40">
                                annual-procurement-plan · FY 2026/27
                            </span>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/brand/departmental_animation.svg"
                            alt="Animated Procureline workspace: a cursor drags category and item blocks into a department block on a dark planning canvas"
                            className="block aspect-[900/350] w-full"
                        />
                    </div>

                    <div className="absolute -right-3 top-[14%] hidden items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-lg sm:flex animate-float">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 font-mono text-[10px] font-bold text-primary">
                            OK
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-foreground">
                                Compliance validated
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                Statutory quotas tracked as you build
                            </div>
                        </div>
                    </div>
                    <div className="absolute -left-3 bottom-[12%] hidden items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-lg sm:flex animate-float [animation-delay:1.5s]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 font-mono text-[10px] font-bold text-primary">
                            XLS
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-foreground">
                                Excel export
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                Official template, ready to file
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
