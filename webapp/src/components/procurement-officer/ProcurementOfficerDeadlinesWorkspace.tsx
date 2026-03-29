"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction, useQuery } from "convex/react";
import { AlertTriangle, CalendarClock, Loader2, Megaphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
    classifySubmissionDeadlineChange,
    getSkippedReminderOffsets,
    parseTimeZoneInputValue,
} from "@/lib/procurement-officer/deadlines";
import {
    submissionDeadlineFormSchema,
    type SubmissionDeadlineFormData,
} from "@/lib/validators/deadline";

interface DeadlinesWorkspaceData {
    current: {
        announcementIssuedAt: number | null;
        announcementMessage: string | null;
        announcementTitle: string | null;
        changeType: string | null;
        countdownLabel: string;
        deadlineVersion: number;
        reminderOffsets: number[];
        scheduledReminderOffsets: number[];
        skippedReminderOffsets: number[];
        source: "canonical" | "department_fallback" | "none";
        submissionEndsAt: number | null;
        submissionEndsAtInput: string;
        submissionStartsAt: number | null;
        submissionStartsAtInput: string;
        timeZone: string;
        timeZoneUsesFallback: boolean;
        updatedAt: number | null;
    };
    meta: {
        activeDepartmentCount: number;
        impactedDepartmentCount: number;
        now: number;
        recipientCount: number;
        reminderOptionDays: number[];
        selectedFiscalYear: string;
        tenantName: string;
        timeZone: string;
        timeZoneUsesFallback: boolean;
    };
    reminderJobs: {
        failedCount: number;
        scheduledCount: number;
    };
    selection: {
        options: string[];
        selectedFiscalYear: string;
    };
}

