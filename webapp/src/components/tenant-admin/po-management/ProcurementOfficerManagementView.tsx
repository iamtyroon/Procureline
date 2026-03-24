"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "convex/react";
import {
    AlertTriangle,
    Clock3,
    Copy,
    MailWarning,
    ShieldAlert,
    UserPlus,
    Users2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type {
    TenantAdminDashboardSnapshot,
    TenantAdminProcurementOfficerDirectoryEntry,
} from "@/lib/tenant-admin/dashboard-snapshot";
import {
    procurementOfficerInviteSchema,
    type ProcurementOfficerInviteFormData,
} from "@/lib/validators/procurement-officer";

interface ProcurementOfficerManagementViewProps {
    snapshot: TenantAdminDashboardSnapshot;
}

interface LastIssuedInviteState {
    activationCode: string;
    deliveryStatus: "failed" | "sent";
    email: string;
    fullName: string;
    inviteUrl: string;
}

export function ProcurementOfficerManagementView({
    snapshot,
}: ProcurementOfficerManagementViewProps): JSX.Element {
    const issueInvitation = useAction(
        api.functions.procurementOfficerOnboarding.issueInvitation,
    );
    const resendInvitation = useAction(
        api.functions.procurementOfficerOnboarding.resendInvitation,
    );
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastIssuedInvite, setLastIssuedInvite] =
        useState<LastIssuedInviteState | null>(null);
    const form = useForm<ProcurementOfficerInviteFormData>({
        resolver: zodResolver(procurementOfficerInviteSchema),
        defaultValues: {
            email: "",
            fullName: "",
            phone: "",
        },
    });
    const submitInviteForm = form.handleSubmit((values) => {
        void handleInviteSubmit(values);
    });

    const directory = snapshot.directory.procurementOfficerDirectory;
    const activeCount = directory.filter((entry) => entry.status === "active").length;
    const pendingCount = directory.filter((entry) => entry.status === "pending").length;
    const attentionEntries = directory.filter(
        (entry) => entry.status === "bounced" || entry.status === "expired",
    );
    const stagedLifecycleEntries = directory.filter(
        (entry) => entry.source === "active_member",
    );
    const warningText = useMemo(() => {
        if (attentionEntries.length === 0) {
            return null;
        }

        return attentionEntries
            .map((entry) => `${entry.name} is ${entry.statusLabel.toLowerCase()}.`)
            .join(" ");
    }, [attentionEntries]);

    async function handleInviteSubmit(
        values: ProcurementOfficerInviteFormData,
    ): Promise<void> {
        setIsSubmitting(true);

        try {
            const result = await issueInvitation(values);
            setLastIssuedInvite(result);
            toast.success("Procurement Officer invitation created.");
            form.reset();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "We could not issue that invitation right now.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResend(invitationId: string): Promise<void> {
        setIsSubmitting(true);

        try {
            const result = await resendInvitation({
                invitationId: invitationId as any,
            });
            setLastIssuedInvite(result);
            setDialogOpen(true);
            toast.success("Fresh invitation credentials issued.");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "We could not resend that invitation right now.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleCopy(value: string, label: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copied.`);
        } catch {
            toast.error(`We could not copy the ${label.toLowerCase()}.`);
        }
    }

    return (
        <div className="grid gap-5 xl:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Users2 className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                        Active Procurement Officers
                    </div>
                    <div className="text-3xl font-bold text-foreground">{activeCount}</div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                        <Clock3 className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                        Pending Invitations
                    </div>
                    <div className="text-3xl font-bold text-foreground">{pendingCount}</div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                        Needs Attention
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                        {attentionEntries.length}
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-sm xl:col-span-3">
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 pb-4">
                    <div>
                        <CardTitle className="text-base text-foreground">
                            Procurement Officer Directory
                        </CardTitle>
                        <CardDescription>
                            Invite Procurement Officers, monitor invitation delivery, and keep
                            lifecycle actions staged for Story 3.4.
                        </CardDescription>
                    </div>
                    <Dialog
                        open={dialogOpen}
                        onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) {
                                setLastIssuedInvite(null);
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Add PO
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Add and invite Procurement Officer</DialogTitle>
                                <DialogDescription>
                                    Issue a secure invite link and activation code for a
                                    Procurement Officer in {snapshot.meta.tenantName}.
                                </DialogDescription>
                            </DialogHeader>

                            {lastIssuedInvite ? (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                                        <div className="text-sm font-medium text-foreground">
                                            Invitation ready for {lastIssuedInvite.fullName}
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            {lastIssuedInvite.deliveryStatus === "sent"
                                                ? "The email invitation was sent and the activation code is ready to copy."
                                                : "The email dispatch did not complete, but the activation code is ready for manual sharing."}
                                        </div>
                                    </div>
                                    <div className="grid gap-3">
                                        <InviteArtifactCard
                                            label="Activation code"
                                            onCopy={() =>
                                                void handleCopy(
                                                    lastIssuedInvite.activationCode,
                                                    "Activation code",
                                                )
                                            }
                                            value={lastIssuedInvite.activationCode}
                                        />
                                        <InviteArtifactCard
                                            label="Invite link"
                                            onCopy={() =>
                                                void handleCopy(
                                                    lastIssuedInvite.inviteUrl,
                                                    "Invite link",
                                                )
                                            }
                                            value={lastIssuedInvite.inviteUrl}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setDialogOpen(false);
                                                setLastIssuedInvite(null);
                                            }}
                                        >
                                            Close
                                        </Button>
                                    </DialogFooter>
                                </div>
                            ) : (
                                <Form {...form}>
                                    <form
                                        className="space-y-4"
                                        onSubmit={(event) => {
                                            void submitInviteForm(event);
                                        }}
                                    >
                                        <FormField
                                            control={form.control}
                                            name="fullName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Full name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Amina Wanjiku" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            autoComplete="email"
                                                            placeholder="po@institution.ac.ke"
                                                            type="email"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Phone</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="+254700123456"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        This phone number stays on the invitation record
                                                        for manual follow-up and audit context.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <DialogFooter>
                                            <Button
                                                type="submit"
                                                className="w-full sm:w-auto"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? "Issuing invitation..." : "Issue invitation"}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            )}
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                    {warningText ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                            <div className="mb-1 flex items-center gap-2 font-medium">
                                <MailWarning className="h-4 w-4" />
                                Invitation delivery warnings
                            </div>
                            {warningText}
                        </div>
                    ) : null}

                    {directory.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                            <p className="text-sm font-medium text-foreground">
                                No Procurement Officers or invitations yet
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Invite your first Procurement Officer to activate department and
                                procurement-management workflows.
                            </p>
                        </div>
                    ) : (
                        directory.map((entry) => (
                            <DirectoryRow
                                key={entry.id}
                                entry={entry}
                                isBusy={isSubmitting}
                                onResend={() =>
                                    entry.invitationId
                                        ? void handleResend(entry.invitationId)
                                        : undefined
                                }
                            />
                        ))
                    )}

                    {stagedLifecycleEntries.length > 0 ? (
                        <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                            Edit, Replace, and Deactivate stay visible as follow-on lifecycle
                            controls for Story 3.4. This story only covers add-and-invite
                            onboarding.
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}

function DirectoryRow({
    entry,
    isBusy,
    onResend,
}: {
    entry: TenantAdminProcurementOfficerDirectoryEntry;
    isBusy: boolean;
    onResend: () => void;
}): JSX.Element {
    const showResend =
        entry.source === "invitation" &&
        (entry.status === "bounced" || entry.status === "expired" || entry.status === "pending");

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/20 p-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
                    {entry.initials}
                </div>
                <div className="space-y-3">
                    <div>
                        <div className="text-lg font-semibold text-foreground">{entry.name}</div>
                        <div className="text-sm text-muted-foreground">{entry.email}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <InlineMeta value={entry.statusLabel} warning={entry.status === "bounced" || entry.status === "expired"} />
                        <InlineMeta
                            value={
                                entry.source === "invitation"
                                    ? `Issued ${entry.issuedAtLabel}`
                                    : entry.lastSeenLabel
                            }
                        />
                        {entry.source === "active_member" ? (
                            <InlineMeta
                                value={`${entry.departmentsManaged} department${entry.departmentsManaged === 1 ? "" : "s"} managed`}
                            />
                        ) : null}
                        {entry.activationCodeSuffix ? (
                            <InlineMeta value={`Code ending ${entry.activationCodeSuffix}`} />
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {showResend ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={onResend}
                    >
                        Resend credentials
                    </Button>
                ) : null}
                {entry.source === "active_member" ? (
                    <>
                        <Button type="button" variant="outline" size="sm" disabled>
                            Edit
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled>
                            Replace
                        </Button>
                        <Button type="button" variant="destructive" size="sm" disabled>
                            Deactivate
                        </Button>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function InviteArtifactCard({
    label,
    onCopy,
    value,
}: {
    label: string;
    onCopy: () => void;
    value: string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="mt-2 break-all rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                {value}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3 gap-2" onClick={onCopy}>
                <Copy className="h-4 w-4" />
                Copy
            </Button>
        </div>
    );
}

function InlineMeta({
    value,
    warning = false,
}: {
    value: string;
    warning?: boolean;
}): JSX.Element {
    return (
        <span
            className={
                warning
                    ? "inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800"
                    : "inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2.5 py-1"
            }
        >
            {warning ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
            {value}
        </span>
    );
}
