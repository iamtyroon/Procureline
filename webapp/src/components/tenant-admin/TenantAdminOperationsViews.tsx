"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Building2, CreditCard, LoaderCircle, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getProcurementFiscalYearForDate } from "@/lib/procurement-officer/dashboard";
import type { TenantAdminDashboardSnapshot } from "@/lib/shared/tenant-admin/dashboard-snapshot";
import { formatFiscalYearBySetting, getUsageTone } from "@/lib/shared/tenant-admin/operations";

const operationsApi = (api as any).functions.tenantAdminOperations;
const INSTITUTIONAL_FISCAL_YEAR_START_MONTH = 7;

function getTimeZoneOptions(currentValue: string): string[] {
    return Array.from(new Set([currentValue, "UTC", ...Intl.supportedValuesOf("timeZone")])).filter(Boolean);
}

export function TenantAdminSettingsOperationsView({ snapshot }: { snapshot: TenantAdminDashboardSnapshot }): JSX.Element {
    const settings = useQuery(operationsApi.getInstitutionSettings, {});
    const account = useQuery(operationsApi.getAccountLifecycle, {});
    const updateSettings = useMutation(operationsApi.updateInstitutionSettings);
    const updateProfile = useMutation(operationsApi.updateCurrentProfile);
    const requestEmailChange = useMutation(operationsApi.requestVerifiedEmailChange);
    const confirmEmailChange = useMutation(operationsApi.confirmVerifiedEmailChange);
    const initiateTransfer = useMutation(operationsApi.initiateAdminTransfer);
    const acceptTransfer = useMutation(operationsApi.acceptAdminTransfer);
    const requestDeletion = useMutation(operationsApi.requestAccountDeletion);
    const generateLogoUploadUrl = useMutation(operationsApi.generateInstitutionLogoUploadUrl);
    const saveLogo = useMutation(operationsApi.saveInstitutionLogo);
    const [form, setForm] = useState({
        allowedEmailDomains: "",
        agpo: "30",
        localContent: "40",
        pwd: "2",
        fiscalYearDisplayFormat: "FY2025-26",
        fiscalYearCustomFormat: "",
        confirmActiveCycleChange: false,
        institutionName: snapshot.meta.tenantName,
        primaryContactEmail: snapshot.directory.currentTenantAdmin?.email ?? "",
        primaryContactName: snapshot.directory.currentTenantAdmin?.name ?? "",
        primaryContactPhone: "",
        timeZone: "Africa/Nairobi",
    });
    const [transferTarget, setTransferTarget] = useState("");
    const [acceptanceToken, setAcceptanceToken] = useState("");
    const [emailVerificationToken, setEmailVerificationToken] = useState("");
    const [logoFile, setLogoFile] = useState<File | undefined>();
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | undefined>();
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!settings?.tenant) return;
        setForm((current) => ({
            ...current,
            institutionName: settings.tenant.name,
            primaryContactEmail: settings.tenant.primaryContactEmail ?? current.primaryContactEmail,
            primaryContactName: settings.tenant.primaryContactName ?? current.primaryContactName,
            primaryContactPhone: settings.tenant.primaryContactPhone ?? "",
            timeZone: settings.tenant.timeZone ?? "Africa/Nairobi",
            fiscalYearDisplayFormat: settings.effective?.fiscalYearDisplayFormat ?? "FY2025-26",
            fiscalYearCustomFormat: settings.effective?.fiscalYearCustomFormat ?? "",
            agpo: String(settings.effective?.complianceTargets.agpo ?? 30),
            pwd: String(settings.effective?.complianceTargets.pwd ?? 2),
            localContent: String(settings.effective?.complianceTargets.localContent ?? 40),
            allowedEmailDomains: (settings.effective?.allowedEmailDomains ?? []).join(", "),
        }));
    }, [settings]);
    async function save(): Promise<void> {
        setBusy(true);
        try {
            const result = await updateSettings({
                allowedEmailDomains: form.allowedEmailDomains.split(",").map((value) => value.trim()).filter(Boolean),
                complianceTargets: { agpo: Number(form.agpo), pwd: Number(form.pwd), localContent: Number(form.localContent) },
                confirmActiveCycleChange: form.confirmActiveCycleChange,
                fiscalYearCustomFormat: form.fiscalYearDisplayFormat === "custom" ? form.fiscalYearCustomFormat : undefined,
                fiscalYearDisplayFormat: form.fiscalYearDisplayFormat as "FY2025-26" | "2025/2026" | "custom",
                fiscalYearStartMonth: INSTITUTIONAL_FISCAL_YEAR_START_MONTH,
                institutionName: form.institutionName,
                primaryContactEmail: form.primaryContactEmail,
                primaryContactName: form.primaryContactName,
                primaryContactPhone: form.primaryContactPhone,
                timeZone: form.timeZone,
            });
            toast.success(result.activeCycle ? "Settings scheduled for the next procurement cycle." : "Institution settings saved.");
        } catch (error) { toast.error(readError(error)); } finally { setBusy(false); }
    }
    async function transfer(): Promise<void> {
        if (!transferTarget) return;
        try {
            await initiateTransfer({ recipientTenantUserId: transferTarget as any });
            toast.success("Transfer request created. The nominee was sent a one-time acceptance code.");
        } catch (error) { toast.error(readError(error)); }
    }
    async function saveProfile(): Promise<void> {
        try {
            await updateProfile({ name: form.primaryContactName, phone: form.primaryContactPhone });
            toast.success("Your profile was updated.");
        } catch (error) { toast.error(readError(error)); }
    }
    async function uploadLogo(file: File | undefined): Promise<void> {
        if (!file) return;
        try {
            const uploadUrl = await generateLogoUploadUrl({});
            const response = await fetch(uploadUrl, { body: file, headers: { "Content-Type": file.type }, method: "POST" });
            if (!response.ok) throw new Error("Logo upload failed.");
            const { storageId } = await response.json() as { storageId: string };
            await saveLogo({ storageId: storageId as any });
            setLogoFile(undefined);
            setLogoPreviewUrl(undefined);
            toast.success("Institution logo updated.");
        } catch (error) { toast.error(readError(error)); }
    }
    async function acceptPendingTransfer(): Promise<void> {
        if (!acceptanceToken.trim()) return;
        try {
            await acceptTransfer({ acceptanceToken: acceptanceToken.trim() });
            setAcceptanceToken("");
            toast.success("Tenant Admin responsibility accepted.");
        } catch (error) { toast.error(readError(error)); }
    }
    async function deleteAccount(): Promise<void> {
        if (!window.confirm("Request account deletion? Access will be disabled and the recovery window recorded.")) return;
        try {
            const result = await requestDeletion({});
            toast.success(`Account deletion requested. Recovery is retained until ${new Date(result.recoverUntil).toLocaleDateString()}.`);
        } catch (error) { toast.error(readError(error)); }
    }
    if (!settings) return <LoadingCard label="Loading institutional settings..." />;
    const activeFiscalYear = getProcurementFiscalYearForDate(Date.now(), {
        fiscalYearStartMonth: INSTITUTIONAL_FISCAL_YEAR_START_MONTH,
        timeZone: form.timeZone,
    });
    const fiscalYearPreview = formatFiscalYearBySetting({
        customFormat: form.fiscalYearCustomFormat,
        format: form.fiscalYearDisplayFormat as "FY2025-26" | "2025/2026" | "custom",
        startYear: activeFiscalYear.startYear,
    });
    const fiscalYearShortPreview = formatFiscalYearBySetting({
        format: "FY2025-26",
        startYear: activeFiscalYear.startYear,
    });
    const fiscalYearLongPreview = formatFiscalYearBySetting({
        format: "2025/2026",
        startYear: activeFiscalYear.startYear,
    });
    const timeZoneOptions = getTimeZoneOptions(form.timeZone);
    return (
        <div className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl xl:col-span-2">
                <CardHeader><CardTitle>Institution Settings</CardTitle><CardDescription>Persisted tenant identity, fiscal year, compliance rules, email domains, and timezone.</CardDescription></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="Institution name" value={form.institutionName} setValue={(value) => setForm({ ...form, institutionName: value })} />
                    <label className="space-y-1 text-sm">
                        <span className="font-medium">Timezone</span>
                        <select className="w-full rounded-md border bg-background p-2" value={form.timeZone} onChange={(event) => setForm({ ...form, timeZone: event.target.value })}>
                            {timeZoneOptions.map((timeZone) => <option key={timeZone} value={timeZone}>{timeZone}</option>)}
                        </select>
                    </label>
                    <Field label="Primary contact" value={form.primaryContactName} setValue={(value) => setForm({ ...form, primaryContactName: value })} />
                    <Field label="Contact email" value={form.primaryContactEmail} setValue={(value) => setForm({ ...form, primaryContactEmail: value })} />
                    <Field label="Contact phone" value={form.primaryContactPhone} setValue={(value) => setForm({ ...form, primaryContactPhone: value })} />
                    <div className="space-y-1 text-sm">
                        <span className="font-medium">Fiscal year period</span>
                        <div className="rounded-md border bg-muted/20 p-2">1 July - 30 June</div>
                        <span className="block text-xs text-muted-foreground">Fixed institutional reporting cycle.</span>
                    </div>
                    <label className="space-y-1 text-sm">
                        <span className="font-medium">Fiscal year display format</span>
                        <select className="w-full rounded-md border bg-background p-2" value={form.fiscalYearDisplayFormat} onChange={(event) => setForm({ ...form, fiscalYearDisplayFormat: event.target.value })}>
                            <option value="FY2025-26">{fiscalYearShortPreview}</option>
                            <option value="2025/2026">{fiscalYearLongPreview}</option>
                            <option value="custom">Custom format</option>
                        </select>
                        <span className="block text-xs text-muted-foreground">Current cycle preview: {fiscalYearPreview}</span>
                    </label>
                    {form.fiscalYearDisplayFormat === "custom" ? <Field label="Custom format ({start}, {endShort})" value={form.fiscalYearCustomFormat} setValue={(value) => setForm({ ...form, fiscalYearCustomFormat: value })} /> : null}
                    <Field label="AGPO target %" value={form.agpo} setValue={(value) => setForm({ ...form, agpo: value })} />
                    <Field label="PWD target %" value={form.pwd} setValue={(value) => setForm({ ...form, pwd: value })} />
                    <Field label="Local Content target %" value={form.localContent} setValue={(value) => setForm({ ...form, localContent: value })} />
                    <Field label="Allowed email domains (comma separated)" value={form.allowedEmailDomains} setValue={(value) => setForm({ ...form, allowedEmailDomains: value })} />
                    <label className="space-y-2 text-sm"><span className="font-medium">Institution logo (PNG, JPG, SVG; max 2 MB)</span><Input accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" type="file" onChange={(event) => { const file = event.target.files?.[0]; setLogoFile(file); setLogoPreviewUrl(file ? URL.createObjectURL(file) : undefined); }} />{logoPreviewUrl || settings.tenant.logoUrl ? <Image alt="Institution logo preview" className="h-16 max-w-44 rounded border object-contain p-1" height={64} src={logoPreviewUrl ?? settings.tenant.logoUrl} unoptimized width={176} /> : null}{logoFile ? <Button size="sm" type="button" variant="outline" onClick={() => void uploadLogo(logoFile)}>Save logo</Button> : null}</label>
                    <label className="flex items-center gap-2 text-sm md:col-span-2"><input checked={form.confirmActiveCycleChange} onChange={(event) => setForm({ ...form, confirmActiveCycleChange: event.target.checked })} type="checkbox" />I confirm fiscal/compliance changes may be scheduled for the next active cycle.</label>
                    {settings.pending ? <Alert className="md:col-span-2"><AlertTitle>Pending next-cycle settings</AlertTitle><AlertDescription>Version {settings.pending.version} is scheduled. Current-cycle plans remain unchanged and may require revalidation next cycle.</AlertDescription></Alert> : null}
                    <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : "Save settings"}</Button>
                </CardContent>
            </Card>
            <Card className="rounded-2xl">
                <CardHeader><CardTitle>Your Account</CardTitle><CardDescription>Verified email changes preserve existing sign-in access until confirmation.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                    <Button className="w-full" onClick={() => void saveProfile()}>Update profile</Button>
                    <Button variant="outline" className="w-full" onClick={() => void requestEmailChange({ purpose: "tenant_admin_email", requestedEmail: form.primaryContactEmail, targetTenantUserId: settings.currentTenantAdminId }).then(() => toast.success("Email verification requested. Existing email remains active.")).catch((error: unknown) => toast.error(readError(error)))}>Request email verification</Button>
                    <Input placeholder="Email verification code" value={emailVerificationToken} onChange={(event) => setEmailVerificationToken(event.target.value)} />
                    <Button variant="outline" className="w-full" disabled={!emailVerificationToken.trim()} onClick={() => void confirmEmailChange({ verificationToken: emailVerificationToken.trim() }).then(() => { setEmailVerificationToken(""); toast.success("Email address verified and updated."); }).catch((error: unknown) => toast.error(readError(error)))}>Confirm email change</Button>
                    <div className="border-t pt-3 text-sm font-medium">Transfer administration</div>
                    <select className="w-full rounded-md border bg-background p-2 text-sm" value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}>
                        <option value="">Select eligible recipient</option>
                        {snapshot.directory.procurementOfficerDirectory.filter((item) => item.source === "active_member" && item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                     <Button variant="outline" className="w-full" onClick={() => void transfer()} disabled={!transferTarget}>Request transfer</Button>
                     <Input placeholder="Transfer acceptance token" value={acceptanceToken} onChange={(event) => setAcceptanceToken(event.target.value)} />
                     <Button variant="outline" className="w-full" onClick={() => void acceptPendingTransfer()} disabled={!acceptanceToken.trim()}>Accept transfer</Button>
                     <div className="text-xs text-muted-foreground">{account?.transfers?.length ?? 0} transfer record(s) retained.</div>
                     <Button variant="destructive" className="w-full" onClick={() => void deleteAccount()}>Request account deletion</Button>
                </CardContent>
            </Card>
        </div>
    );
}

