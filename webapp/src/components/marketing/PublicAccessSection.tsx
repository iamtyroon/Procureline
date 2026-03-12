import Link from "next/link";
import {
    ArrowRight,
    Building2,
    KeyRound,
    LogIn,
    ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    AUTH_ENTRY_SECTION_ID,
    ROLE_GUIDANCE_DETAILS,
    buildPublicEntrySelectionHref,
    resolvePublicEntryState,
    type PublicEntrySearchParams,
} from "@/lib/auth/public-entry";
import { cn } from "@/lib/utils";

interface PublicAccessSectionProps {
    searchParams: PublicEntrySearchParams;
    selectionPathname?: string;
}

const accessPaths = [
    {
        key: "institution",
        badge: "Self-serve",
        title: "Institution / Tenant Admin",
        description:
            "Create the institution workspace if you are onboarding Procureline for your university.",
        detail: "Use this for Free, Starter, and Professional self-serve onboarding.",
        ctaLabel: "Create institution account",
        gradient: "from-emerald-500 to-emerald-600",
        icon: Building2,
    },
    {
        key: "procurement_officer",
        badge: "Provisioned",
        title: "Procurement Officer",
        description:
            "Continue with the invite link or activation details issued by your Tenant Admin.",
        detail:
            "Use this to review the prerequisites before the Procurement Officer activation flow is surfaced here.",
        ctaLabel: "I am a Procurement Officer",
        gradient: "from-blue-500 to-blue-600",
        icon: ShieldCheck,
    },
    {
        key: "department_user",
        badge: "Provisioned",
        title: "Department User",
        description:
            "Continue with the department-scoped access code issued by your Procurement Officer.",
        detail:
            "Use this to review Department User requirements without opening a fake sign-in path.",
        ctaLabel: "I am a Department User",
        gradient: "from-teal-500 to-teal-600",
        icon: KeyRound,
    },
] as const;

