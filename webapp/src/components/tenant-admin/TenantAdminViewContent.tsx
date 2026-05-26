import Link from "next/link";
import {
    ArrowRight,
    Download,
    Search,
    UserCog,
    UserPlus,
    Building2,
    CircleAlert,
    Clock3,
    Landmark,
    LayoutGrid,
    LoaderCircle,
    MapPin,
    ShieldCheck,
    Users2,
    Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type {
    TenantAdminActivityItem,
    TenantAdminDashboardSnapshot,
    TenantAdminDepartmentUserProfile,
    TenantAdminProcurementOfficerProfile,
} from "@/lib/shared/tenant-admin/dashboard-snapshot";
import { formatDashboardTimestamp, formatFiscalYearLabel, type DashboardCycleState } from "@/lib/shared/tenant-admin/dashboard";
import { cn } from "@/lib/utils";
import { InstitutionalOverviewView } from "@/src/components/tenant-admin/InstitutionalOverviewView";
import { TenantAdminReportsView } from "@/src/components/tenant-admin/TenantAdminReportsView";
import {
    TenantAdminBillingOperationsView,
    TenantAdminNotificationsView,
    TenantAdminSecurityView,
    TenantAdminSettingsOperationsView,
} from "@/src/components/tenant-admin/TenantAdminOperationsViews";

export type TenantAdminView =
    | "audit-log"
    | "billing"
    | "dashboard"
    | "department-users"
    | "departments"
    | "po-management"
    | "reports"
    | "notifications"
    | "security"
    | "settings";

export const TENANT_ADMIN_VIEW_META: Record<
    TenantAdminView,
    { subtitle: string; title: string }
> = {
    "audit-log": {
        title: "Audit Log",
        subtitle: "Review tenant activity and export the visible audit history.",
    },
    billing: {
        title: "Billing & Subscription",
        subtitle: "View current plan posture, tenant usage, and billing readiness.",
    },
    dashboard: {
        title: "Dashboard",
        subtitle: "Overview of your institution procurement system",
    },
    "department-users": {
        title: "Departmental Users",
        subtitle: "Review departmental user access across your institution.",
    },
    departments: {
        title: "Departments",
        subtitle: "Monitor department setup, submission state, and readiness.",
    },
    "po-management": {
        title: "Procurement Officer",
        subtitle: "Manage Procurement Officer coverage for your institution.",
    },
    reports: {
        title: "Reports",
        subtitle: "Prepare report exports and reporting workflows for tenant leadership.",
    },
    notifications: {
        title: "Notifications",
        subtitle: "Manage actionable messages, preferences, and PO broadcasts.",
    },
    security: {
        title: "Security & Sessions",
        subtitle: "Review access history, authenticator protection, and active sessions.",
    },
    settings: {
        title: "Settings",
        subtitle: "Review institution profile details and tenant-admin account settings.",
    },
};

export interface RenderTenantAdminViewArgs {
    liveCountdownLabel: string;
    onDirectoryQueryChange: (value: string) => void;
    onFiscalYearChange: (value: string) => void;
    procurementOfficerCount: number;
    resolvedSnapshotState: {
        state: "cached" | "live" | "loading";
    };
    snapshot: TenantAdminDashboardSnapshot;
    view: TenantAdminView;
    visibleAuditItems: TenantAdminActivityItem[];
    visibleDepartmentUsers: TenantAdminDepartmentUserProfile[];
    visibleProcurementOfficers: TenantAdminProcurementOfficerProfile[];
}

export function renderTenantAdminView(args: RenderTenantAdminViewArgs): JSX.Element {
    switch (args.view) {
        case "po-management":
            return renderProcurementOfficerView(args);
        case "department-users":
            return renderDepartmentUsersView(args);
        case "departments":
            return renderDepartmentsView(args.snapshot);
        case "billing":
            return <TenantAdminBillingOperationsView />;
        case "settings":
            return <TenantAdminSettingsOperationsView snapshot={args.snapshot} />;
        case "notifications":
            return <TenantAdminNotificationsView />;
        case "security":
            return <TenantAdminSecurityView />;
        case "audit-log":
            return renderAuditLogView(args);
        case "reports":
            return renderReportsView(args.snapshot);
        default:
            return renderDashboardView(args);
    }
}

function renderDashboardView({
    liveCountdownLabel,
    onFiscalYearChange,
    procurementOfficerCount,
    resolvedSnapshotState,
    snapshot,
}: RenderTenantAdminViewArgs): JSX.Element {
    return (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
            <div className="space-y-5">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-6 p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 text-lg font-extrabold text-primary-foreground">
                            {getInstitutionInitials(snapshot.meta.tenantName)}
                        </div>
                        <div className="space-y-2">
                            <div className="text-xl font-bold text-foreground">
                                {snapshot.meta.tenantName}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                Tenant-scoped workspace
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                            <Landmark className="h-3.5 w-3.5" />
                            Viewing {formatFiscalYearLabel(snapshot.meta.selectedFiscalYear)}
                        </div>
                        <StatusBadge tone="success" value={humanizeTenantStatus(snapshot.meta.tenantStatus)} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                        <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
                            <div className="text-sm leading-7 text-muted-foreground">
                                Keep a quick view of tenant setup, user coverage, and department
                                submission posture in the same arrangement as the admin HTML
                                prototype.
                            </div>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-background p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Dashboard period
                            </p>
                            <Select value={snapshot.meta.selectedFiscalYear} onValueChange={onFiscalYearChange}>
                                <SelectTrigger className="mt-3 h-10 rounded-lg border-border bg-background">
                                    <SelectValue placeholder="Select fiscal year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {snapshot.meta.availableFiscalYears.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            {formatFiscalYearLabel(year)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {snapshot.meta.isSelectedCurrentFiscalYear ? (
                                <p className="mt-3 text-xs text-muted-foreground">
                                    Current active cycle: {formatFiscalYearLabel(snapshot.meta.currentFiscalYear)}
                                    {" "} (1 July - 30 June).
                                </p>
                            ) : (
                                <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
                                    Viewing {formatFiscalYearLabel(snapshot.meta.selectedFiscalYear)} data only.
                                    Current active cycle is {formatFiscalYearLabel(snapshot.meta.currentFiscalYear)}
                                    {" "} until 30 June {snapshot.meta.currentFiscalYear.split("-")[1]}.
                                </div>
                            )}
                            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                                    Tier: {snapshot.meta.tenantTier}
                                </div>
                                <div className="flex items-center gap-2">
                                    {resolvedSnapshotState.state === "live" ? (
                                        <LoaderCircle className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                        <CircleAlert className="h-3.5 w-3.5 text-amber-500" />
                                    )}
                                    Last updated: {formatDashboardTimestamp(snapshot.meta.lastUpdatedAt)}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-5 md:grid-cols-2">
                <PrototypeStatCard
                    icon={ShieldCheck}
                    iconTone="primary"
                    label="Submission Progress"
                    meta={snapshot.summaryCards.submissionProgress.helperText}
                    value={snapshot.summaryCards.submissionProgress.value}
                />
                <PrototypeStatCard
                    icon={Wallet}
                    iconTone="accent"
                    label="Budget Utilized"
                    meta={snapshot.summaryCards.budgetUtilization.helperText}
                    value={snapshot.summaryCards.budgetUtilization.value}
                />
            </div>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                    <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                            <Users2 className="h-4 w-4" />
                        </div>
                        Procurement Officer
                    </div>
                    <Link href="/tenant-admin/po-management" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        Manage
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex gap-5 rounded-xl border border-border/70 bg-muted/40 p-5">
                        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground shadow-sm">
                            {procurementOfficerCount > 0 ? snapshot.directory.procurementOfficers[0]?.initials ?? "PO" : "NA"}
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                            <div>
                                <div className="text-lg font-semibold text-foreground">
                                    {procurementOfficerCount > 0 ? snapshot.directory.procurementOfficers[0]?.name ?? `${pluralize(procurementOfficerCount, "Procurement Officer")} assigned` : "No Procurement Officer assigned yet"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {procurementOfficerCount > 0 ? snapshot.directory.procurementOfficers[0]?.email : snapshot.summaryCards.totalPOs.helperText}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <MetaPill icon={Clock3} value={liveCountdownLabel} />
                                <MetaPill icon={ShieldCheck} value={snapshot.summaryCards.totalPOs.trendLabel} />
                                <StatusBadge tone={procurementOfficerCount > 0 ? "success" : "warning"} value={snapshot.summaryCards.totalPOs.statusLabel} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                    <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground shadow-sm">
                            <Building2 className="h-4 w-4" />
                        </div>
                        Department Status
                    </div>
                    <Link href="/tenant-admin/departments" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        View all
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {snapshot.departmentStatus.map((department) => (
                            <DepartmentStatusCard
                                key={department.id}
                                detail={department.detail}
                                name={department.name}
                                progressTone={department.progressTone}
                                progressValue={department.progressValue}
                                statusLabel={department.statusLabel}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>
            </div>

            <aside className="space-y-5">
                <PrototypeStatCard
                    className="xl:min-h-[210px]"
                    compact
                    icon={Users2}
                    iconTone="secondary"
                    label="Total Users"
                    meta={formatUserBreakdownShort(snapshot.userSummary)}
                    value={String(snapshot.userSummary.activeTotal)}
                />
                <PrototypeStatCard
                    className="xl:min-h-[178px]"
                    compact
                    icon={Building2}
                    iconTone="tertiary"
                    label="Active Departments"
                    meta={snapshot.summaryCards.departments.helperText}
                    value={snapshot.summaryCards.departments.value}
                />
                <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                    <CardHeader className="space-y-3 pb-4">
                        <CardTitle className="text-sm font-semibold text-foreground">Procurement Cycle</CardTitle>
                        <CardDescription className="text-sm leading-6 text-muted-foreground">
                            {snapshot.cycleState.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-2xl font-bold tracking-tight text-foreground">
                            {snapshot.cycleState.title}
                        </div>
                        <StatusBadge tone={getCycleTone(snapshot.cycleState.state)} value={humanizeCycleState(snapshot.cycleState.state)} />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Cycle signal</span>
                                <span>{getCycleProgressValue(snapshot.cycleState.state)}%</span>
                            </div>
                            <Progress value={getCycleProgressValue(snapshot.cycleState.state)} className="h-2 bg-muted" />
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{liveCountdownLabel}</p>
                    </CardContent>
                </Card>
            </aside>
        </section>
    );
}

function renderProcurementOfficerView({
    procurementOfficerCount,
    snapshot,
    visibleProcurementOfficers,
}: RenderTenantAdminViewArgs): JSX.Element {
    return (
        <div className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-3">
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                    <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                            <UserCog className="h-4 w-4" />
                        </div>
                        Procurement Officer
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Add PO
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                    {procurementOfficerCount === 0 ? (
                        <EmptyStateCard
                            description="Create a Procurement Officer account to manage your institution's procurement."
                            title="No Procurement Officer"
                        />
                    ) : (
                        <>
                            {visibleProcurementOfficers.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 p-5"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
                                            {member.initials}
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-lg font-semibold text-foreground">
                                                    {member.name}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {member.email}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <MetaPill
                                                    icon={Building2}
                                                    value={`${member.departmentsManaged} department${member.departmentsManaged === 1 ? "" : "s"} managed`}
                                                />
                                                <MetaPill icon={Clock3} value={member.lastSeenLabel} />
                                                <StatusBadge tone="success" value={member.statusLabel} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm">Edit</Button>
                                        <Button variant="outline" size="sm">Replace</Button>
                                        <Button variant="destructive" size="sm">Deactivate</Button>
                                    </div>
                                </div>
                            ))}

                            <div className="grid gap-4 md:grid-cols-3">
                                <PrototypeMetricTile
                                    label="Departments managed"
                                    value={snapshot.summaryCards.departments.value}
                                />
                                <PrototypeMetricTile
                                    label="Directory count"
                                    value={String(snapshot.directory.procurementOfficers.length)}
                                />
                                <PrototypeMetricTile
                                    label="Recent tenant activity"
                                    value={String(snapshot.activityFeed.totalReturned)}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function renderDepartmentUsersView({
    onDirectoryQueryChange,
    snapshot,
    visibleDepartmentUsers,
}: RenderTenantAdminViewArgs): JSX.Element {
    return (
        <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white shadow-sm">
                        <Users2 className="h-4 w-4" />
                    </div>
                    Departmental Users
                </div>
                <div className="relative w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search users..."
                        onChange={(event) => onDirectoryQueryChange(event.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {snapshot.directory.departmentUsers.length === 0 ? (
                    <div className="p-6">
                        <EmptyStateCard
                            description="Departmental user accounts will appear here as procurement access is issued."
                            title="No departmental users yet"
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="border-b border-border/70 bg-muted/30 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Department</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Last Login</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleDepartmentUsers.map((member) => (
                                    <tr key={member.id} className="border-b border-border/60">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                                                    {member.initials}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground">{member.name}</div>
                                                    <div className="text-muted-foreground">{member.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-foreground">{member.departmentName}</td>
                                        <td className="px-6 py-4">
                                            <StatusBadge tone="success" value={member.statusLabel} />
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{member.lastSeenLabel}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" size="sm" disabled>View</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function renderDepartmentsView(snapshot: TenantAdminDashboardSnapshot): JSX.Element {
    return <InstitutionalOverviewView overview={snapshot.institutionalOverview} />;
}

function renderAuditLogView({
    onDirectoryQueryChange,
    visibleAuditItems,
}: RenderTenantAdminViewArgs): JSX.Element {
    return (
        <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                <CardTitle className="text-base text-foreground">Audit Log</CardTitle>
                <div className="flex items-center gap-2">
                    <div className="relative w-[260px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Search activity..." onChange={(event) => onDirectoryQueryChange(event.target.value)} />
                    </div>
                    <Button variant="outline" size="sm" disabled>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
                {visibleAuditItems.length === 0 ? (
                    <EmptyStateCard
                        description="Tenant activity will appear here once users begin working in the tenant scope."
                        title="No audit activity found"
                    />
                ) : (
                    visibleAuditItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="font-medium text-foreground">{item.action}</div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        {item.actor} on {item.entity}
                                    </div>
                                </div>
                                <StatusBadge tone="neutral" value={item.outcome} />
                            </div>
                            <div className="mt-3 text-xs text-muted-foreground">{item.occurredAtLabel}</div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

function renderReportsView(snapshot: TenantAdminDashboardSnapshot): JSX.Element {
    return <TenantAdminReportsView snapshot={snapshot} />;
}

interface PrototypeStatCardProps {
    className?: string;
    compact?: boolean;
    icon: typeof Users2;
    iconTone: "accent" | "primary" | "secondary" | "tertiary";
    label: string;
    meta: string;
    value: string;
}

function PrototypeStatCard({
    className,
    compact = false,
    icon: Icon,
    iconTone,
    label,
    meta,
    value,
}: PrototypeStatCardProps): JSX.Element {
    return (
        <Card className={cn("relative overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm", className)}>
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary to-emerald-400 opacity-0 transition-opacity duration-300 hover:opacity-100" />
            <CardContent className={cn(compact ? "p-5" : "p-6")}>
                <div
                    className={cn(
                        "flex items-center justify-center rounded-[10px] shadow-sm",
                        compact ? "mb-3 h-10 w-10" : "mb-4 h-11 w-11",
                        iconTone === "primary" && "bg-primary text-primary-foreground",
                        iconTone === "secondary" && "bg-secondary text-secondary-foreground",
                        iconTone === "accent" && "bg-accent text-accent-foreground",
                        iconTone === "tertiary" && "bg-muted text-foreground",
                    )}
                >
                    <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                </div>
                <div className={cn("mt-1 font-bold tracking-tight text-foreground", compact ? "text-2xl" : "text-[1.75rem]")}>
                    {value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
            </CardContent>
        </Card>
    );
}

function DepartmentStatusCard({
    detail,
    name,
    progressTone,
    progressValue,
    statusLabel,
}: {
    detail: string;
    name: string;
    progressTone: "neutral" | "positive" | "warning";
    progressValue: number;
    statusLabel: string;
}): JSX.Element {
    return (
        <div className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-background">
            <div className="truncate text-sm font-semibold text-foreground">{name}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>
            <div className="mt-3">
                <Progress
                    value={progressValue}
                    className={cn(
                        "h-1.5 bg-muted",
                        progressTone === "warning" &&
                            "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-amber-400",
                        progressTone === "positive" &&
                            "[&>div]:bg-gradient-to-r [&>div]:from-emerald-600 [&>div]:to-emerald-400",
                    )}
                />
            </div>
            <div className="mt-3">
                <StatusBadge tone={getDepartmentTone(progressTone)} value={statusLabel} />
            </div>
        </div>
    );
}

function MetaPill({
    icon: Icon,
    value,
}: {
    icon: typeof Clock3;
    value: string;
}): JSX.Element {
    return (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{value}</span>
        </div>
    );
}

function StatusBadge({
    tone,
    value,
}: {
    tone: "danger" | "info" | "neutral" | "success" | "warning";
    value: string;
}): JSX.Element {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
                tone === "success" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-800/70",
                tone === "warning" &&
                    "bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-200 dark:ring-1 dark:ring-amber-800/70",
                tone === "danger" &&
                    "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-200 dark:ring-1 dark:ring-red-800/70",
                tone === "info" &&
                    "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-200 dark:ring-1 dark:ring-blue-800/70",
                tone === "neutral" && "bg-muted text-muted-foreground",
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {value}
        </span>
    );
}

function formatUserBreakdownShort(userSummary: TenantAdminDashboardSnapshot["userSummary"]): string {
    const parts = [
        `${userSummary.procurementOfficers} PO`,
        `${userSummary.departmentUsers} Department User${userSummary.departmentUsers === 1 ? "" : "s"}`,
    ];

    if (userSummary.tenantAdmins > 0) {
        parts.push(`${userSummary.tenantAdmins} Tenant Admin${userSummary.tenantAdmins === 1 ? "" : "s"}`);
    }

    return parts.join(" + ");
}

function pluralize(count: number, label: string): string {
    return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function humanizeTenantStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function humanizeCycleState(cycleState: DashboardCycleState): string {
    switch (cycleState) {
        case "before_start":
            return "Before start";
        case "active_submission":
            return "Active submission";
        case "cycle_complete":
            return "Cycle complete";
        default:
            return "Setup required";
    }
}

function getCycleTone(cycleState: DashboardCycleState): "danger" | "info" | "neutral" | "success" | "warning" {
    switch (cycleState) {
        case "before_start":
            return "info";
        case "active_submission":
            return "success";
        case "cycle_complete":
            return "neutral";
        default:
            return "warning";
    }
}

function getDepartmentTone(progressTone: "neutral" | "positive" | "warning"): "neutral" | "success" | "warning" {
    switch (progressTone) {
        case "positive":
            return "success";
        case "warning":
            return "warning";
        default:
            return "neutral";
    }
}

function getCycleProgressValue(cycleState: DashboardCycleState): number {
    switch (cycleState) {
        case "before_start":
            return 30;
        case "active_submission":
            return 68;
        case "cycle_complete":
            return 100;
        default:
            return 12;
    }
}

function getInstitutionInitials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 3)
        .map((part) => part[0] ?? "")
        .join("")
        .toUpperCase();
}

function EmptyStateCard({
    description,
    title,
}: {
    description: string;
    title: string;
}): JSX.Element {
    return (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
    );
}

function PrototypeMetricTile({
    label,
    value,
}: {
    label: string;
    value: string;
}): JSX.Element {
    return (
        <Card className="rounded-2xl border-border/70 bg-muted/20 shadow-none">
            <CardContent className="p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
            </CardContent>
        </Card>
    );
}
