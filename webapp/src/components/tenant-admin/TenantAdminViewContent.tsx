import Link from "next/link";
import {
    ArrowRight,
    CreditCard,
    Download,
    FileSearch,
    Search,
    Settings2,
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
    type LucideIcon,
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
} from "@/lib/tenant-admin/dashboard-snapshot";
import { formatDashboardTimestamp, formatFiscalYearLabel, type DashboardCycleState } from "@/lib/tenant-admin/dashboard";
import { cn } from "@/lib/utils";

export type TenantAdminView =
    | "audit-log"
    | "billing"
    | "dashboard"
    | "department-users"
    | "departments"
    | "po-management"
    | "reports"
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
            return renderBillingView(args.snapshot);
        case "settings":
            return renderSettingsView(args.snapshot);
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
        <section className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
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
                            {formatFiscalYearLabel(snapshot.meta.selectedFiscalYear)}
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
                                Fiscal year
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

            <PrototypeStatCard
                icon={Users2}
                iconTone="secondary"
                label="Total Users"
                meta={formatUserBreakdownShort(snapshot.userSummary)}
                value={String(snapshot.userSummary.activeTotal)}
            />
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
            <PrototypeStatCard
                icon={Building2}
                iconTone="tertiary"
                label="Active Departments"
                meta={snapshot.summaryCards.departments.helperText}
                value={snapshot.summaryCards.departments.value}
            />

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
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

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-3">
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
    return (
        <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="border-b border-border/70 pb-4">
                <CardTitle className="text-base text-foreground">Department Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-border/70 bg-muted/30 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Budget Allocated</th>
                                <th className="px-6 py-4">Budget Used</th>
                                <th className="px-6 py-4">Utilization</th>
                                <th className="px-6 py-4">Plan Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snapshot.departmentStatus.map((department) => (
                                <tr key={department.id} className="border-b border-border/60">
                                    <td className="px-6 py-4 font-medium text-foreground">{department.name}</td>
                                    <td className="px-6 py-4 text-muted-foreground">Awaiting budget source</td>
                                    <td className="px-6 py-4 text-muted-foreground">Awaiting budget source</td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-[11rem] space-y-2">
                                            <div className="text-xs text-muted-foreground">{department.progressValue}%</div>
                                            <Progress value={department.progressValue} className="h-2 bg-muted" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge tone={getDepartmentTone(department.progressTone)} value={department.statusLabel} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function renderBillingView(snapshot: TenantAdminDashboardSnapshot): JSX.Element {
    const tierLimits = getTenantTierLimitPresentation(snapshot.meta.tenantTier);

    return (
        <div className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-5 p-6">
                    <div>
                        <div className="text-lg font-semibold text-foreground">
                            {humanizeTenantTier(snapshot.meta.tenantTier)} plan
                        </div>
                        <div className="mt-2 text-4xl font-bold tracking-tight text-foreground">
                            {tierLimits.priceLabel}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            per year ({formatFiscalYearLabel(snapshot.meta.selectedFiscalYear)})
                        </div>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
                        <BillingDetailRow label="Tenant status" value={humanizeTenantStatus(snapshot.meta.tenantStatus)} />
                        <BillingDetailRow label="Tier" value={humanizeTenantTier(snapshot.meta.tenantTier)} />
                        <BillingDetailRow label="Users in use" value={String(snapshot.userSummary.activeTotal)} />
                        <BillingDetailRow label="Departments in use" value={snapshot.summaryCards.departments.value} />
                    </div>
                    <Button variant="outline" className="w-full gap-2">
                        <CreditCard className="h-4 w-4" />
                        Manage subscription
                    </Button>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
                <CardHeader className="border-b border-border/70 pb-4">
                    <CardTitle className="text-base text-foreground">
                        Usage ({formatFiscalYearLabel(snapshot.meta.selectedFiscalYear)})
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                    <UsageMeter label="Departments" currentValue={Number(snapshot.summaryCards.departments.value) || 0} limitValue={tierLimits.departments} />
                    <UsageMeter label="Users" currentValue={snapshot.userSummary.activeTotal} limitValue={tierLimits.users} />
                    <UsageMeter label="Storage" currentValue={0} limitValue={tierLimits.storageGb} suffix="GB" />
                    <UsageMeter label="Plan Revisions" currentValue={0} limitValue={tierLimits.revisions} />
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-3">
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                    <CardTitle className="text-base text-foreground">Invoice History</CardTitle>
                    <Button variant="ghost" size="sm" disabled>Download all</Button>
                </CardHeader>
                <CardContent className="p-6">
                    <EmptyStateCard
                        description="Billing invoices and payment history will populate here when the tenant billing stories land."
                        title="Invoice history not connected yet"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function renderSettingsView(snapshot: TenantAdminDashboardSnapshot): JSX.Element {
    return (
        <div className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
                <CardHeader className="border-b border-border/70 pb-4">
                    <CardTitle className="text-base text-foreground">Institution Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                    <ReadOnlyField label="Institution Name" value={snapshot.meta.tenantName} />
                    <ReadOnlyField label="Current Fiscal Year" value={formatFiscalYearLabel(snapshot.meta.selectedFiscalYear)} />
                    <ReadOnlyField label="Subscription Tier" value={humanizeTenantTier(snapshot.meta.tenantTier)} />
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
                        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                            <Settings2 className="h-4 w-4 text-primary" />
                            Settings actions are staged
                        </div>
                        This screen now mirrors the prototype layout, but save actions will connect to the full institution settings story next.
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="border-b border-border/70 pb-4">
                    <CardTitle className="text-base text-foreground">Your Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                    <ReadOnlyField label="Full Name" value={snapshot.directory.currentTenantAdmin?.name ?? "Tenant Admin"} />
                    <ReadOnlyField label="Email" value={snapshot.directory.currentTenantAdmin?.email ?? "No email available"} />
                    <Button variant="outline" className="w-full">Change password</Button>
                    <Button className="w-full">Update profile</Button>
                </CardContent>
            </Card>
        </div>
    );
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
    return (
        <div className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-2">
                <CardHeader className="border-b border-border/70 pb-4">
                    <CardTitle className="text-base text-foreground">Report Generation</CardTitle>
                    <CardDescription>
                        This route stays available so the tenant-admin experience remains complete while the report generation story lands.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                    <ReportTypeCard description="Review recent tenant activity and export the visible audit scope." icon={FileSearch} title="Activity report" />
                    <ReportTypeCard description={`Prepare ${humanizeTenantTier(snapshot.meta.tenantTier)}-tier audit exports once report generation is connected.`} icon={ShieldCheck} title="Audit report" />
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Download className="h-5 w-5" />
                    </div>
                    <div className="text-lg font-semibold text-foreground">Exports staged</div>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Reports are surfaced here so the tenant-admin prototype feels complete, but generation and file delivery still depend on Story 3.8.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

interface PrototypeStatCardProps {
    icon: typeof Users2;
    iconTone: "accent" | "primary" | "secondary" | "tertiary";
    label: string;
    meta: string;
    value: string;
}

function PrototypeStatCard({
    icon: Icon,
    iconTone,
    label,
    meta,
    value,
}: PrototypeStatCardProps): JSX.Element {
    return (
        <Card className="relative overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary to-emerald-400 opacity-0 transition-opacity duration-300 hover:opacity-100" />
            <CardContent className="p-6">
                <div
                    className={cn(
                        "mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] shadow-sm",
                        iconTone === "primary" && "bg-primary text-primary-foreground",
                        iconTone === "secondary" && "bg-secondary text-secondary-foreground",
                        iconTone === "accent" && "bg-accent text-accent-foreground",
                        iconTone === "tertiary" && "bg-muted text-foreground",
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                </div>
                <div className="mt-1 text-[1.75rem] font-bold tracking-tight text-foreground">
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

function BillingDetailRow({
    label,
    value,
}: {
    label: string;
    value: string;
}): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
        </div>
    );
}

function UsageMeter({
    currentValue,
    label,
    limitValue,
    suffix = "",
}: {
    currentValue: number;
    label: string;
    limitValue: number | null;
    suffix?: string;
}): JSX.Element {
    const percentage =
        limitValue === null || limitValue <= 0
            ? 10
            : Math.max(0, Math.min(100, Math.round((currentValue / limitValue) * 100)));
    const renderedCurrentValue = suffix ? `${currentValue} ${suffix}` : String(currentValue);
    const renderedLimit =
        limitValue === null ? "Unlimited" : suffix ? `${limitValue} ${suffix}` : String(limitValue);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-muted-foreground">
                    {renderedCurrentValue} of {renderedLimit}
                </span>
            </div>
            <Progress value={percentage} className="h-2 bg-muted" />
        </div>
    );
}

function ReadOnlyField({
    label,
    value,
}: {
    label: string;
    value: string;
}): JSX.Element {
    return (
        <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {value}
            </div>
        </div>
    );
}

function ReportTypeCard({
    description,
    icon: Icon,
    title,
}: {
    description: string;
    icon: LucideIcon;
    title: string;
}): JSX.Element {
    return (
        <Card className="rounded-2xl border-border/70 bg-muted/20 shadow-none">
            <CardContent className="space-y-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="text-lg font-semibold text-foreground">{title}</div>
                <div className="text-sm leading-6 text-muted-foreground">{description}</div>
                <Button variant="outline" className="w-full justify-between">
                    Prepare report
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
}

function getTenantTierLimitPresentation(
    tier: TenantAdminDashboardSnapshot["meta"]["tenantTier"],
): {
    departments: number | null;
    priceLabel: string;
    revisions: number | null;
    storageGb: number | null;
    users: number | null;
} {
    switch (tier) {
        case "free":
            return { departments: 10, priceLabel: "$0", revisions: 2, storageGb: 5, users: 15 };
        case "starter":
            return { departments: 30, priceLabel: "$2,769", revisions: 4, storageGb: 25, users: 50 };
        case "professional":
            return { departments: 100, priceLabel: "$9,230", revisions: 8, storageGb: 100, users: 200 };
        default:
            return { departments: null, priceLabel: "Custom", revisions: null, storageGb: null, users: null };
    }
}

function humanizeTenantTier(tier: TenantAdminDashboardSnapshot["meta"]["tenantTier"]): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
}
