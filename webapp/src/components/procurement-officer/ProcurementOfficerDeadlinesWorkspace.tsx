"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { CalendarClock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { DateValue } from "react-aria-components";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import {
    classifySubmissionDeadlineChange,
    formatDeadlineDateTime,
    formatTimeZoneInputValue,
    getFiscalYearForTimestampInTimeZone,
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
        fiscalYearStartMonth: number | undefined;
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

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const START_OF_DAY = "00:00";
const END_OF_DAY = "23:59";

function getDefaultFutureWindow(timeZone: string): {
    submissionEndsAtInput: string;
    submissionStartsAtInput: string;
} {
    const now = Date.now();
    const nextHour = Math.ceil(now / HOUR_MS) * HOUR_MS;
    return {
        submissionEndsAtInput: formatTimeZoneInputValue(nextHour + 14 * DAY_MS, timeZone),
        submissionStartsAtInput: formatTimeZoneInputValue(nextHour, timeZone),
    };
}

function getDatePart(value: string): string {
    return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function composeDateTimeInput(date: DateValue | null, time: string): string {
    if (!date) {
        return "";
    }

    return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}T${time}`;
}

function parseDateValue(value: string): DateValue | null {
    const datePart = getDatePart(value);
    if (!datePart) {
        return null;
    }

    try {
        return parseDate(datePart);
    } catch {
        return null;
    }
}

function formatDateValueLabel(value: DateValue | null): string {
    if (!value) {
        return "Not set";
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value.year, value.month - 1, value.day));
}

function getChangeLabel(
    changeType: ReturnType<typeof classifySubmissionDeadlineChange>,
): string {
    switch (changeType) {
        case "extension":
            return "Updating shared window";
        case "initial_setup":
            return "Creating shared deadline";
        case "tightened":
            return "Shortening current window";
        case "unchanged":
            return "No date changes";
        case "edited":
        default:
            return "Updating shared window";
    }
}

function getSaveLabel(
    changeType: ReturnType<typeof classifySubmissionDeadlineChange>,
): string {
    switch (changeType) {
        case "extension":
            return "Save correction";
        case "initial_setup":
            return "Create deadline";
        case "tightened":
            return "Update deadline";
        case "unchanged":
            return "Saved";
        case "edited":
        default:
            return "Save deadline";
    }
}

export function ProcurementOfficerDeadlinesWorkspace(props?: {
    onSelectedFiscalYearChange?: (fiscalYear: string) => void;
    selectedFiscalYear?: string;
}): JSX.Element {
    const onSelectedFiscalYearChange = props?.onSelectedFiscalYearChange;
    const selectedFiscalYearProp = props?.selectedFiscalYear;
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string | undefined>(
        selectedFiscalYearProp,
    );
    const workspace = useQuery(
        api.functions.deadlines.getDeadlinesWorkspace,
        selectedFiscalYear ? { selectedFiscalYear } : {},
    ) as DeadlinesWorkspaceData | undefined;
    const saveDeadline = useAction(api.functions.deadlines.upsertSubmissionDeadline);
    const [isEditing, setIsEditing] = useState(false);
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
        if (!selectedFiscalYearProp) {
            return;
        }

        setSelectedFiscalYear(selectedFiscalYearProp);
    }, [selectedFiscalYearProp]);

    useEffect(() => {
        if (!workspace) {
            return;
        }

        const nextFiscalYear = workspace.selection.selectedFiscalYear;
        const currentWindowIsExpired =
            typeof workspace.current.submissionEndsAt === "number" &&
            workspace.current.submissionEndsAt <= workspace.meta.now;
        const futureWindow = currentWindowIsExpired
            ? getDefaultFutureWindow(workspace.current.timeZone)
            : null;

        setSelectedFiscalYear((current) =>
            current === nextFiscalYear ? current : nextFiscalYear,
        );
        if (selectedFiscalYearProp !== nextFiscalYear) {
            onSelectedFiscalYearChange?.(nextFiscalYear);
        }

        if (isEditing && form.getValues("selectedFiscalYear") === nextFiscalYear) {
            return;
        }

        setIsEditing(false);
        form.reset({
            confirmTightening: false,
            extensionReason: "",
            reminderOffsets: [],
            selectedFiscalYear: nextFiscalYear,
            submissionEndsAt:
                futureWindow?.submissionEndsAtInput ?? workspace.current.submissionEndsAtInput,
            submissionStartsAt:
                futureWindow?.submissionStartsAtInput ??
                workspace.current.submissionStartsAtInput,
        });
    }, [form, isEditing, onSelectedFiscalYearChange, selectedFiscalYearProp, workspace]);

    if (!workspace) {
        return <DeadlinesWorkspaceSkeleton />;
    }
    const watchedSubmissionStart = form.watch("submissionStartsAt");
    const watchedSubmissionEnd = form.watch("submissionEndsAt");
    // Whether the submission window has already opened (start is in the past).
    // In this case the PO can only adjust the end date, not move the start.
    const submissionWindowStarted =
        typeof workspace.current.submissionStartsAt === "number" &&
        workspace.current.submissionStartsAt <= workspace.meta.now;
    // Use tomorrow as the earliest selectable date so that the composed
    // "YYYY-MM-DDT00:00" timestamp (midnight) is never <= now.
    const minimumDate = today(getLocalTimeZone()).add({ days: 1 });
    const startDate = parseDateValue(watchedSubmissionStart);
    const endDate = parseDateValue(watchedSubmissionEnd);
    const preview = (() => {
        const nextStart = parseTimeZoneInputValue(
            watchedSubmissionStart,
            workspace.current.timeZone,
        );
        const nextEnd = parseTimeZoneInputValue(
            watchedSubmissionEnd,
            workspace.current.timeZone,
        );
        const hasCompleteRange =
            typeof nextStart === "number" && typeof nextEnd === "number";
        const isInvalidRange = hasCompleteRange ? nextEnd <= nextStart : true;
        const changeType =
            hasCompleteRange && !isInvalidRange
                ? classifySubmissionDeadlineChange({
                      currentEndsAt: workspace.current.submissionEndsAt,
                      currentStartsAt: workspace.current.submissionStartsAt,
                      nextEndsAt: nextEnd,
                      nextStartsAt: nextStart,
                  })
                : "unchanged";

        return {
            changeType,
            isInvalidRange,
            nextEnd,
            nextStart,
        };
    })();
    const saveDisabled =
        isSubmitting ||
        workspace.meta.activeDepartmentCount === 0 ||
        !isEditing ||
        preview.isInvalidRange ||
        preview.changeType === "unchanged";

    function resetFormToWorkspace(currentWorkspace: DeadlinesWorkspaceData): void {
        const currentWindowIsExpired =
            typeof currentWorkspace.current.submissionEndsAt === "number" &&
            currentWorkspace.current.submissionEndsAt <= currentWorkspace.meta.now;
        const futureWindow = currentWindowIsExpired
            ? getDefaultFutureWindow(currentWorkspace.current.timeZone)
            : null;

        form.reset({
            confirmTightening: false,
            extensionReason: "",
            reminderOffsets: [],
            selectedFiscalYear: currentWorkspace.selection.selectedFiscalYear,
            submissionEndsAt:
                futureWindow?.submissionEndsAtInput ??
                currentWorkspace.current.submissionEndsAtInput,
            submissionStartsAt:
                futureWindow?.submissionStartsAtInput ??
                currentWorkspace.current.submissionStartsAtInput,
        });
    }

    async function handleSubmit(data: SubmissionDeadlineFormData): Promise<void> {
        setIsSubmitting(true);
        try {
            const result = await saveDeadline({
                confirmTightening: true,
                extensionReason: "",
                reminderOffsets: [],
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
            } else if (result.changeType === "unchanged") {
                toast.success("Submission deadline is already up to date.");
            } else {
                toast.success("Shared submission window saved.");
            }
            setIsEditing(false);
        } catch (error) {
            // ConvexError carries structured data in `error.data`.
            // Route field-specific errors to the form so they appear inline
            // under the relevant input; fall back to a toast for everything else.
            const convexData =
                error instanceof ConvexError
                    ? (error.data as {
                          code?: string;
                          field?: string;
                          message?: string;
                      })
                    : null;

            if (convexData?.message && convexData.field) {
                const fieldMap: Partial<
                    Record<string, keyof SubmissionDeadlineFormData>
                > = {
                    confirmTightening: "confirmTightening",
                    selectedFiscalYear: "selectedFiscalYear",
                    submissionEndsAt: "submissionEndsAt",
                    submissionStartsAt: "submissionStartsAt",
                };
                const formField = fieldMap[convexData.field];
                if (formField) {
                    form.setError(formField, {
                        message: convexData.message,
                        type: "server",
                    });
                    // Also surface in a toast so it's hard to miss
                    toast.error(convexData.message);
                } else {
                    toast.error(convexData.message);
                }
            } else if (convexData?.message) {
                toast.error(convexData.message);
            } else {
                toast.error(
                    error instanceof Error && error.message
                        ? error.message
                        : "We could not save the submission deadline right now.",
                );
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form className="space-y-3" onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}>
                <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 lg:grid-cols-[minmax(13rem,0.85fr)_minmax(0,1.6fr)_auto] lg:items-center">
                    <div className="flex items-center justify-between gap-3 lg:block">
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {workspace.meta.tenantName}
                            </div>
                            <div className="text-sm font-medium text-foreground">
                                FY {workspace.selection.selectedFiscalYear}
                            </div>
                        </div>
                        <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
                            {workspace.meta.activeDepartmentCount} department
                            {workspace.meta.activeDepartmentCount === 1 ? "" : "s"}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-1.5 text-sm">
                        <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                            <div className="font-medium text-foreground">
                                {getChangeLabel(preview.changeType)}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                                {typeof preview.nextStart === "number" &&
                                typeof preview.nextEnd === "number"
                                    ? `${formatDeadlineDateTime(
                                          preview.nextStart,
                                          workspace.current.timeZone,
                                      )} to ${formatDeadlineDateTime(
                                          preview.nextEnd,
                                          workspace.current.timeZone,
                                      )}`
                                    : "Choose a start and end date."}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant={isEditing ? "outline" : "default"}
                            size="sm"
                            onClick={() => {
                                if (isEditing) {
                                    resetFormToWorkspace(workspace);
                                    setIsEditing(false);
                                    return;
                                }

                                setIsEditing(true);
                            }}
                            disabled={isSubmitting}
                        >
                            {isEditing ? "Cancel edit" : "Edit deadline"}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(11rem,0.75fr)_minmax(13rem,1fr)_minmax(13rem,1fr)_auto] lg:items-end">
                    <FormField
                        control={form.control}
                        name="selectedFiscalYear"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fiscal year</FormLabel>
                                <FormControl>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={!isEditing}
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

                    <FormField
                        control={form.control}
                        name="submissionStartsAt"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Start date</FormLabel>
                                <FormControl>
                                    <DatePicker
                                        aria-label="Submission start date"
                                        isDisabled={!isEditing || submissionWindowStarted}
                                        minValue={minimumDate}
                                        value={parseDateValue(field.value)}
                                        onChange={(date) => {
                                            const currentEndDate = parseDateValue(
                                                form.getValues("submissionEndsAt"),
                                            );
                                            field.onChange(
                                                composeDateTimeInput(date, START_OF_DAY),
                                            );
                                            if (
                                                date &&
                                                currentEndDate &&
                                                currentEndDate.compare(date) < 0
                                            ) {
                                                form.setValue(
                                                    "submissionEndsAt",
                                                    composeDateTimeInput(date, END_OF_DAY),
                                                    {
                                                        shouldDirty: true,
                                                        shouldValidate: true,
                                                    },
                                                );
                                            }
                                        }}
                                    />
                                </FormControl>
                                <FormDescription className="whitespace-nowrap text-xs">
                                    {submissionWindowStarted
                                        ? "Window already opened"
                                        : `Opens ${formatDateValueLabel(startDate)}`}
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="submissionEndsAt"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>End date</FormLabel>
                                <FormControl>
                                    <DatePicker
                                        aria-label="Submission end date"
                                        isDisabled={!isEditing}
                                        minValue={startDate ?? minimumDate}
                                        value={endDate}
                                        onChange={(date) => {
                                            const inputStr = composeDateTimeInput(date, END_OF_DAY);
                                            field.onChange(inputStr);
                                            // Auto-switch fiscal year when the chosen end date
                                            // falls in a different FY than the current selection.
                                            // Use parseTimeZoneInputValue so the timestamp respects
                                            // the tenant's timezone (not the browser's local clock).
                                            if (date && workspace.meta.fiscalYearStartMonth != null) {
                                                const ts = parseTimeZoneInputValue(
                                                    inputStr,
                                                    workspace.meta.timeZone,
                                                );
                                                if (ts !== null) {
                                                    const derivedFY = getFiscalYearForTimestampInTimeZone({
                                                        fiscalYearStartMonth: workspace.meta.fiscalYearStartMonth,
                                                        timeZone: workspace.meta.timeZone,
                                                        timestamp: ts,
                                                    }).key;
                                                    const currentFY = form.getValues("selectedFiscalYear");
                                                    if (
                                                        derivedFY !== currentFY &&
                                                        workspace.selection.options.includes(derivedFY)
                                                    ) {
                                                        form.setValue("selectedFiscalYear", derivedFY, {
                                                            shouldDirty: true,
                                                        });
                                                        form.clearErrors("selectedFiscalYear");
                                                        setSelectedFiscalYear(derivedFY);
                                                        props?.onSelectedFiscalYearChange?.(derivedFY);
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </FormControl>
                                <FormDescription className="whitespace-nowrap text-xs">
                                    Closes {formatDateValueLabel(endDate)}
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex items-end justify-end gap-2">
                        {isEditing ? (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isSubmitting}
                                onClick={() => {
                                    resetFormToWorkspace(workspace);
                                    setIsEditing(false);
                                }}
                            >
                                Cancel
                            </Button>
                        ) : null}
                        <Button
                            type="submit"
                            disabled={saveDisabled}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {getSaveLabel(preview.changeType)}
                        </Button>
                    </div>
                </div>

                {isEditing && preview.isInvalidRange ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Choose an end date on or after the start date.
                    </div>
                ) : null}

            </form>
        </Form>
    );
}

function DeadlinesWorkspaceSkeleton(): JSX.Element {
    return <Skeleton className="h-64 rounded-2xl" />;
}