export function TenantAdminBillingOperationsView(): JSX.Element {
    const workspace = useQuery(operationsApi.getBillingWorkspace, {});
    const requestChange = useMutation(operationsApi.requestSubscriptionChange);
    const checkout = useAction(api.actions.payments.createSubscriptionCheckout);
    const generateInvoice = useAction(api.actions.payments.generateInvoice);
    const [provider, setProvider] = useState<"stripe" | "intasend" | "bank_transfer">("stripe");
    const paymentMethods = [
        {
            description: "Secure card checkout",
            icon: CreditCard,
            label: "Stripe card",
            value: "stripe" as const,
        },
        {
            description: "Mobile money payment",
            icon: Smartphone,
            label: "M-Pesa / IntaSend",
            value: "intasend" as const,
        },
        {
            description: "Invoice or LPO settlement",
            icon: Building2,
            label: "Bank transfer",
            value: "bank_transfer" as const,
        },
    ];
    if (!workspace) return <LoadingCard label="Loading billing workspace..." />;
    const status = workspace.tenant.subscriptionStatus ?? "active";
    async function changePlan(tier: any): Promise<void> {
        try {
            const result = await requestChange({ toTier: tier.slug });
            if (result.status === "pending_provider_confirmation" && result.checkoutAmountCents > 0) {
                await checkout({ amount: result.checkoutAmountCents, currency: "USD", customerReference: String(workspace.tenant._id), idempotencyKey: crypto.randomUUID(), planCode: tier.slug, provider });
                toast.success("Checkout requested. The plan changes only after payment confirmation.");
            } else {
                toast.success(result.status);
            }
        } catch (error) { toast.error(readError(error)); }
    }
    return (
        <div className="space-y-5">
            {status === "suspended" ? <Alert className="border-red-300 bg-red-50"><AlertTitle>Subscription suspended: read-only access</AlertTitle><AlertDescription>Procurement records remain available. Restore payment to resume changes.</AlertDescription></Alert> : null}
            {status === "grace_period" ? <Alert><AlertTitle>Payment recovery period active</AlertTitle><AlertDescription>Full access remains available until {new Date(workspace.tenant.subscriptionGracePeriodEndsAt).toLocaleDateString()}.</AlertDescription></Alert> : null}
            <div className="grid gap-5 xl:grid-cols-3">
                <Card><CardHeader><CardTitle>{workspace.tenant.tier} plan</CardTitle><CardDescription>Status: {status}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div>Payment path: {workspace.tenant.subscriptionPaymentMethod ?? "Not configured"}</div><div>Next billing: {workspace.tenant.subscriptionNextBillingDate ? new Date(workspace.tenant.subscriptionNextBillingDate).toLocaleDateString() : "Unavailable"}</div></CardContent></Card>
                <Card className="xl:col-span-2"><CardHeader><CardTitle>Live Usage</CardTitle></CardHeader><CardContent className="space-y-4">{workspace.metrics.map((metric: any) => <Usage key={metric.key} metric={metric} />)}</CardContent></Card>
            </div>
            <Card>
                <CardHeader><CardTitle>Plans</CardTitle><CardDescription>Upgrades open provider checkout and activate only after confirmation; downgrades take effect at renewal.</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Payment method</p>
                        <div className="grid gap-3 md:grid-cols-3">
                            {paymentMethods.map((method) => {
                                const selected = method.value === provider;
                                return (
                                    <button
                                        aria-pressed={selected}
                                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/30"}`}
                                        key={method.value}
                                        onClick={() => setProvider(method.value)}
                                        type="button"
                                    >
                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                            <method.icon className="h-4 w-4" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-medium">{method.label}</span>
                                            <span className="mt-1 block text-xs text-muted-foreground">{method.description}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">{workspace.tiers.map((tier: any) => <Button variant={tier.slug === workspace.tenant.tier ? "default" : "outline"} disabled={tier.slug === workspace.tenant.tier} key={tier.slug} onClick={() => void changePlan(tier)}>{tier.slug === "enterprise" ? "Contact Sales" : tier.tierName}</Button>)}</div>
                </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Invoices & Payments</CardTitle></CardHeader><CardContent className="space-y-2">{workspace.records.length === 0 ? <p className="text-sm text-muted-foreground">No verified provider billing records available.</p> : workspace.records.map((record: any) => <div key={record._id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{new Date(record.createdAt).toLocaleDateString()} / {record.provider}<br />{record.currency} {(record.amountCents / 100).toFixed(2)} / {record.status}</span>{record.invoiceDownloadUrl ? <a className="text-primary underline" href={record.invoiceDownloadUrl} rel="noreferrer" target="_blank">Download invoice</a> : <Button size="sm" variant="outline" onClick={() => void generateInvoice({ amount: record.amountCents, currency: record.currency, idempotencyKey: crypto.randomUUID(), tenantReference: String(workspace.tenant._id) }).then(() => toast.success("Invoice generation queued.")).catch((error: unknown) => toast.error(readError(error)))}>Generate invoice</Button>}</div>)}</CardContent></Card>
        </div>
    );
}

export function TenantAdminSecurityView(): JSX.Element {
    const workspace = useQuery(operationsApi.getSecurityWorkspace, {});
    const begin = useMutation(operationsApi.beginTwoFactorEnrollment);
    const confirm = useMutation(operationsApi.confirmTwoFactorEnrollment);
    const acknowledgeRecoveryCodes = useMutation(operationsApi.acknowledgeTwoFactorRecoveryCodes);
    const revoke = useMutation(operationsApi.revokeOtherSession);
    const [enrollment, setEnrollment] = useState<{ secret: string; qrRepresentation: string } | null>(null);
    const [totpCode, setTotpCode] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
    if (!workspace) return <LoadingCard label="Loading account security..." />;
    return <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Authenticator protection</CardTitle><CardDescription>{workspace.isTwoFactorEnrolled ? "Two-factor authentication enrolled." : "Enroll a TOTP authenticator and retain one-time recovery codes."}</CardDescription></CardHeader><CardContent className="space-y-3">{recoveryCodes ? <><Alert><AlertTitle>Save recovery codes before enabling two-factor authentication</AlertTitle><AlertDescription><div className="mt-2 font-mono text-xs">{recoveryCodes.join("  ")}</div></AlertDescription></Alert><Button onClick={() => void acknowledgeRecoveryCodes({}).then(() => { setRecoveryCodes(null); setEnrollment(null); toast.success("Two-factor authentication enabled."); }).catch((error: unknown) => toast.error(readError(error)))}>I saved these recovery codes</Button></> : !enrollment ? <Button onClick={() => void begin({}).then(setEnrollment)}>Begin enrollment</Button> : <><div className="rounded border p-3 font-mono text-xs break-all">{enrollment.qrRepresentation}</div><Input placeholder="6-digit authenticator code" value={totpCode} onChange={(event) => setTotpCode(event.target.value)} /><Button onClick={() => void confirm({ code: totpCode, secret: enrollment.secret }).then((result: any) => setRecoveryCodes(result.recoveryCodes)).catch((error: unknown) => toast.error(readError(error)))}>Confirm authenticator code</Button></>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Active sessions</CardTitle></CardHeader><CardContent className="space-y-2">{workspace.sessions.map((session: any) => <div key={session.id} className="flex items-center justify-between rounded border p-3 text-sm"><span>{session.device} / {new Date(session.lastActivityAt).toLocaleString()}{session.isCurrent ? " / Current session" : ""}</span><Button size="sm" variant="outline" disabled={session.isCurrent || Boolean(session.revokedAt)} onClick={() => void revoke({ sessionMetadataId: session.id }).catch((error: unknown) => toast.error(readError(error)))}>Terminate</Button></div>)}</CardContent></Card>
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Security history</CardTitle></CardHeader><CardContent className="space-y-2">{workspace.events.length === 0 ? <p className="text-sm text-muted-foreground">No enriched security events recorded. Location is unavailable until a verified source records it.</p> : workspace.events.map((event: any) => <div key={event._id} className="rounded border p-3 text-sm">{event.event} / {new Date(event.timestamp).toLocaleString()} / {event.country ?? "Location unavailable"}</div>)}</CardContent></Card>
    </div>;
}

function Field({ label, setValue, value }: { label: string; setValue: (value: string) => void; value: string }): JSX.Element {
    return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span><Input value={value} onChange={(event) => setValue(event.target.value)} /></label>;
}
function LoadingCard({ label }: { label: string }): JSX.Element { return <Card><CardContent className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</CardContent></Card>; }
function Usage({ metric }: { metric: any }): JSX.Element {
    if (metric.current === null || metric.limit === null) return <div className="text-sm"><span className="font-medium">{metric.label}:</span> <span className="text-muted-foreground">{metric.unavailableReason ?? "Unavailable"}</span></div>;
    const percent = Math.round((metric.current / metric.limit) * 100);
    const tone = getUsageTone(metric);
    return <div><div className="mb-1 flex justify-between text-sm"><span>{metric.label}</span><span>{metric.current} / {metric.limit} <Badge variant="outline">{tone}</Badge></span></div><Progress value={Math.min(percent, 100)} /></div>;
}
function readError(error: unknown): string { return error instanceof Error ? error.message : "The requested operation could not be completed."; }
