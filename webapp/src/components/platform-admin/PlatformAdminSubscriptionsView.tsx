"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
    ArrowLeft,
    ArrowRight,
    Download,
    FileText,
    Loader2,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PlatformAdminDashboardSkeleton, PlatformAdminMobileFallback } from "./PlatformAdminDashboardParts";

type TierFilter = "all" | "enterprise" | "free" | "professional" | "starter";
type StatusFilter = "all" | "active" | "trialing" | "past_due" | "grace_period" | "suspended" | "cancelled";
type PaymentMethodFilter = "all" | "stripe" | "intasend" | "bank_transfer" | "custom";
type BillingCycle = "monthly" | "annual";
type Provider = "stripe" | "intasend" | "bank_transfer" | "custom";

interface SubscriptionRow {
    id: Id<"tenants">;
    name: string;
    subdomain: string;
    tier: string;
    tenantStatus: string;
    subscriptionStatus: Exclude<StatusFilter, "all">;
    nextBillingDate: number | null;
    gracePeriodEndsAt: number | null;
    amountCents: number;
    currency: string;
    billingCycle: BillingCycle;
    paymentMethod: Exclude<PaymentMethodFilter, "all">;
    customPriceCents: number | null;
    primaryContactEmail: string | null;
}

const SECONDARY_ACTION_BUTTON_CLASS =
    "border-border bg-background/90 text-foreground shadow-sm hover:bg-muted/60 hover:text-foreground";

function formatMoney(cents: number, currency = "KES"): string {
    return new Intl.NumberFormat("en-KE", {
        currency,
        style: "currency",
    }).format(cents / 100);
}

function formatDate(value: number | null): string {
    return value ? new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";
}

function centsFromInput(value: string): number {
    return Math.round(Number(value || "0") * 100);
}

