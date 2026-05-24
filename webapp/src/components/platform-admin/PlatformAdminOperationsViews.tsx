"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
    ArrowLeft,
    Bell,
    Download,
    Flag,
    Lock,
    RotateCcw,
    Search,
    Server,
    Settings,
    Shield,
    Ticket,
    Upload,
    UserCog,
} from "lucide-react";
import { useMemo, useState } from "react";
import type React from "react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PlatformAdminDashboardSkeleton, PlatformAdminMobileFallback } from "./PlatformAdminDashboardParts";

const opsApi = (api as any).functions.platformAdminOperations;
const SECONDARY_ACTION_BUTTON_CLASS = "border-border bg-background/90 text-foreground shadow-sm hover:bg-muted/60 hover:text-foreground";

function formatDate(value?: number | null): string {
    return value ? new Date(value).toLocaleString("en-KE", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric" }) : "Not set";
}

function PageFrame({ children, description, icon: Icon, title }: { children: React.ReactNode; description: string; icon: typeof UserCog; title: string }): JSX.Element {
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
                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                                </div>
                            </div>
                        </div>
                    </header>
                    {children}
                </div>
            </main>
        </div>
    );
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "good" | "warn" | "bad"; value: number | string }): JSX.Element {
    return (
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            <div className={cn("mt-2 text-2xl font-bold tracking-tight", tone === "good" && "text-emerald-700", tone === "warn" && "text-amber-700", tone === "bad" && "text-rose-700", tone === "neutral" && "text-foreground")}>{value}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
    return (
        <Badge variant="outline" className={cn("rounded-full", /pass|ok|healthy|green|sent|resolved|active/.test(status) && "border-emerald-300 bg-emerald-100 text-emerald-800", /warn|yellow|approaching|scheduled|in_progress|monitoring/.test(status) && "border-amber-300 bg-amber-100 text-amber-800", /fail|red|critical|breached|open|investigating/.test(status) && "border-rose-300 bg-rose-100 text-rose-800")}>
            {status.replace(/_/g, " ")}
        </Badge>
    );
}

function Loading(): JSX.Element {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <PlatformAdminMobileFallback />
            <PlatformAdminDashboardSkeleton />
        </div>
    );
}

