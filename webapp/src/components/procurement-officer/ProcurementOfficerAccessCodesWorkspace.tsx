"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction, useMutation, useQuery } from "convex/react";
import {
    Copy,
    History,
    KeyRound,
    Loader2,
    Mail,
    Power,
    RefreshCcw,
    Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    buildAccessCodeBulkGenerationFeedback,
    getAccessCodeExpirationFormError,
    validateAccessCodeExpiration,
    type AccessCodeBulkGenerationFeedback,
} from "@/lib/procurement-officer/access-codes";

interface AccessCodesWorkspaceData {
    meta: {
        defaultExpirationAt: number | null;
        defaultExpirationLabel: string;
        defaultExpirationState: "available" | "setup_required";
        loginUrl: string;
        now: number;
    };
    rows: Array<{
        accessCodeId: string | null;
        canEmailActiveCode: boolean;
        codeMasked: string;
        deliveryStatus: "failed" | "none" | "queued" | "sent";
        deliveryStatusLabel: string;
        expiresAt: number | null;
        hasActiveCode: boolean;
        id: string;
        issuedAt: number | null;
        knownRecipientEmails: string[];
        lastActivityAt: number | null;
        lastActivitySummary: string;
        lastDeliveryEmail: string | null;
        latestHistoryCount: number;
        name: string;
        statusLabel: string;
    }>;
}

interface AccessCodeHistoryData {
    items: Array<{
        email: string | null;
        event: string;
        message: string;
        occurredAt: number;
        origin: string;
        outcome: string;
        userAgent: string | null;
    }>;
    limit: number;
}

const issueSchema = z.object({
    expiresAt: z.string().min(1, "Choose an expiration."),
});

const emailSchema = z.object({
    email: z.string().email("Enter a valid recipient email."),
});

const bulkSchema = z.object({
    expiresAt: z.string().min(1, "Choose an expiration."),
    includeDepartmentsWithActiveCodes: z.boolean().default(false),
});

function toDateTimeLocalValue(timestamp: number | null | undefined): string {
    if (typeof timestamp !== "number") {
        return "";
    }

    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
}