function csvEscape(value: string | number | null): string {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function PlatformAdminSubscriptionsView(): JSX.Element {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [accessError, setAccessError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [tier, setTier] = useState<TierFilter>("all");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);
    const [selectedTenantId, setSelectedTenantId] = useState<Id<"tenants"> | null>(null);
    const [selectedTenantIds, setSelectedTenantIds] = useState<Id<"tenants">[]>([]);
    const [detail, setDetail] = useState<SubscriptionDetail | null | undefined>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [actionForm, setActionForm] = useState({
        amount: "0",
        billingCycle: "annual" as BillingCycle,
        currency: "KES",
        nextBillingDate: "",
        paymentReference: "",
        provider: "bank_transfer" as Provider,
        reason: "",
        batchStatus: "active" as Exclude<StatusFilter, "all">,
        serviceStartAt: "",
        serviceEndAt: "",
    });

    const issueReadAccess = useMutation(api.functions.platformAdminSubscriptions.issuePlatformAdminSubscriptionReadAccess);
    const getSubscriptionDetail = useMutation(api.functions.platformAdminSubscriptions.getSubscriptionDetail);
    const verifyBankTransfer = useMutation(api.functions.platformAdminSubscriptions.verifyBankTransfer);
    const recordProviderPayment = useMutation(api.functions.platformAdminSubscriptions.recordProviderPayment);
    const recordFailedPayment = useMutation(api.functions.platformAdminSubscriptions.recordFailedPayment);
    const updateCustomPricing = useMutation(api.functions.platformAdminSubscriptions.updateCustomPricing);
    const requestRefundApproval = useMutation(api.functions.platformAdminSubscriptions.requestRefundApproval);
    const batchUpdateSubscriptionStatus = useMutation(api.functions.platformAdminSubscriptions.batchUpdateSubscriptionStatus);
    const queueReconciliation = useMutation(api.functions.platformAdminSubscriptions.queueReconciliation);
    const queueInvoiceGeneration = useMutation(api.functions.platformAdminSubscriptions.queueInvoiceGeneration);
    const expireGracePeriods = useMutation(api.functions.platformAdminSubscriptions.expireGracePeriods);

    const snapshot = useQuery(
        api.functions.platformAdminSubscriptions.getPlatformAdminSubscriptionSnapshot,
        accessToken
            ? {
                accessToken,
                dateFrom: dateFrom ? new Date(dateFrom).getTime() : undefined,
                dateTo: dateTo ? new Date(dateTo).getTime() : undefined,
                page,
                paymentMethod,
                search,
                status,
                tier,
            }
            : "skip",
    );
    useEffect(() => {
        let cancelled = false;
        async function loadDetail(): Promise<void> {
            if (!accessToken || !selectedTenantId) {
                setDetail(null);
                return;
            }
            setDetail(undefined);
            try {
                const result = await getSubscriptionDetail({ accessToken, tenantId: selectedTenantId });
                if (!cancelled) {
                    setDetail(result as SubscriptionDetail | null);
                }
            } catch {
                if (!cancelled) {
                    setDetail(null);
                    setMessage("Subscription detail could not be loaded.");
                }
            }
        }
        void loadDetail();
        return () => {
            cancelled = true;
        };
    }, [accessToken, getSubscriptionDetail, selectedTenantId]);

    useEffect(() => {
        let cancelled = false;
        async function loadAccess(): Promise<void> {
            if (accessToken || accessError) {
                return;
            }
            try {
                const token = await issueReadAccess({});
                if (!cancelled) {
                    setAccessToken(token);
                }
            } catch {
                if (!cancelled) {
                    setAccessError("Subscription access could not be verified. Retry to re-establish the audited read session.");
                }
            }
        }
        void loadAccess();
        return () => {
            cancelled = true;
        };
    }, [accessError, accessToken, issueReadAccess]);

    useEffect(() => {
        setPage(1);
    }, [dateFrom, dateTo, paymentMethod, search, status, tier]);

    const rows = useMemo(() => (snapshot?.rows ?? []) as SubscriptionRow[], [snapshot?.rows]);
    const selectedRow = rows.find((row) => row.id === selectedTenantId) ?? null;

    async function run(action: () => Promise<unknown>, success: string): Promise<void> {
        setIsBusy(true);
        setMessage(null);
        try {
            await action();
            setMessage(success);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed.");
        } finally {
            setIsBusy(false);
        }
    }

    function exportCsv(): void {
        if (!snapshot) {
            return;
        }
        const lines = [
            ["Tenant", "Subdomain", "Tier", "Status", "Payment Method", "Amount", "Cycle", "Next Billing Date"].join(","),
            ...(snapshot.exportRows as SubscriptionRow[]).map((row) =>
                [
                    row.name,
                    row.subdomain,
                    row.tier,
                    row.subscriptionStatus,
                    row.paymentMethod,
                    formatMoney(row.amountCents, row.currency),
                    row.billingCycle,
                    formatDate(row.nextBillingDate),
                ].map(csvEscape).join(","),
            ),
            "",
            ["MRR", formatMoney(snapshot.revenue.mrrCents)].map(csvEscape).join(","),
            ["ARR", formatMoney(snapshot.revenue.arrCents)].map(csvEscape).join(","),
            ...Object.entries(snapshot.revenue.byTier).map(([tierName, cents]) =>
                [`MRR ${tierName}`, formatMoney(cents)].map(csvEscape).join(","),
            ),
            snapshot.exportTruncated ? ["Note", "Export truncated to first 1000 filtered tenants"].map(csvEscape).join(",") : "",
        ].join("\n");
        const url = URL.createObjectURL(new Blob([lines], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "platform-subscriptions.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    function toggleSelectedTenant(tenantId: Id<"tenants">, checked: boolean): void {
        setSelectedTenantIds((current) =>
            checked ? Array.from(new Set([...current, tenantId])) : current.filter((id) => id !== tenantId),
        );
    }

    if (accessError) {
        return (
            <main className="min-h-[calc(100vh-4rem)] bg-background px-8 py-8">
                <div className="mx-auto max-w-2xl rounded-lg border border-border/70 bg-card p-5 text-sm">
                    <p>{accessError}</p>
                    <Button className="mt-4" onClick={() => { setAccessError(null); setAccessToken(null); }}>
                        Retry access check
                    </Button>
                </div>
            </main>
        );
    }

    if (!accessToken || !snapshot) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-background">
                <PlatformAdminMobileFallback />
                <PlatformAdminDashboardSkeleton />
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <PlatformAdminMobileFallback />
            <main className="hidden px-8 py-8 lg:block">
                <div className="mx-auto max-w-[1500px] space-y-6">
                    <header className="flex items-start justify-between gap-6 border-b border-border/70 pb-6">
                        <div>
                            <Link href="/platform-admin" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="h-4 w-4" />
                                Platform Dashboard
                            </Link>
                            <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Subscriptions</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Cross-tenant subscription status, revenue, reconciliation, and billing actions.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} onClick={exportCsv}>
                                <Download className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                            <Button variant="outline" className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} disabled={isBusy} onClick={() => void run(() => queueReconciliation({ provider: "intasend" }), "M-Pesa reconciliation queued with 3 retry attempts.")}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                M-Pesa reconcile
                            </Button>
                            <Button variant="outline" className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} disabled={isBusy} onClick={() => void run(() => queueReconciliation({ provider: "stripe" }), "Stripe webhook retry reconciliation queued.")}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Stripe retry
                            </Button>
                            <Button variant="outline" className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} disabled={isBusy} onClick={() => void run(() => expireGracePeriods({}), "Expired grace periods processed.")}>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Expire grace
                            </Button>
                        </div>
                    </header>

                    {message ? <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">{message}</div> : null}

                    <section className="grid gap-4 xl:grid-cols-5">
                        <Metric label="Tenants" value={snapshot.summary.total} />
                        <Metric label="Active subscriptions" value={snapshot.summary.active} />
                        <Metric label="Grace period" value={snapshot.summary.gracePeriod} />
                        <Metric label="MRR" value={formatMoney(snapshot.revenue.mrrCents)} />
                        <Metric label="ARR" value={formatMoney(snapshot.revenue.arrCents)} />
                    </section>

                    <section className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(150px,0.8fr))]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl pl-9" placeholder="Search tenant, subdomain, or email" />
                        </div>
                        <FilterSelect value={tier} onValueChange={(value) => setTier(value as TierFilter)} options={["all", "free", "starter", "professional", "enterprise"]} />
                        <FilterSelect value={status} onValueChange={(value) => setStatus(value as StatusFilter)} options={["all", "active", "trialing", "past_due", "grace_period", "suspended", "cancelled"]} />
                        <FilterSelect value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethodFilter)} options={["all", "stripe", "intasend", "bank_transfer", "custom"]} />
                        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 rounded-xl" />
                        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 rounded-xl" />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.8fr)]">
                        <div className="space-y-4">
                            <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                                <Table>
                                    <TableHeader className="bg-muted/35">
                                        <TableRow>
                                            <TableHead className="w-10" />
                                            <TableHead>Tenant</TableHead>
                                            <TableHead>Tier</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Payment</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Next billing</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((row) => (
                                            <TableRow key={row.id} className={cn(selectedTenantId === row.id && "bg-muted/40")}>
                                                <TableCell>
                                                    <Checkbox checked={selectedTenantIds.includes(row.id)} onCheckedChange={(checked) => toggleSelectedTenant(row.id, checked === true)} />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-semibold text-foreground">{row.name}</div>
                                                    <div className="text-xs text-muted-foreground">{row.subdomain} / {row.primaryContactEmail ?? "No contact email"}</div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline" className="rounded-full">{row.tier}</Badge></TableCell>
                                                <TableCell><SubscriptionStatusBadge status={row.subscriptionStatus} /></TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{row.paymentMethod}</TableCell>
                                                <TableCell>{formatMoney(row.amountCents, row.currency)} <span className="text-xs text-muted-foreground">/{row.billingCycle}</span></TableCell>
                                                <TableCell>{formatDate(row.nextBillingDate)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} onClick={() => setSelectedTenantId(row.id)}>
                                                        Manage
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>Showing {rows.length} of {snapshot.summary.filtered} filtered tenants.</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} disabled={!snapshot.pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Previous
                                    </Button>
                                    <span>Page {snapshot.pagination.page} of {snapshot.pagination.totalPages}</span>
                                    <Button variant="outline" className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} disabled={!snapshot.pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}>
                                        Next
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-card p-4">
                                <h2 className="font-semibold">Batch status update</h2>
                                <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                                    <FilterSelect value={actionForm.batchStatus} onValueChange={(value) => setActionForm({ ...actionForm, batchStatus: value as Exclude<StatusFilter, "all"> })} options={["active", "trialing", "past_due", "grace_period", "suspended", "cancelled"]} />
                                    <Input value={actionForm.reason} onChange={(event) => setActionForm({ ...actionForm, reason: event.target.value })} placeholder="Required reason" />
                                    <Button disabled={isBusy || selectedTenantIds.length === 0 || !actionForm.reason} onClick={() => void run(() => batchUpdateSubscriptionStatus({ tenantIds: selectedTenantIds, status: actionForm.batchStatus, reason: actionForm.reason }), "Batch subscription statuses updated.")}>
                                        Update {selectedTenantIds.length}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <SubscriptionActionPanel
                            actionForm={actionForm}
                            detail={detail}
                            isBusy={isBusy}
                            row={selectedRow}
                            setActionForm={setActionForm}
                            run={run}
                            actions={{
                                queueInvoiceGeneration,
                                recordFailedPayment,
                                recordProviderPayment,
                                requestRefundApproval,
                                updateCustomPricing,
                                verifyBankTransfer,
                            }}
                        />
                    </section>
                </div>
            </main>
        </div>
    );
}

