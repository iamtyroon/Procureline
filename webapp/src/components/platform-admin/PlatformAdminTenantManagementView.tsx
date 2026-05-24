"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Download, Loader2, RotateCcw, Save, ShieldOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlatformAdminTenantManagementView({
    tenantId,
}: {
    tenantId: string;
}): JSX.Element {
    const typedTenantId = tenantId as Id<"tenants">;
    const detail = useQuery(api.functions.platformAdminTenants.getTenantManagementDetail, {
        tenantId: typedTenantId,
    });
    const updateSettings = useMutation(api.functions.platformAdminTenants.updateTenantSettings);
    const updateLifecycle = useMutation(api.functions.platformAdminTenants.updateTenantLifecycle);
    const changeSubdomain = useMutation(api.functions.platformAdminTenants.changeTenantSubdomain);
    const createOverride = useMutation(api.functions.platformAdminTenants.createTenantOverride);
    const requestExport = useMutation(api.functions.platformAdminTenants.requestTenantDataExport);
    const [form, setForm] = useState({
        name: "",
        primaryContactEmail: "",
        primaryContactName: "",
        primaryContactPhone: "",
        fiscalYearStartMonth: "7",
        timeZone: "Africa/Nairobi",
        storageLimitGb: "1",
        userLimit: "25",
    });
    const [subdomain, setSubdomain] = useState("");
    const [reason, setReason] = useState("");
    const [overrideForm, setOverrideForm] = useState({
        key: "",
        value: "",
        reason: "",
        expiresAt: "",
    });
    const [message, setMessage] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    useEffect(() => {
        if (!detail) {
            return;
        }
        setForm({
            name: detail.name,
            primaryContactEmail: detail.primaryContactEmail ?? "",
            primaryContactName: detail.primaryContactName ?? "",
            primaryContactPhone: detail.primaryContactPhone ?? "",
            fiscalYearStartMonth: String(detail.fiscalYearStartMonth ?? 7),
            timeZone: detail.timeZone ?? "Africa/Nairobi",
            storageLimitGb: String(Math.max(1, Math.round(detail.storageLimitBytes / 1073741824))),
            userLimit: String(detail.userLimit),
        });
        setSubdomain(detail.subdomain);
    }, [detail]);

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

    if (detail === undefined) {
        return (
            <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </main>
        );
    }

    if (detail === null) {
        return (
            <main className="min-h-[calc(100vh-4rem)] bg-background px-8 py-8">
                <div className="mx-auto max-w-3xl">Tenant not found.</div>
            </main>
        );
    }

    return (
        <main className="min-h-[calc(100vh-4rem)] bg-background px-8 py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <Link href="/platform-admin/tenants" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    All tenants
                </Link>
                <header className="flex items-start justify-between gap-4 border-b border-border/70 pb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{detail.name}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{detail.subdomain} · {detail.activeUsers} active users · {detail.departmentCount} departments</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">{detail.status}</Badge>
                </header>

                {message ? <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">{message}</div> : null}
                {detail.alerts.length > 0 ? (
                    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                        {detail.alerts.map((alert) => <div key={alert}>{alert}</div>)}
                    </section>
                ) : null}

                <section className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
                        <h2 className="font-semibold">Configuration</h2>
                        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Organization name" />
                        <Input value={form.primaryContactEmail} onChange={(event) => setForm({ ...form, primaryContactEmail: event.target.value })} placeholder="Primary contact email" />
                        <Input value={form.primaryContactName} onChange={(event) => setForm({ ...form, primaryContactName: event.target.value })} placeholder="Primary contact name" />
                        <Input value={form.primaryContactPhone} onChange={(event) => setForm({ ...form, primaryContactPhone: event.target.value })} placeholder="Primary contact phone" />
                        <div className="grid grid-cols-2 gap-3">
                            <Input value={form.fiscalYearStartMonth} onChange={(event) => setForm({ ...form, fiscalYearStartMonth: event.target.value })} placeholder="Fiscal start month" />
                            <Input value={form.timeZone} onChange={(event) => setForm({ ...form, timeZone: event.target.value })} placeholder="Time zone" />
                            <Input value={form.storageLimitGb} onChange={(event) => setForm({ ...form, storageLimitGb: event.target.value })} placeholder="Storage GB" />
                            <Input value={form.userLimit} onChange={(event) => setForm({ ...form, userLimit: event.target.value })} placeholder="User limit" />
                        </div>
                        <Button disabled={isBusy} onClick={() => void run(() => updateSettings({
                            tenantId: typedTenantId,
                            name: form.name,
                            primaryContactEmail: form.primaryContactEmail || undefined,
                            primaryContactName: form.primaryContactName || undefined,
                            primaryContactPhone: form.primaryContactPhone || undefined,
                            fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
                            timeZone: form.timeZone,
                            storageLimitBytes: Number(form.storageLimitGb) * 1073741824,
                            userLimit: Number(form.userLimit),
                        }), "Tenant settings saved.")}>
                            <Save className="mr-2 h-4 w-4" />
                            Save settings
                        </Button>
                    </div>

                    <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
                        <h2 className="font-semibold">Lifecycle</h2>
                        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason" />
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled={isBusy || !reason} onClick={() => void run(() => updateLifecycle({ tenantId: typedTenantId, action: "suspend", reason }), "Tenant suspended. Login attempts will show Account suspended.")}>
                                <ShieldOff className="mr-2 h-4 w-4" />
                                Suspend
                            </Button>
                            <Button variant="outline" disabled={isBusy || !reason} onClick={() => void run(() => updateLifecycle({ tenantId: typedTenantId, action: "restore", reason }), "Tenant restored.")}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                            </Button>
                            <Button variant="outline" disabled={isBusy || !reason} onClick={() => void run(() => updateLifecycle({ tenantId: typedTenantId, action: "delete", reason }), "Tenant soft-deleted with 90-day purge schedule.")}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Soft-delete
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Purge scheduled: {detail.lifecycle.purgeScheduledAt ? new Date(detail.lifecycle.purgeScheduledAt).toLocaleString() : "Not scheduled"}
                        </p>
                    </div>

                    <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
                        <h2 className="font-semibold">Subdomain redirect</h2>
                        <Input value={subdomain} onChange={(event) => setSubdomain(event.target.value.toLowerCase())} />
                        <Button variant="outline" disabled={isBusy || !reason} onClick={() => void run(() => changeSubdomain({ tenantId: typedTenantId, subdomain, reason }), "Subdomain changed with a 30-day redirect.")}>
                            Save subdomain
                        </Button>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            {detail.redirects.map((redirect) => (
                                <div key={`${redirect.fromSubdomain}-${redirect.expiresAt}`}>
                                    {redirect.fromSubdomain} redirects to {redirect.toSubdomain} until {new Date(redirect.expiresAt).toLocaleDateString()}.
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
                        <h2 className="font-semibold">Overrides and export</h2>
                        <Input value={overrideForm.key} onChange={(event) => setOverrideForm({ ...overrideForm, key: event.target.value })} placeholder="Override key" />
                        <Input value={overrideForm.value} onChange={(event) => setOverrideForm({ ...overrideForm, value: event.target.value })} placeholder="Override value" />
                        <Input value={overrideForm.reason} onChange={(event) => setOverrideForm({ ...overrideForm, reason: event.target.value })} placeholder="Override reason" />
                        <Input type="datetime-local" value={overrideForm.expiresAt} onChange={(event) => setOverrideForm({ ...overrideForm, expiresAt: event.target.value })} />
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled={isBusy || !overrideForm.key || !overrideForm.expiresAt} onClick={() => void run(() => createOverride({ tenantId: typedTenantId, key: overrideForm.key, value: overrideForm.value, reason: overrideForm.reason, expiresAt: new Date(overrideForm.expiresAt).getTime() }), "Temporary override saved.")}>
                                Save override
                            </Button>
                            <Button variant="outline" disabled={isBusy} onClick={() => void run(() => requestExport({ tenantId: typedTenantId }), "Tenant data export link generated.")}>
                                <Download className="mr-2 h-4 w-4" />
                                Request export
                            </Button>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            {detail.exports.map((dataExport) => (
                                <div key={String(dataExport.id)}>
                                    {dataExport.status}: {dataExport.downloadUrl ?? dataExport.errorMessage ?? "Pending"}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