function parseDateTimeLocal(value: string): number | null {
    const parsed = new Date(value);
    const timestamp = parsed.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

function formatTimestamp(timestamp: number | null): string {
    if (typeof timestamp !== "number") {
        return "Not set";
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(timestamp));
}

export function ProcurementOfficerAccessCodesWorkspace(): JSX.Element {
    const workspace = useQuery(
        api.functions.accessCodes.getAccessCodesWorkspace,
        {},
    ) as AccessCodesWorkspaceData | undefined;
    const generateAccessCode = useMutation(api.functions.accessCodes.generateAccessCode);
    const rotateAccessCode = useMutation(api.functions.accessCodes.rotateAccessCode);
    const deactivateAccessCode = useMutation(api.functions.accessCodes.deactivateAccessCode);
    const bulkGenerateAccessCodes = useMutation(api.functions.accessCodes.bulkGenerateAccessCodes);
    const sendAccessCodeEmail = useAction(api.functions.accessCodes.sendAccessCodeEmail);

    const [issueTarget, setIssueTarget] = useState<{
        id: string;
        mode: "generate" | "rotate";
        name: string;
    } | null>(null);
    const [emailTarget, setEmailTarget] = useState<{
        accessCodeId: string;
        emails: string[];
        id: string;
        name: string;
    } | null>(null);
    const [historyTarget, setHistoryTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [deactivateTarget, setDeactivateTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bulkFeedback, setBulkFeedback] =
        useState<AccessCodeBulkGenerationFeedback | null>(null);
    const [revealedCode, setRevealedCode] = useState<{
        departmentName: string;
        expiresAt: number;
        mode: "generate" | "rotate";
        value: string;
    } | null>(null);

    const history = useQuery(
        api.functions.accessCodes.getDepartmentAccessCodeHistory,
        historyTarget ? { departmentId: historyTarget.id as any, limit: 20 } : "skip",
    ) as AccessCodeHistoryData | undefined;

    const issueForm = useForm<z.infer<typeof issueSchema>>({
        resolver: zodResolver(issueSchema),
        defaultValues: {
            expiresAt: "",
        },
    });
    const emailForm = useForm<z.infer<typeof emailSchema>>({
        resolver: zodResolver(emailSchema),
        defaultValues: {
            email: "",
        },
    });
    const bulkForm = useForm<z.infer<typeof bulkSchema>>({
        resolver: zodResolver(bulkSchema),
        defaultValues: {
            expiresAt: "",
            includeDepartmentsWithActiveCodes: false,
        },
    });

    useEffect(() => {
        if (!workspace || !issueTarget) {
            return;
        }

        issueForm.reset({
            expiresAt: toDateTimeLocalValue(workspace.meta.defaultExpirationAt),
        });
    }, [issueForm, issueTarget, workspace]);

    useEffect(() => {
        if (!emailTarget) {
            return;
        }

        emailForm.reset({
            email: emailTarget.emails[0] ?? "",
        });
    }, [emailForm, emailTarget]);

    useEffect(() => {
        if (!workspace || !isBulkOpen) {
            return;
        }

        bulkForm.reset({
            expiresAt: toDateTimeLocalValue(workspace.meta.defaultExpirationAt),
            includeDepartmentsWithActiveCodes: false,
        });
    }, [bulkForm, isBulkOpen, workspace]);

    if (!workspace) {
        return <AccessCodesWorkspaceSkeleton />;
    }

    async function handleIssueSubmit(values: z.infer<typeof issueSchema>): Promise<void> {
        if (!issueTarget) {
            return;
        }

        const expiresAt = parseDateTimeLocal(values.expiresAt);
        if (expiresAt === null) {
            issueForm.setError("expiresAt", {
                message: "Choose a valid expiration.",
            });
            return;
        }
        const expirationValidation = validateAccessCodeExpiration({
            expirationAt: expiresAt,
            now: Date.now(),
        });
        if (!expirationValidation.ok) {
            issueForm.setError("expiresAt", {
                message: expirationValidation.message,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const result =
                issueTarget.mode === "rotate"
                    ? await rotateAccessCode({
                        departmentId: issueTarget.id as any,
                        expiresAt,
                    })
                    : await generateAccessCode({
                        departmentId: issueTarget.id as any,
                        expiresAt,
                    });

            setIssueTarget(null);
            setRevealedCode({
                departmentName: issueTarget.name,
                expiresAt: result.expiresAt,
                mode: issueTarget.mode,
                value: result.code,
            });
            toast.success(
                issueTarget.mode === "rotate"
                    ? "Access code rotated."
                    : "Access code generated.",
            );
        } catch (error) {
            const validationError = getAccessCodeExpirationFormError(error);
            if (validationError) {
                issueForm.setError(validationError.field, {
                    message: validationError.message,
                });
                return;
            }
            toast.error(error instanceof Error ? error.message : "We could not issue that access code right now.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleEmailSubmit(values: z.infer<typeof emailSchema>): Promise<void> {
        if (!emailTarget) {
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await sendAccessCodeEmail({
                accessCodeId: emailTarget.accessCodeId as any,
                departmentId: emailTarget.id as any,
                email: values.email,
            });
            setEmailTarget(null);
            toast.success(result.duplicate ? "Email request already queued." : "Email queued.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "We could not queue that email.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeactivate(): Promise<void> {
        if (!deactivateTarget) {
            return;
        }

        setIsSubmitting(true);
        try {
            await deactivateAccessCode({
                departmentId: deactivateTarget.id as any,
            });
            setDeactivateTarget(null);
            toast.success("Access code deactivated.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "We could not deactivate that access code.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleBulkSubmit(values: z.infer<typeof bulkSchema>): Promise<void> {
        const expiresAt = parseDateTimeLocal(values.expiresAt);
        if (expiresAt === null) {
            bulkForm.setError("expiresAt", {
                message: "Choose a valid expiration.",
            });
            return;
        }
        const expirationValidation = validateAccessCodeExpiration({
            expirationAt: expiresAt,
            now: Date.now(),
        });
        if (!expirationValidation.ok) {
            bulkForm.setError("expiresAt", {
                message: expirationValidation.message,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await bulkGenerateAccessCodes({
                expiresAt,
                includeDepartmentsWithActiveCodes: values.includeDepartmentsWithActiveCodes,
            });
            setIsBulkOpen(false);
            setBulkFeedback(
                buildAccessCodeBulkGenerationFeedback({
                    noEligibleDepartments: Boolean(result.noEligibleDepartments),
                    results: Array.isArray(result.results) ? result.results : [],
                    summary:
                        typeof result.summary === "string"
                            ? result.summary
                            : "Bulk access-code generation completed.",
                }),
            );
            toast.success(result.summary);
        } catch (error) {
            const validationError = getAccessCodeExpirationFormError(error);
            if (validationError) {
                bulkForm.setError(validationError.field, {
                    message: validationError.message,
                });
                return;
            }
            toast.error(error instanceof Error ? error.message : "Bulk generation failed.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleCopyReveal(): Promise<void> {
        if (!revealedCode) {
            return;
        }

        await navigator.clipboard.writeText(revealedCode.value);
        toast.success("Copied!");
    }

    return (
        <div className="space-y-4">
            {revealedCode ? (
                <div className="rounded-3xl border border-emerald-300/70 bg-emerald-50/80 p-4 text-emerald-950">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em]">
                                {revealedCode.mode === "rotate" ? "Rotated code" : "Fresh code"}
                            </div>
                            <div className="mt-2 font-mono text-xl font-semibold">
                                {revealedCode.value}
                            </div>
                            <p className="mt-2 text-sm leading-6">
                                This is the only immediate plaintext reveal for {revealedCode.departmentName}. Expires {formatTimestamp(revealedCode.expiresAt)}.
                            </p>
                        </div>
                        <Button type="button" variant="secondary" onClick={() => void handleCopyReveal()}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                            <KeyRound className="h-4 w-4" />
                            Access-code management
                        </div>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                            Manage the canonical department codes that DUs use to sign in. The list stays masked by default and reveals plaintext only right after issue or rotation.
                        </p>
                    </div>
                    <Button type="button" className="rounded-xl" onClick={() => setIsBulkOpen(true)}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Bulk Generate Codes
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1.5">
                        Active coverage: {workspace.rows.filter((row) => row.hasActiveCode).length} / {workspace.rows.length}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1.5">
                        Default expiration: {workspace.meta.defaultExpirationLabel}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1.5">
                        Login path: {workspace.meta.loginUrl}
                    </Badge>
                </div>

                {workspace.meta.defaultExpirationState !== "available" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                        No safe shared deadline is available yet, so every generate or rotate action requires a manual future expiration.
                    </div>
                ) : null}
            </div>

            <div className="grid gap-3">
                {workspace.rows.map((row) => (
                    <div key={row.id} className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-3">
                                <div>
                                    <div className="text-lg font-semibold text-foreground">{row.name}</div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                                        <Badge variant="outline" className="rounded-full">{row.statusLabel}</Badge>
                                        <Badge variant="outline" className="rounded-full">{row.codeMasked}</Badge>
                                        <Badge variant="outline" className="rounded-full">{row.deliveryStatusLabel}</Badge>
                                    </div>
                                </div>
                                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                                    <InfoLine label="Expires" value={formatTimestamp(row.expiresAt)} />
                                    <InfoLine label="Issued" value={formatTimestamp(row.issuedAt)} />
                                    <InfoLine label="Last delivery" value={row.lastDeliveryEmail ?? "Not sent"} />
                                    <InfoLine label="Last activity" value={row.lastActivitySummary} />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {row.hasActiveCode &&
                                    row.canEmailActiveCode &&
                                    row.accessCodeId &&
                                    row.knownRecipientEmails.length > 0
                                        ? row.knownRecipientEmails.map((email) => (
                                            <button
                                                key={email}
                                                className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                                                onClick={() => setEmailTarget({
                                                    accessCodeId: row.accessCodeId as string,
                                                    emails: [
                                                        email,
                                                        ...row.knownRecipientEmails.filter((candidate) => candidate !== email),
                                                    ],
                                                    id: row.id,
                                                    name: row.name,
                                                })}
                                                type="button"
                                            >
                                                {email}
                                            </button>
                                        ))
                                        : row.hasActiveCode && !row.canEmailActiveCode
                                          ? (
                                              <span className="text-xs text-amber-700">
                                                  Rotate this code before emailing it.
                                              </span>
                                            )
                                          : (
                                              <span className="text-xs text-muted-foreground">No known DU emails saved yet.</span>
                                            )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 xl:max-w-sm xl:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => setHistoryTarget({ id: row.id, name: row.name })}
                                >
                                    <History className="mr-2 h-4 w-4" />
                                    History
                                </Button>
                                {row.hasActiveCode && row.accessCodeId ? (
                                    <>
                                        {row.canEmailActiveCode ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-full"
                                                onClick={() => setEmailTarget({
                                                    accessCodeId: row.accessCodeId as string,
                                                    emails: row.knownRecipientEmails,
                                                    id: row.id,
                                                    name: row.name,
                                                })}
                                            >
                                                <Mail className="mr-2 h-4 w-4" />
                                                Email
                                            </Button>
                                        ) : null}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-full"
                                            onClick={() => setIssueTarget({ id: row.id, mode: "rotate", name: row.name })}
                                        >
                                            <RefreshCcw className="mr-2 h-4 w-4" />
                                            Rotate
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            className="rounded-full"
                                            onClick={() => setDeactivateTarget({ id: row.id, name: row.name })}
                                        >
                                            <Power className="mr-2 h-4 w-4" />
                                            Deactivate
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        className="rounded-full"
                                        onClick={() => setIssueTarget({ id: row.id, mode: "generate", name: row.name })}
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={Boolean(issueTarget)} onOpenChange={(open) => !open && setIssueTarget(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{issueTarget?.mode === "rotate" ? "Rotate access code" : "Generate access code"}</DialogTitle>
                        <DialogDescription>
                            {issueTarget?.mode === "rotate"
                                ? "The old active code stops working immediately after rotation."
                                : "Issue a first active code for this department."}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...issueForm}>
                        <form className="space-y-4" onSubmit={(event) => void issueForm.handleSubmit(handleIssueSubmit)(event)}>
                            <FormField
                                control={issueForm.control}
                                name="expiresAt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Expiration</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIssueTarget(null)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {issueTarget?.mode === "rotate" ? "Rotate" : "Generate"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(emailTarget)} onOpenChange={(open) => !open && setEmailTarget(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Email access code</DialogTitle>
                        <DialogDescription>
                            Queue the current active access code for {emailTarget?.name}. Known compatible DU emails are shown below when available.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...emailForm}>
                        <form className="space-y-4" onSubmit={(event) => void emailForm.handleSubmit(handleEmailSubmit)(event)}>
                            <FormField
                                control={emailForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Recipient email</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="department.user@institution.ac.ke" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {emailTarget?.emails.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {emailTarget.emails.map((email) => (
                                        <button
                                            key={email}
                                            className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                                            onClick={() => emailForm.setValue("email", email, { shouldDirty: true, shouldValidate: true })}
                                            type="button"
                                        >
                                            {email}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEmailTarget(null)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Queue Email
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Deactivate access code</DialogTitle>
                        <DialogDescription>
                            The current code for {deactivateTarget?.name} will stop working immediately for DU sign-in.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-900">
                        This action is destructive and does not generate a replacement code.
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="button" variant="destructive" onClick={() => void handleDeactivate()} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Deactivate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Bulk generate access codes</DialogTitle>
                        <DialogDescription>
                            Fill missing department access codes in one guarded flow. Departments with active codes stay untouched unless you explicitly include them.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...bulkForm}>
                        <form className="space-y-4" onSubmit={(event) => void bulkForm.handleSubmit(handleBulkSubmit)(event)}>
                            <FormField
                                control={bulkForm.control}
                                name="expiresAt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Expiration</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={bulkForm.control}
                                name="includeDepartmentsWithActiveCodes"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start gap-3 rounded-2xl border border-border/70 px-4 py-3">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                                        </FormControl>
                                        <div className="space-y-1">
                                            <FormLabel>Also rotate departments that already have active codes</FormLabel>
                                            <p className="text-sm text-muted-foreground">
                                                Use this only when you intend to replace every current active code in scope.
                                            </p>
                                        </div>
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsBulkOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Run Bulk Generate
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(historyTarget)} onOpenChange={(open) => !open && setHistoryTarget(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{historyTarget?.name} login history</DialogTitle>
                        <DialogDescription>
                            Bounded event history for access-code activity. Missing origin data is shown honestly as unavailable.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {history === undefined ? (
                            <Skeleton className="h-40 rounded-3xl" />
                        ) : history.items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                                No access-code history has been recorded yet.
                            </div>
                        ) : history.items.map((item, index) => (
                            <div key={`${item.event}-${item.occurredAt}-${index}`} className="rounded-2xl border border-border/70 bg-card p-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div className="font-medium text-foreground">{item.message}</div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            {item.email ?? "No email recorded"} · {item.origin}
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground">{formatTimestamp(item.occurredAt)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(bulkFeedback)} onOpenChange={(open) => !open && setBulkFeedback(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{bulkFeedback?.title}</DialogTitle>
                        <DialogDescription>{bulkFeedback?.summary}</DialogDescription>
                    </DialogHeader>
                    {bulkFeedback ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="rounded-full px-3 py-1.5">
                                    Generated: {bulkFeedback.generatedCount}
                                </Badge>
                                <Badge variant="outline" className="rounded-full px-3 py-1.5">
                                    Skipped: {bulkFeedback.skippedCount}
                                </Badge>
                                <Badge variant="outline" className="rounded-full px-3 py-1.5">
                                    Failed: {bulkFeedback.failedCount}
                                </Badge>
                            </div>

                            {bulkFeedback.items.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                                    No departments needed changes in this run.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {bulkFeedback.items.map((item) => (
                                        <div
                                            key={`${item.departmentId}-${item.outcome}`}
                                            className="rounded-2xl border border-border/70 bg-card p-4"
                                        >
                                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <div className="font-medium text-foreground">{item.departmentName}</div>
                                                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                                                </div>
                                                <Badge variant="outline" className="rounded-full px-3 py-1.5">
                                                    {item.outcome}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm text-foreground">{value}</div>
        </div>
    );
}

function AccessCodesWorkspaceSkeleton(): JSX.Element {
    return (
        <div className="space-y-4">
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
        </div>
    );
}