interface SubscriptionDetail extends SubscriptionRow {
    records: { _id: Id<"billingRecords">; amountCents: number; paymentReference: string; provider: Provider; status: string; updatedAt: number }[];
    reconciliations: { _id: Id<"billingReconciliationRecords">; action: string; attempts: number; maxAttempts: number; status: string; updatedAt: number }[];
    refunds: { _id: Id<"billingRefundApprovals">; proratedAmountCents: number; reason: string; status: string; updatedAt: number }[];
}

function FilterSelect({ onValueChange, options, value }: { onValueChange: (value: string) => void; options: readonly string[]; value: string; }): JSX.Element {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option} value={option}>
                        {option.replace(/_/g, " ")}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function Metric({ label, value }: { label: string; value: number | string }): JSX.Element {
    return (
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
        </div>
    );
}

function SubscriptionStatusBadge({ status }: { status: Exclude<StatusFilter, "all"> }): JSX.Element {
    return (
        <Badge
            variant="outline"
            className={cn(
                "rounded-full",
                status === "active" && "border-emerald-300 bg-emerald-100 text-emerald-800",
                status === "grace_period" && "border-amber-300 bg-amber-100 text-amber-800",
                (status === "past_due" || status === "suspended" || status === "cancelled") && "border-rose-300 bg-rose-100 text-rose-800",
                status === "trialing" && "border-sky-300 bg-sky-100 text-sky-800",
            )}
        >
            {status.replace(/_/g, " ")}
        </Badge>
    );
}