export function PlatformAdminUsersView(): JSX.Element {
    const [search, setSearch] = useState("");
    const [reason, setReason] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const rows = useQuery(opsApi.getCrossTenantUsers, { search });
    const manage = useMutation(opsApi.manageCrossTenantUser);
    const lockTenant = useMutation(opsApi.lockTenantUsers);

    async function run(action: () => Promise<unknown>, success: string) {
        try {
            await action();
            setMessage(success);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed.");
        }
    }

    if (!rows) return <Loading />;
    return (
        <PageFrame icon={UserCog} title="Cross-Tenant User Management" description="Search users across tenants, inspect associations, and run audited account operations.">
            <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-11 rounded-xl pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email, name, or tenant" />
                </div>
                <Input className="h-11 rounded-xl" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required action reason" />
            </div>
            {message ? <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">{message}</div> : null}
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/35">
                        <TableRow><TableHead>User</TableHead><TableHead>Tenant associations</TableHead><TableHead>Sessions</TableHead><TableHead>Activity</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row: any) => (
                            <TableRow key={String(row.id)} className="align-top">
                                <TableCell><div className="font-semibold">{row.name}</div><div className="text-sm text-muted-foreground">{row.email}</div></TableCell>
                                <TableCell><div className="flex flex-wrap gap-1.5">{row.associations.map((item: any) => <Badge key={`${item.tenantId}-${item.role}`} variant="outline" className="rounded-full">{item.tenantName} / {item.role}</Badge>)}</div></TableCell>
                                <TableCell>{row.activeSessionCount}</TableCell>
                                <TableCell className="max-w-xs text-xs text-muted-foreground">{row.recentActivity.map((item: any) => `${item.action} ${formatDate(item.timestamp)}`).join(", ") || "No recent activity"}</TableCell>
                                <TableCell className="space-x-2 text-right">
                                    {["password_reset", "unlock", "force_logout", "deactivate", "gdpr_anonymize"].map((action) => (
                                        <Button key={action} size="sm" variant="outline" disabled={!reason} className={cn("rounded-xl", SECONDARY_ACTION_BUTTON_CLASS)} onClick={() => void run(() => manage({ action, reason, userId: row.id }), `${action.replace(/_/g, " ")} completed.`)}>{action.replace(/_/g, " ")}</Button>
                                    ))}
                                    {row.associations[0] ? <Button size="sm" variant="outline" disabled={!reason} onClick={() => void run(() => lockTenant({ reason, tenantId: row.associations[0].tenantId }), "Tenant lockout completed.")}><Lock className="mr-2 h-4 w-4" />Tenant lockout</Button> : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </PageFrame>
    );
}

export function PlatformAdminFreeTierView(): JSX.Element {
    const [notes, setNotes] = useState("");
    const snapshot = useQuery(opsApi.getFreeTierSnapshot, {});
    const updateReview = useMutation(opsApi.updateFreeTierReview);
    const convert = useMutation(opsApi.convertFreeTenantToPaid);
    if (!snapshot) return <Loading />;
    return (
        <PageFrame icon={Flag} title="Free Tier Management" description="Usage limits, upgrade candidates, inactivity, abuse signals, and conversion reporting.">
            <section className="grid gap-4 xl:grid-cols-5">
                <Metric label="Free tenants" value={snapshot.report.total} />
                <Metric label="Upgrade candidates" tone="warn" value={snapshot.report.candidates} />
                <Metric label="Paid conversions" tone="good" value={snapshot.report.paidConversions} />
                <Metric label="Inactive" tone="warn" value={snapshot.report.inactive} />
                <Metric label="Conversion rate" value={`${snapshot.report.conversionRate}%`} />
            </section>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Sales follow-up notes" />
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/35"><TableRow><TableHead>Tenant</TableHead><TableHead>Usage</TableHead><TableHead>Activity</TableHead><TableHead>Review</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>{snapshot.rows.map((row: any) => <TableRow key={String(row.id)}><TableCell><div className="font-semibold">{row.name}</div><div className="text-sm text-muted-foreground">{row.subdomain}</div></TableCell><TableCell><StatusBadge status={row.state} /> <span className="ml-2">{row.utilization}%</span><div className="text-xs text-muted-foreground">{row.departments} departments / {row.categories} categories / {row.itemsPerCategory} items per category</div></TableCell><TableCell>{row.logins} logins<div className="text-xs text-muted-foreground">{formatDate(row.lastActivity)}</div>{row.inactive ? <StatusBadge status="inactive" /> : null}</TableCell><TableCell>{row.review?.salesFollowUp ? "Sales follow-up" : "Not marked"}<div className="text-xs text-muted-foreground">{row.review?.salesNotes ?? "No notes"}</div></TableCell><TableCell className="space-x-2 text-right"><Button size="sm" variant="outline" onClick={() => void updateReview({ tenantId: row.id, salesFollowUp: true, notes })}>Sales follow-up</Button><Button size="sm" onClick={() => void convert({ tenantId: row.id, tier: "starter", notifyTenant: true })}>Convert to paid</Button></TableCell></TableRow>)}</TableBody>
                </Table>
            </div>
        </PageFrame>
    );
}

export function PlatformAdminHealthView(): JSX.Element {
    const snapshot = useQuery(opsApi.getHealthOperationsSnapshot, {});
    const schedule = useMutation(opsApi.scheduleMaintenanceWindow);
    const backup = useMutation(opsApi.createManualBackupJob);
    if (!snapshot) return <Loading />;
    return (
        <PageFrame icon={Server} title="System Health" description="API, database, job, infrastructure, backup, SSL, and maintenance controls.">
            <section className="grid gap-4 xl:grid-cols-5">
                <Metric label="API error rate" tone={snapshot.api.errorRate > 5 ? "bad" : "good"} value={`${snapshot.api.errorRate}%`} />
                <Metric label="Database" value={snapshot.database.state} />
                <Metric label="Jobs" value={snapshot.jobs.length} />
                <Metric label="Backups" value={snapshot.backups.latestStatus} />
                <Metric label="SSL expires" tone="warn" value={`${snapshot.ssl.expiresInDays} days`} />
            </section>
            {snapshot.alerts?.length ? <OperationsTable rows={snapshot.alerts} columns={["kind", "message"]} /> : null}
            {snapshot.activeMaintenance ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Active maintenance: {snapshot.activeMaintenance.title} until {formatDate(snapshot.activeMaintenance.endsAt)}</div> : null}
            <div className="flex gap-2"><Button onClick={() => void backup({})}><Download className="mr-2 h-4 w-4" />Manual backup</Button><Button variant="outline" onClick={() => void schedule({ title: "Scheduled maintenance", message: "Platform maintenance window", startsAt: Date.now() + 60 * 60 * 1000, endsAt: Date.now() + 2 * 60 * 60 * 1000 })}>Schedule maintenance</Button></div>
            <OperationsTable rows={snapshot.jobs} columns={["eventType", "provider", "status", "updatedAt"]} />
        </PageFrame>
    );
}

export function PlatformAdminSecurityView(): JSX.Element {
    const [ips, setIps] = useState("");
    const snapshot = useQuery(opsApi.getSecuritySnapshot, {});
    const update = useMutation(opsApi.updateIpAllowlist);
    if (!snapshot) return <Loading />;
    return (
        <PageFrame icon={Shield} title="Security & Compliance" description="Threats, tenant-isolation verification, audit integrity, access logs, allowlists, and incident-response tools.">
            <section className="grid gap-4 xl:grid-cols-4"><Metric label="Threats" tone={snapshot.threats ? "bad" : "good"} value={snapshot.threats} /><Metric label="Audit records checked" value={snapshot.auditStatus.checked} /><Metric label="Integrity" value={snapshot.auditStatus.integrityState} /><Metric label="Allowlist entries" value={snapshot.allowlist.length ?? 0} /></section>
            <div className="grid gap-3 xl:grid-cols-[1fr_auto]"><Input value={ips} onChange={(event) => setIps(event.target.value)} placeholder="Comma-separated Platform Admin IP allowlist" /><Button onClick={() => void update({ ips: ips.split(",").map((item) => item.trim()).filter(Boolean), reason: "Platform Admin allowlist update" })}>Save allowlist</Button></div>
            <div className="grid gap-4 xl:grid-cols-3"><Metric label="Lockdown" value={snapshot.incidentResponse?.lockdownAvailable ? "available" : "unavailable"} /><Metric label="Notifications" value={snapshot.incidentResponse?.notificationAvailable ? "available" : "unavailable"} /><Metric label="Incident actions" value={snapshot.incidentResponse?.actions?.length ?? 0} /></div>
            <div className="grid gap-6 xl:grid-cols-2"><OperationsTable rows={snapshot.isolation} columns={["tenantName", "state"]} /><OperationsTable rows={snapshot.accessLogs} columns={["action", "event", "outcome", "timestamp"]} /></div>
        </PageFrame>
    );
}

export function PlatformAdminSupportView(): JSX.Element {
    const snapshot = useQuery(opsApi.getSupportSnapshot, {});
    const createTicket = useMutation(opsApi.upsertSupportTicket);
    const createIncident = useMutation(opsApi.createIncident);
    const mergeTickets = useMutation(opsApi.mergeSupportTickets);
    const updateIncident = useMutation(opsApi.updateIncidentStatus);
    const announce = useMutation(opsApi.scheduleAnnouncement);
    if (!snapshot) return <Loading />;
    return (
        <PageFrame icon={Ticket} title="Support Tickets & Incidents" description="Ticket queue, SLA indicators, incidents, status page, announcements, and merge-ready ticket history.">
            <section className="grid gap-4 xl:grid-cols-4"><Metric label="Tickets" value={snapshot.tickets.length} /><Metric label="Open incidents" tone={snapshot.incidents.some((item: any) => item.status !== "resolved") ? "bad" : "good"} value={snapshot.incidents.length} /><Metric label="Announcements" value={snapshot.announcements.length} /><Metric label="Status page" value={snapshot.statusPage} /></section>
            <div className="flex gap-2"><Button onClick={() => void createTicket({ subject: "New support ticket", description: "Created by Platform Admin", priority: "normal" })}>Create ticket</Button><Button variant="outline" onClick={() => void createIncident({ title: "New incident", summary: "Incident summary", severity: "minor", statusPageMessage: "We are investigating an issue." })}>Create incident</Button><Button variant="outline" onClick={() => void announce({ title: "Platform announcement", message: "Scheduled platform update", deliverAt: Date.now() })}><Bell className="mr-2 h-4 w-4" />Announce</Button>{snapshot.tickets.length > 1 ? <Button variant="outline" onClick={() => void mergeTickets({ sourceTicketId: snapshot.tickets[0]._id, targetTicketId: snapshot.tickets[1]._id })}>Merge oldest pair</Button> : null}</div>
            <div className="grid gap-6 xl:grid-cols-2"><OperationsTable rows={snapshot.tickets} columns={["subject", "priority", "status", "slaState"]} action={(row) => <Button size="sm" variant="outline" onClick={() => void createTicket({ ticketId: row._id, subject: row.subject, description: row.description, priority: "high", status: "in_progress", assignedToPlatformUserId: row.assignedToPlatformUserId })}>Escalate</Button>} /><OperationsTable rows={snapshot.incidents} columns={["title", "severity", "status", "updatedAt"]} action={(row) => <Button size="sm" variant="outline" onClick={() => void updateIncident({ incidentId: row._id, status: "resolved", statusPageMessage: "Incident resolved." })}>Resolve</Button>} /></div>
        </PageFrame>
    );
}

export function PlatformAdminConfigurationView(): JSX.Element {
    const [form, setForm] = useState({ key: "new_feature", value: "true", category: "feature_flag", rolloutPercentage: "0", reason: "" });
    const [importJson, setImportJson] = useState("");
    const snapshot = useQuery(opsApi.getConfigurationSnapshot, {});
    const save = useMutation(opsApi.saveConfiguration);
    const rollback = useMutation(opsApi.rollbackConfiguration);
    const importConfig = useMutation(opsApi.importConfiguration);
    const exportJson = useMemo(() => JSON.stringify(snapshot?.exportPayload ?? [], null, 2), [snapshot?.exportPayload]);
    if (!snapshot) return <Loading />;
    return (
        <PageFrame icon={Settings} title="System Configuration" description="Configuration, feature flags, tenant rollouts, pricing records, templates, integrations, history, rollback, export, and import controls.">
            <section className="grid gap-4 xl:grid-cols-4"><Metric label="Config records" value={snapshot.configs.length} /><Metric label="Versions" value={snapshot.versions.length} /><Metric label="Pricing tiers" value={snapshot.tiers.length} /><Metric label="Export size" value={`${exportJson.length} bytes`} /></section>
            <div className="grid gap-3 xl:grid-cols-[1fr_160px_120px_1fr_auto]"><Input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="Key" /><Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["system", "feature_flag", "pricing", "email_template", "integration"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Input value={form.rolloutPercentage} onChange={(event) => setForm({ ...form, rolloutPercentage: event.target.value })} placeholder="Rollout %" /><Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Required reason" /><Button disabled={!form.reason} onClick={() => void save({ key: form.key, category: form.category, value: form.value, enabled: form.value === "true", rolloutPercentage: Number(form.rolloutPercentage), reason: form.reason })}>Save</Button></div>
            <Textarea value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="Value or email template body" />
            <div className="grid gap-6 xl:grid-cols-2"><OperationsTable rows={snapshot.configs} columns={["key", "category", "enabled", "rolloutPercentage", "version"]} action={(row) => <Button size="sm" variant="outline" onClick={() => void rollback({ configId: row._id, version: Math.max(1, row.version - 1), reason: "Rollback from admin console" })}><RotateCcw className="mr-2 h-4 w-4" />Rollback</Button>} /><div className="space-y-3"><Textarea readOnly value={exportJson} className="min-h-40 font-mono text-xs" /><Textarea value={importJson} onChange={(event) => setImportJson(event.target.value)} placeholder="Paste configuration JSON to import" className="min-h-32 font-mono text-xs" /><Button variant="outline" disabled={!form.reason || !importJson.trim()} onClick={() => void importConfig({ records: JSON.parse(importJson), reason: form.reason })}><Upload className="mr-2 h-4 w-4" />Import configuration</Button></div></div>
            {snapshot.emailPreview?.length ? <OperationsTable rows={snapshot.emailPreview} columns={["key", "preview"]} /> : null}
        </PageFrame>
    );
}

function OperationsTable({ action, columns, rows }: { action?: (row: any) => React.ReactNode; columns: string[]; rows: any[] }): JSX.Element {
    return (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
            <Table>
                <TableHeader className="bg-muted/35"><TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}{action ? <TableHead className="text-right">Action</TableHead> : null}</TableRow></TableHeader>
                <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={columns.length + (action ? 1 : 0)} className="py-8 text-center text-muted-foreground">No records yet.</TableCell></TableRow> : rows.map((row, index) => <TableRow key={String(row._id ?? row.id ?? index)}>{columns.map((column) => <TableCell key={column}>{column.toLowerCase().includes("at") || column === "timestamp" ? formatDate(row[column]) : typeof row[column] === "string" && /state|status|priority|severity/.test(column) ? <StatusBadge status={row[column]} /> : String(row[column] ?? "")}</TableCell>)}{action ? <TableCell className="text-right">{action(row)}</TableCell> : null}</TableRow>)}</TableBody>
            </Table>
        </div>
    );
}