export function ProcurementOfficerDeadlinesWorkspace(props?: {
    onSelectedFiscalYearChange?: (fiscalYear: string) => void;
    selectedFiscalYear?: string;
}): JSX.Element {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string | undefined>(
        props?.selectedFiscalYear,
    );
    const workspace = useQuery(
        api.functions.deadlines.getDeadlinesWorkspace,
        selectedFiscalYear ? { selectedFiscalYear } : {},
    ) as DeadlinesWorkspaceData | undefined;
    const saveDeadline = useAction(api.functions.deadlines.upsertSubmissionDeadline);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<SubmissionDeadlineFormData>({
        resolver: zodResolver(submissionDeadlineFormSchema),
        defaultValues: {
            confirmTightening: false,
            extensionReason: "",
            reminderOffsets: [],
            selectedFiscalYear: "",
            submissionEndsAt: "",
            submissionStartsAt: "",
        },
    });

    useEffect(() => {
        if (!props?.selectedFiscalYear) {
            return;
        }

        setSelectedFiscalYear(props.selectedFiscalYear);
    }, [props?.selectedFiscalYear]);

    useEffect(() => {
        if (!workspace) {
            return;
        }

        setSelectedFiscalYear(workspace.selection.selectedFiscalYear);
        props?.onSelectedFiscalYearChange?.(workspace.selection.selectedFiscalYear);
        form.reset({
            confirmTightening: false,
            extensionReason: "",
            reminderOffsets: workspace.current.reminderOffsets,
            selectedFiscalYear: workspace.selection.selectedFiscalYear,
            submissionEndsAt: workspace.current.submissionEndsAtInput,
            submissionStartsAt: workspace.current.submissionStartsAtInput,
        });
    }, [form, props, workspace]);

    const values = form.watch();
    const preview = useMemo(() => {
        if (!workspace) {
            return null;
        }

        const nextStart = parseTimeZoneInputValue(
            values.submissionStartsAt,
            workspace.current.timeZone,
        );
        const nextEnd = parseTimeZoneInputValue(
            values.submissionEndsAt,
            workspace.current.timeZone,
        );
        const changeType =
            typeof nextStart === "number" && typeof nextEnd === "number"
                ? classifySubmissionDeadlineChange({
                      currentEndsAt: workspace.current.submissionEndsAt,
                      currentStartsAt: workspace.current.submissionStartsAt,
                      nextEndsAt: nextEnd,
                      nextStartsAt: nextStart,
                  })
                : "unchanged";
        const skippedReminderOffsets =
            typeof nextEnd === "number"
                ? getSkippedReminderOffsets({
                      deadlineAt: nextEnd,
                      now: workspace.meta.now,
                      reminderOffsets: values.reminderOffsets,
                  })
                : [];

        return {
            changeType,
            skippedReminderOffsets,
        };
    }, [
        values.reminderOffsets,
        values.submissionEndsAt,
        values.submissionStartsAt,
        workspace,
    ]);

    if (!workspace) {
        return <DeadlinesWorkspaceSkeleton />;
    }

    async function handleSubmit(data: SubmissionDeadlineFormData): Promise<void> {
        setIsSubmitting(true);
        try {
            const result = await saveDeadline({
                confirmTightening: data.confirmTightening,
                extensionReason: data.extensionReason,
                reminderOffsets: data.reminderOffsets,
                selectedFiscalYear: data.selectedFiscalYear,
                submissionEndsAtInput: data.submissionEndsAt,
                submissionStartsAtInput: data.submissionStartsAt,
            });
            const warnings: string[] = [];
            if (result.failedReminderQueueCount > 0) {
                warnings.push(
                    `${result.failedReminderQueueCount} reminder queue request${
                        result.failedReminderQueueCount === 1 ? "" : "s"
                    } failed`,
                );
            }
            if (result.failedReminderCancellationCount > 0) {
                warnings.push(
                    `${result.failedReminderCancellationCount} superseded reminder cancellation${
                        result.failedReminderCancellationCount === 1 ? "" : "s"
                    } could not be confirmed`,
                );
            }
            if (result.failedExtensionEmailCount > 0) {
                warnings.push(
                    `${result.failedExtensionEmailCount} extension email${
                        result.failedExtensionEmailCount === 1 ? "" : "s"
                    } failed to queue`,
                );
            }

            if (warnings.length > 0) {
                toast.warning(`Submission deadline saved with warnings: ${warnings.join("; ")}.`);
            } else if (result.changeType === "extension") {
                toast.success("Deadline extended and notifications queued.");
            } else if (result.changeType === "unchanged") {
                toast.success("Submission deadline is already up to date.");
            } else {
                toast.success("Submission deadline saved.");
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "We could not save the submission deadline right now.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                            <CalendarClock className="h-4 w-4" />
                            Submission deadline management
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            Configure one truthful submission window for every active department in the selected fiscal year.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="rounded-full px-3 py-1.5">
                            FY {workspace.selection.selectedFiscalYear}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1.5">
                            {workspace.current.timeZone}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1.5">
                            {workspace.current.countdownLabel}
                        </Badge>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <MetricCard label="Impacted departments" value={String(workspace.meta.impactedDepartmentCount)} />
                    <MetricCard label="DU recipients" value={String(workspace.meta.recipientCount)} />
                    <MetricCard label="Reminder jobs" value={String(workspace.reminderJobs.scheduledCount)} />
                </div>

                {workspace.current.timeZoneUsesFallback ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                        Tenant timezone is not configured yet. This workspace is using the explicit fallback timezone <strong>{workspace.current.timeZone}</strong>.
                    </div>
                ) : null}

                {workspace.current.announcementTitle && workspace.current.announcementMessage ? (
                    <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                            <Megaphone className="h-4 w-4 text-primary" />
                            {workspace.current.announcementTitle}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {workspace.current.announcementMessage}
                        </p>
                    </div>
                ) : null}
            </div>

            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
                <Form {...form}>
                    <form className="space-y-5" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
                        <FormField
                            control={form.control}
                            name="selectedFiscalYear"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fiscal year</FormLabel>
                                    <FormControl>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            {...field}
                                            onChange={(event) => {
                                                field.onChange(event.target.value);
                                                setSelectedFiscalYear(event.target.value);
                                                props?.onSelectedFiscalYearChange?.(event.target.value);
                                            }}
                                        >
                                            {workspace.selection.options.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="submissionStartsAt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Submission start</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" step="60" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="submissionEndsAt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Submission deadline</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" step="60" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="reminderOffsets"
                            render={() => (
                                <FormItem>
                                    <FormLabel>Reminder offsets</FormLabel>
                                    <div className="grid gap-3 md:grid-cols-3">
                                        {workspace.meta.reminderOptionDays.map((offset) => (
                                            <FormField
                                                key={offset}
                                                control={form.control}
                                                name="reminderOffsets"
                                                render={({ field }) => {
                                                    const checked = field.value.includes(offset);
                                                    return (
                                                        <FormItem className="flex flex-row items-start gap-3 rounded-2xl border border-border/70 px-4 py-3">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={checked}
                                                                    onCheckedChange={(nextChecked) => {
                                                                        field.onChange(
                                                                            nextChecked
                                                                                ? [...field.value, offset]
                                                                                : field.value.filter((value) => value !== offset),
                                                                        );
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1">
                                                                <FormLabel>{offset} day{offset === 1 ? "" : "s"} before</FormLabel>
                                                                <p className="text-sm text-muted-foreground">
                                                                    Queue a server-owned reminder email for this offset.
                                                                </p>
                                                            </div>
                                                        </FormItem>
                                                    );
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                Save preview
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <PreviewLine label="Fiscal year" value={values.selectedFiscalYear} />
                                <PreviewLine label="Timezone" value={workspace.current.timeZone} />
                                <PreviewLine label="Departments" value={String(workspace.meta.impactedDepartmentCount)} />
                                <PreviewLine label="Reminder recipients" value={String(workspace.meta.recipientCount)} />
                            </div>
                            {preview?.skippedReminderOffsets.length ? (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                                    Skipping elapsed reminder offsets: {preview.skippedReminderOffsets.join(", ")} day(s) before deadline.
                                </div>
                            ) : null}
                            {preview?.changeType === "extension" ? (
                                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                                    This save extends the current deadline. DU communication will be queued immediately after the save succeeds.
                                </div>
                            ) : null}
                            {preview?.changeType === "tightened" ? (
                                <div className="mt-4 space-y-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-900">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <p>
                                            This save would shorten or otherwise tighten the current shared window. Confirm the guarded save path before continuing.
                                        </p>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="confirmTightening"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-start gap-3">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1">
                                                    <FormLabel>Confirm this tightened deadline change</FormLabel>
                                                    <FormMessage />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {preview?.changeType === "extension" ? (
                            <FormField
                                control={form.control}
                                name="extensionReason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Extension note</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Optional context for the audit trail and operator history."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}

                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="submit"
                                className="rounded-xl"
                                disabled={isSubmitting || workspace.meta.activeDepartmentCount === 0}
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save shared deadline
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-foreground">{value}</div>
        </div>
    );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-border/70 bg-background px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm text-foreground">{value || "Not set"}</div>
        </div>
    );
}

function DeadlinesWorkspaceSkeleton(): JSX.Element {
    return (
        <div className="space-y-4">
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-[34rem] rounded-3xl" />
        </div>
    );
}