function SubscriptionActionPanel({
    actionForm,
    actions,
    detail,
    isBusy,
    row,
    run,
    setActionForm,
}: {
    actionForm: {
        amount: string;
        batchStatus: Exclude<StatusFilter, "all">;
        billingCycle: BillingCycle;
        currency: string;
        nextBillingDate: string;
        paymentReference: string;
        provider: Provider;
        reason: string;
        serviceEndAt: string;
        serviceStartAt: string;
    };
    actions: {
        queueInvoiceGeneration: (args: { tenantId: Id<"tenants"> }) => Promise<unknown>;
        recordFailedPayment: (args: { amountCents: number; paymentReference: string; provider: Provider; reason: string; tenantId: Id<"tenants"> }) => Promise<unknown>;
        recordProviderPayment: (args: { amountCents: number; billingCycle: BillingCycle; currency: string; nextBillingDate: number; paymentReference: string; provider: "stripe" | "intasend"; tenantId: Id<"tenants"> }) => Promise<unknown>;
        requestRefundApproval: (args: { amountCents: number; reason: string; serviceEndAt: number; serviceStartAt: number; tenantId: Id<"tenants"> }) => Promise<unknown>;
        updateCustomPricing: (args: { amountCents: number; reason: string; tenantId: Id<"tenants"> }) => Promise<unknown>;
        verifyBankTransfer: (args: { amountCents: number; billingCycle: BillingCycle; currency: string; nextBillingDate: number; paymentReference: string; reason: string; tenantId: Id<"tenants"> }) => Promise<unknown>;
    };
    detail: SubscriptionDetail | null | undefined;
    isBusy: boolean;
    row: SubscriptionRow | null;
    run: (action: () => Promise<unknown>, success: string) => Promise<void>;
    setActionForm: (value: typeof actionForm) => void;
}): JSX.Element {
    if (!row) {
        return (
            <aside className="rounded-lg border border-border/70 bg-card p-5 text-sm text-muted-foreground">
                Select a tenant to manage billing actions.
            </aside>
        );
    }

    const nextBillingDate = actionForm.nextBillingDate ? new Date(actionForm.nextBillingDate).getTime() : Date.now() + 365 * 24 * 60 * 60 * 1000;

    return (
        <aside className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
            <div>
                <h2 className="text-lg font-semibold">{row.name}</h2>
                <p className="text-sm text-muted-foreground">{row.tier} / {row.paymentMethod} / {formatMoney(row.amountCents, row.currency)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Input value={actionForm.amount} onChange={(event) => setActionForm({ ...actionForm, amount: event.target.value })} placeholder="Amount" />
                <Input value={actionForm.currency} onChange={(event) => setActionForm({ ...actionForm, currency: event.target.value.toUpperCase() })} placeholder="Currency" />
                <FilterSelect value={actionForm.billingCycle} onValueChange={(value) => setActionForm({ ...actionForm, billingCycle: value as BillingCycle })} options={["monthly", "annual"]} />
                <FilterSelect value={actionForm.provider} onValueChange={(value) => setActionForm({ ...actionForm, provider: value as Provider })} options={["bank_transfer", "stripe", "intasend", "custom"]} />
                <Input className="col-span-2" type="date" value={actionForm.nextBillingDate} onChange={(event) => setActionForm({ ...actionForm, nextBillingDate: event.target.value })} />
                <Input className="col-span-2" value={actionForm.paymentReference} onChange={(event) => setActionForm({ ...actionForm, paymentReference: event.target.value })} placeholder="Payment reference" />
                <Textarea className="col-span-2" value={actionForm.reason} onChange={(event) => setActionForm({ ...actionForm, reason: event.target.value })} placeholder="Required reason" />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Button disabled={isBusy || !actionForm.paymentReference || !actionForm.reason} onClick={() => void run(() => actions.verifyBankTransfer({ tenantId: row.id, amountCents: centsFromInput(actionForm.amount), billingCycle: actionForm.billingCycle, currency: actionForm.currency, nextBillingDate, paymentReference: actionForm.paymentReference, reason: actionForm.reason }), "Bank transfer verified and subscription restored.")}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verify bank
                </Button>
                <Button variant="outline" disabled={isBusy || !actionForm.paymentReference || (actionForm.provider !== "stripe" && actionForm.provider !== "intasend")} onClick={() => void run(() => actions.recordProviderPayment({ tenantId: row.id, amountCents: centsFromInput(actionForm.amount), billingCycle: actionForm.billingCycle, currency: actionForm.currency, nextBillingDate, paymentReference: actionForm.paymentReference, provider: actionForm.provider === "stripe" ? "stripe" : "intasend" }), "Provider payment recorded.")}>
                    Record provider
                </Button>
                <Button variant="outline" disabled={isBusy || !actionForm.paymentReference || !actionForm.reason} onClick={() => void run(() => actions.recordFailedPayment({ tenantId: row.id, amountCents: centsFromInput(actionForm.amount), paymentReference: actionForm.paymentReference, provider: actionForm.provider, reason: actionForm.reason }), "Failed payment recorded and tenant moved to grace period.")}>
                    Grace period
                </Button>
                <Button variant="outline" disabled={isBusy || row.tier !== "enterprise" || !actionForm.reason} onClick={() => void run(() => actions.updateCustomPricing({ tenantId: row.id, amountCents: centsFromInput(actionForm.amount), reason: actionForm.reason }), "Enterprise custom price saved.")}>
                    Custom price
                </Button>
                <Button variant="outline" disabled={isBusy} onClick={() => void run(() => actions.queueInvoiceGeneration({ tenantId: row.id }), "Invoice generation queued with retry.")}>
                    <FileText className="mr-2 h-4 w-4" />
                    Invoice
                </Button>
                <Button variant="outline" disabled={isBusy || !actionForm.reason} onClick={() => void run(() => actions.requestRefundApproval({ tenantId: row.id, amountCents: centsFromInput(actionForm.amount || String(row.amountCents / 100)), reason: actionForm.reason, serviceStartAt: actionForm.serviceStartAt ? new Date(actionForm.serviceStartAt).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000, serviceEndAt: actionForm.serviceEndAt ? new Date(actionForm.serviceEndAt).getTime() : nextBillingDate }), "Refund approval requested with prorated calculation.")}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Refund
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={actionForm.serviceStartAt} onChange={(event) => setActionForm({ ...actionForm, serviceStartAt: event.target.value })} />
                <Input type="date" value={actionForm.serviceEndAt} onChange={(event) => setActionForm({ ...actionForm, serviceEndAt: event.target.value })} />
            </div>
            {detail === undefined ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            {detail ? (
                <div className="space-y-4 text-sm">
                    <ActivityList title="Billing records" rows={detail.records.map((record) => `${record.status} ${record.provider} ${record.paymentReference} ${formatMoney(record.amountCents)}`)} />
                    <ActivityList title="Reconciliation" rows={detail.reconciliations.map((record) => `${record.status} ${record.action} ${record.attempts}/${record.maxAttempts}`)} />
                    <ActivityList title="Refund approvals" rows={detail.refunds.map((refund) => `${refund.status} ${formatMoney(refund.proratedAmountCents)} ${refund.reason}`)} />
                </div>
            ) : null}
        </aside>
    );
}

function ActivityList({ rows, title }: { rows: string[]; title: string }): JSX.Element {
    return (
        <div>
            <h3 className="font-semibold">{title}</h3>
            <div className="mt-2 space-y-1 text-muted-foreground">
                {rows.length === 0 ? <div>No records yet.</div> : rows.map((row) => <div key={row}>{row}</div>)}
            </div>
        </div>
    );
}
