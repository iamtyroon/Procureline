import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_ACCESS_CTA } from "@/lib/auth/public-entry";

export function Hero(): JSX.Element {
    return (
        <section
            aria-label="Hero section"
            className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white px-6 pb-20 pt-36 dark:from-gray-900 dark:to-background"
        >
            {/* Background pattern */}
            <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2318b969' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            />

            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
                {/* Hero Content */}
                <div className="relative z-10">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                        <span>🏛️</span>
                        For University Administrators
                    </div>

                    <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
                        Procurement Planning,
                        <br />
                        <span className="text-primary">Simplified.</span>
                    </h1>

                    <p className="mb-8 max-w-xl text-lg text-muted-foreground md:text-xl">
                        Transform annual procurement planning with visual block-based tools.
                        Create GOK-compliant plans in hours, not weeks. Export ready-to-submit
                        Excel files instantly.
                    </p>

                    <div className="mb-12 flex flex-wrap items-center gap-4">
                        <Button
                            asChild
                            size="lg"
                            className="rounded-lg bg-primary px-8 py-6 text-base font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                        >
                            <Link href={MARKETING_ACCESS_CTA.href}>
                                {MARKETING_ACCESS_CTA.label}
                            </Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="rounded-lg px-8 py-6 text-base font-semibold"
                        >
                            <a href="#pricing">View Pricing</a>
                        </Button>
                    </div>

                    <p className="mb-12 max-w-xl text-sm text-muted-foreground">
                        Institutions can still self-serve on Free, Starter, and
                        Professional. Procurement Officers and Department Users
                        should start from the shared role-aware access path.
                    </p>

                    {/* Stats */}
                    <div className="flex gap-12">
                        <div>
                            <div className="text-3xl font-bold text-foreground">40+</div>
                            <div className="text-sm text-muted-foreground">Hours saved per cycle</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-foreground">100%</div>
                            <div className="text-sm text-muted-foreground">PPRA Compliant</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-foreground">50+</div>
                            <div className="text-sm text-muted-foreground">Institutions ready</div>
                        </div>
                    </div>
                </div>

                {/* Hero Visual - Dashboard Mockup */}
                <div className="relative">
                    <div className="rounded-3xl bg-gray-900 p-3 shadow-2xl">
                        <div className="mb-3 flex gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        </div>
                        <div className="rounded-xl bg-white p-6">
                            <div className="grid grid-cols-3 gap-4">
                                {/* Dashboard Cards */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm text-primary">
                                        🏢
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900">7</div>
                                    <div className="text-xs text-gray-500">Departments</div>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm text-blue-500">
                                        📄
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900">847</div>
                                    <div className="text-xs text-gray-500">Items Planned</div>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-sm text-amber-500">
                                        💰
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900">85.2M</div>
                                    <div className="text-xs text-gray-500">Budget (KES)</div>
                                </div>
                                {/* Block mockups */}
                                <div className="col-span-3 mt-2 flex flex-wrap gap-2">
                                    <span className="rounded-md bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800">
                                        📁 ICT Equipment
                                    </span>
                                    <span className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                        📦 Laptops (50 units)
                                    </span>
                                    <span className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                        🏷️ KES 3.5M
                                    </span>
                                    <span className="rounded-md bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800">
                                        📁 Office Supplies
                                    </span>
                                    <span className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                        📦 Furniture
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Badges */}
                    <div className="absolute right-[-10px] top-[20%] z-10 flex animate-float items-center gap-3 rounded-xl bg-white p-3 shadow-lg">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-primary">
                            ✅
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-700">
                                GOK Compliant
                            </div>
                            <div className="text-[11px] text-gray-500">AGPO, PWD, Local</div>
                        </div>
                    </div>
                    <div className="absolute bottom-[20%] left-[-10px] z-10 flex animate-float items-center gap-3 rounded-xl bg-white p-3 shadow-lg [animation-delay:1.5s]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                            📊
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-700">
                                Excel Export
                            </div>
                            <div className="text-[11px] text-gray-500">
                                GOK Template Ready
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