export function PublicAccessSection({
    searchParams,
    selectionPathname,
}: PublicAccessSectionProps): JSX.Element {
    const resolvedState = resolvePublicEntryState(searchParams);
    const activeGuidance = resolvedState.activeRole
        ? ROLE_GUIDANCE_DETAILS[resolvedState.activeRole]
        : null;

    return (
        <section
            id={AUTH_ENTRY_SECTION_ID}
            aria-labelledby="access-paths-heading"
            className="bg-background px-6 py-24"
        >
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                        Access guidance
                    </div>
                    <h2
                        id="access-paths-heading"
                        className="mb-4 text-4xl font-bold tracking-tight text-foreground"
                    >
                        Who are you?
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Choose the path that matches how your institution gave you access. Public
                        self-serve is only for new institution workspaces. Procurement Officers and
                        Department Users continue through provisioned role-specific routes.
                    </p>
                </div>

                {(resolvedState.shouldWarnOnInvalidRole ||
                    resolvedState.shouldWarnOnInvalidTier) && (
                    <div className="mx-auto mb-8 max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        Some unsupported link details were ignored so you can continue on a safe
                        public path.
                    </div>
                )}

                <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
                    {accessPaths.map((path) => {
                        const Icon = path.icon;
                        const href =
                            path.key === "institution"
                                ? resolvedState.institutionHref
                                : path.key === "procurement_officer"
                                  ? buildPublicEntrySelectionHref(
                                        "procurement_officer",
                                        searchParams,
                                        "#role-guidance",
                                        selectionPathname,
                                    )
                                  : buildPublicEntrySelectionHref(
                                        "department_user",
                                        searchParams,
                                        "#role-guidance",
                                        selectionPathname,
                                    );
                        const isActive =
                            path.key !== "institution" &&
                            resolvedState.activeRole === path.key;

                        return (
                            <Card
                                key={path.key}
                                className={cn(
                                    "group flex h-full flex-col border-border/50 bg-muted/30 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-border hover:bg-card hover:shadow-md",
                                    isActive &&
                                        "border-primary/40 bg-card shadow-md shadow-primary/10",
                                )}
                            >
                                <CardHeader className="p-0">
                                    <div className="mb-5 flex items-center justify-between gap-4">
                                        <div
                                            className={cn(
                                                "flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                                                path.gradient,
                                            )}
                                        >
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "rounded-full",
                                                path.badge === "Self-serve"
                                                    ? "border-primary/30 text-primary"
                                                    : "border-border text-muted-foreground",
                                            )}
                                        >
                                            {path.badge}
                                        </Badge>
                                    </div>
                                    <CardTitle className="mb-3 text-xl text-foreground">
                                        {path.title}
                                    </CardTitle>
                                    <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                                        {path.description}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="mt-auto p-0 pt-6">
                                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                                        {path.detail}
                                    </p>
                                    <Button
                                        asChild
                                        className="w-full justify-between rounded-lg"
                                        variant={isActive ? "default" : "outline"}
                                    >
                                        <Link
                                            href={href}
                                            aria-current={isActive ? "page" : undefined}
                                        >
                                            {path.ctaLabel}
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card
                    id="role-guidance"
                    aria-live="polite"
                    className="overflow-hidden border-border/50 bg-muted/20"
                >
                    <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div className="border-b border-border/50 bg-card/70 p-8 lg:border-b-0 lg:border-r">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                {activeGuidance ? "Selected path" : "How the paths work"}
                            </div>
                            <h3 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
                                {activeGuidance
                                    ? activeGuidance.headline
                                    : "Choose the path that matches who issued your access."}
                            </h3>
                            <p className="text-base leading-7 text-muted-foreground">
                                {activeGuidance
                                    ? activeGuidance.description
                                    : "Institution setup is the only public self-serve route. Procurement Officers continue from Tenant Admin-issued details, and Department Users continue from Procurement Officer-issued access codes."}
                            </p>
                        </div>

                        <div className="p-8">
                            {activeGuidance ? (
                                <div className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {activeGuidance.prerequisites.map((prerequisite) => (
                                            <div
                                                key={prerequisite}
                                                className="rounded-2xl border border-border/50 bg-card px-4 py-4 text-sm leading-6 text-muted-foreground"
                                            >
                                                {prerequisite}
                                            </div>
                                        ))}
                                    </div>

                                    <div
                                        id="department-access-next-steps"
                                        className="rounded-2xl border border-primary/15 bg-primary/5 p-5"
                                    >
                                        <p className="font-medium text-foreground">
                                            {activeGuidance.continuationLabel}
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                            {activeGuidance.continuationDescription}
                                        </p>
                                    </div>

                                    <Button asChild className="rounded-lg px-6">
                                        <Link
                                            href={
                                                resolvedState.activeRole ===
                                                "procurement_officer"
                                                    ? resolvedState.procurementOfficerAccessHref
                                                    : resolvedState.departmentUserContinueHref
                                            }
                                        >
                                            {activeGuidance.continuationLabel}
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm leading-6 text-muted-foreground">
                                            <p className="font-medium text-foreground">
                                                Institution / Tenant Admin
                                            </p>
                                            <p className="mt-2">
                                                Choose this if you are setting up Procureline for
                                                the institution itself.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm leading-6 text-muted-foreground">
                                            <p className="font-medium text-foreground">
                                                Procurement Officer
                                            </p>
                                            <p className="mt-2">
                                                Choose this if your Tenant Admin sent an invite link
                                                or activation code.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm leading-6 text-muted-foreground">
                                            <p className="font-medium text-foreground">
                                                Department User
                                            </p>
                                            <p className="mt-2">
                                                Choose this if your Procurement Officer issued your
                                                department access code.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-medium text-foreground">
                                                Already have an active account?
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Use the standard sign-in route for existing eligible
                                                accounts.
                                            </p>
                                        </div>
                                        <Button asChild className="rounded-lg px-6">
                                            <Link href={resolvedState.signInHref}>
                                                <LogIn className="mr-2 h-4 w-4" />
                                                Sign in
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </section>
    );
}
