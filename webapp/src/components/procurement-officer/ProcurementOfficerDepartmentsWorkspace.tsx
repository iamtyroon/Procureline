"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
    AlertTriangle,
    Building2,
    KeyRound,
    Pencil,
    Plus,
    Trash2,
    Users2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
    buildDepartmentTierLimitModalContent,
    DEPARTMENT_NOT_FOUND_MESSAGE,
    formatDepartmentBudget,
    getDepartmentCrudErrorMessage,
    getDepartmentCrudRecoveryHref,
    isDepartmentCrudAuthorizationError,
    isDepartmentTierLimitMessage,
} from "@/lib/procurement-officer/departments";
import type { DepartmentFormData } from "@/lib/validators/department";
import { cn } from "@/lib/utils";
import {
    DeleteDepartmentDialog,
    type DeleteDepartmentDialogDepartment,
} from "./DeleteDepartmentDialog";
import {
    DepartmentFormDialog,
    type DepartmentFormDialogDepartment,
} from "./DepartmentFormDialog";

interface DepartmentWorkspaceRow {
    accessCodeStateLabel: string;
    activeDepartmentUserEmails: string[];
    budgetAllocation: number | null;
    canDelete: boolean;
    code: string;
    deleteBlockerMessages: string[];
    departmentUserCount: number;
    departmentUserStateLabel: string;
    hasActiveAccessCode: boolean;
    hasPlanningActivity: boolean;
    id: string;
    lastBudgetChangedAt: number | null;
    lastUpdatedAt: number;
    name: string;
    planningImpactWarning: string | null;
    planningStateLabel: string;
    planStatuses: string[];
    submissionWindowState: "configured" | "setup_required";
}

interface DepartmentWorkspaceData {
    meta: {
        activeDepartmentCount: number;
        budgetCeiling: number | null;
        limit: {
            atLimit: boolean;
            limit: number | null;
            remainingSlots: number | null;
            tier: "enterprise" | "free" | "professional" | "starter";
            tierLabel: string;
            upgradeHref: string;
        };
        overAllocationWarning: null | {
            amount: number;
            message: string;
        };
    };
    rows: DepartmentWorkspaceRow[];
}

export function ProcurementOfficerDepartmentsWorkspace(): JSX.Element {
    const router = useRouter();
    const workspace = useQuery(
        api.functions.departments.getDepartmentsWorkspace,
        {},
    ) as DepartmentWorkspaceData | undefined;
    const createDepartment = useMutation(api.functions.departments.createDepartment);
    const updateDepartment = useMutation(api.functions.departments.updateDepartment);
    const deleteDepartment = useMutation(api.functions.departments.deleteDepartment);
    const [formDepartment, setFormDepartment] =
        useState<DepartmentFormDialogDepartment | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteDepartmentTarget, setDeleteDepartmentTarget] =
        useState<DeleteDepartmentDialogDepartment | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTierLimitOpen, setIsTierLimitOpen] = useState(false);

    if (!workspace) {
        return <DepartmentsWorkspaceSkeleton />;
    }
    const tierLimitContent = buildDepartmentTierLimitModalContent(
        workspace.meta.limit,
    );

    function redirectToProtectedAccessHandling(): void {
        setDeleteDepartmentTarget(null);
        setFormDepartment(null);
        setIsDeleteOpen(false);
        setIsFormOpen(false);
        setIsTierLimitOpen(false);
        router.replace(getDepartmentCrudRecoveryHref());
    }

    async function handleSubmit(values: DepartmentFormData): Promise<void> {
        setIsSubmitting(true);

        try {
            if (formDepartment) {
                await updateDepartment({
                    budgetAllocation: values.budgetAllocation,
                    code: values.code,
                    departmentId: formDepartment.id as any,
                    name: values.name,
                });
                toast.success("Department updated.");
            } else {
                await createDepartment({
                    budgetAllocation: values.budgetAllocation,
                    code: values.code,
                    name: values.name,
                });
                toast.success("Department created.");
            }

            setIsFormOpen(false);
            setFormDepartment(null);
        } catch (error) {
            if (isDepartmentCrudAuthorizationError(error)) {
                toast.error("Your access changed. Redirecting to refresh your workspace.");
                redirectToProtectedAccessHandling();
                return;
            }
            const message = getDepartmentCrudErrorMessage(error);
            if (message === DEPARTMENT_NOT_FOUND_MESSAGE) {
                setIsFormOpen(false);
                setFormDepartment(null);
            }
            if (isDepartmentTierLimitMessage(message)) {
                setIsTierLimitOpen(true);
            }
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(): Promise<void> {
        if (!deleteDepartmentTarget) {
            return;
        }

        setIsDeleting(true);

        try {
            await deleteDepartment({
                departmentId: deleteDepartmentTarget.id as any,
            });
            toast.success("Department deleted.");
            setDeleteDepartmentTarget(null);
            setIsDeleteOpen(false);
        } catch (error) {
            if (isDepartmentCrudAuthorizationError(error)) {
                toast.error("Your access changed. Redirecting to refresh your workspace.");
                redirectToProtectedAccessHandling();
                return;
            }
            const message = getDepartmentCrudErrorMessage(error);
            if (message === DEPARTMENT_NOT_FOUND_MESSAGE) {
                setDeleteDepartmentTarget(null);
                setIsDeleteOpen(false);
            }
            toast.error(message);
        } finally {
            setIsDeleting(false);
        }
    }

    function openCreateDialog(): void {
        if (!workspace) {
            return;
        }

        if (workspace.meta.limit.atLimit) {
            setIsTierLimitOpen(true);
            return;
        }

        setFormDepartment(null);
        setIsFormOpen(true);
    }

    function openEditDialog(row: DepartmentWorkspaceRow): void {
        setFormDepartment({
            budgetAllocation: row.budgetAllocation,
            code: row.code,
            id: row.id,
            name: row.name,
            planningImpactWarning: row.planningImpactWarning,
        });
        setIsFormOpen(true);
    }

    function openDeleteDialog(row: DepartmentWorkspaceRow): void {
        setDeleteDepartmentTarget({
            activeDepartmentUserEmails: row.activeDepartmentUserEmails,
            canDelete: row.canDelete,
            deleteBlockerMessages: row.deleteBlockerMessages,
            id: row.id,
            name: row.name,
        });
        setIsDeleteOpen(true);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                            <Building2 className="h-4 w-4" />
                            Department management
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                            Quick view of department count, plan limits, and budget coverage.
                        </p>
                    </div>
                    <Button className="rounded-xl lg:shrink-0" onClick={openCreateDialog} type="button">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Department
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                    <SummaryPill
                        label="Active departments"
                        value={String(workspace.meta.activeDepartmentCount)}
                    />
                    <SummaryPill
                        label="Tier limit"
                        value={
                            workspace.meta.limit.limit === null
                                ? "Unlimited"
                                : String(workspace.meta.limit.limit)
                        }
                    />
                    <SummaryPill
                        label="Remaining slots"
                        value={
                            workspace.meta.limit.remainingSlots === null
                                ? "Unlimited"
                                : String(workspace.meta.limit.remainingSlots)
                        }
                    />
                    <SummaryPill
                        label="Budget ceiling"
                        value={
                            typeof workspace.meta.budgetCeiling === "number"
                                ? formatDepartmentBudget(workspace.meta.budgetCeiling)
                                : "Not set"
                        }
                    />
                </div>

                {workspace.meta.overAllocationWarning ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-900">
                        <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Budget warning
                        </div>
                        <p className="mt-1 leading-5">
                            {workspace.meta.overAllocationWarning.message}
                        </p>
                    </div>
                ) : null}
            </div>

            {workspace.rows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                    <div className="text-lg font-semibold text-foreground">No departments yet</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Start with your first department so DU ownership, access codes, and
                        planning status have a real source of truth.
                    </p>
                    <Button className="mt-4 rounded-xl" onClick={openCreateDialog} type="button">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Department
                    </Button>
                </div>
            ) : (
                <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] text-sm">
                            <thead className="bg-muted/20 text-left text-muted-foreground">
                                <tr>
                                    <th className="px-5 py-4 font-medium">Department</th>
                                    <th className="px-5 py-4 font-medium">Budget</th>
                                    <th className="px-5 py-4 font-medium">DU assignment</th>
                                    <th className="px-5 py-4 font-medium">Access codes</th>
                                    <th className="px-5 py-4 font-medium">Planning state</th>
                                    <th className="px-5 py-4 font-medium">Last updated</th>
                                    <th className="px-5 py-4 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workspace.rows.map((row) => (
                                    <tr key={row.id} className="border-t border-border/60 align-top">
                                        <td className="px-5 py-4">
                                            <div className="font-semibold text-foreground">{row.name}</div>
                                            <div className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                                {row.code}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-foreground">
                                            {row.budgetAllocation === null
                                                ? "Not set"
                                                : formatDepartmentBudget(row.budgetAllocation)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <StateBadge
                                                icon={<Users2 className="h-3.5 w-3.5" />}
                                                label={row.departmentUserStateLabel}
                                                tone={
                                                    row.departmentUserCount > 0
                                                        ? "positive"
                                                        : "warning"
                                                }
                                            />
                                            <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                                {row.departmentUserCount > 0
                                                    ? `${row.departmentUserCount} active DU${row.departmentUserCount === 1 ? "" : "s"} assigned`
                                                    : "No active Departmental User assigned"}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <StateBadge
                                                icon={<KeyRound className="h-3.5 w-3.5" />}
                                                label={row.accessCodeStateLabel}
                                                tone={row.hasActiveAccessCode ? "positive" : "warning"}
                                            />
                                        </td>
                                        <td className="px-5 py-4">
                                            <StateBadge
                                                label={row.planningStateLabel}
                                                tone={row.hasPlanningActivity ? "info" : "neutral"}
                                            />
                                            <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                                {row.submissionWindowState === "configured"
                                                    ? "Submission window configured"
                                                    : "Submission window still needs setup"}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-muted-foreground">
                                            {formatWorkspaceTimestamp(row.lastUpdatedAt)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="rounded-full"
                                                    onClick={() => openEditDialog(row)}
                                                    type="button"
                                                >
                                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="rounded-full"
                                                    onClick={() => openDeleteDialog(row)}
                                                    type="button"
                                                >
                                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <DepartmentFormDialog
                activeDepartments={workspace.rows.map((row) => ({
                    budgetAllocation: row.budgetAllocation,
                    id: row.id,
                }))}
                budgetCeiling={workspace.meta.budgetCeiling}
                department={formDepartment}
                isSubmitting={isSubmitting}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setFormDepartment(null);
                    }
                }}
                onSubmit={handleSubmit}
                open={isFormOpen}
            />

            <DeleteDepartmentDialog
                department={deleteDepartmentTarget}
                isDeleting={isDeleting}
                onConfirm={handleDelete}
                onOpenChange={(open) => {
                    setIsDeleteOpen(open);
                    if (!open) {
                        setDeleteDepartmentTarget(null);
                    }
                }}
                open={isDeleteOpen}
            />

            <Dialog open={isTierLimitOpen} onOpenChange={setIsTierLimitOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{tierLimitContent.title}</DialogTitle>
                        <DialogDescription>{tierLimitContent.guidance}</DialogDescription>
                    </DialogHeader>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
                        {tierLimitContent.body}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsTierLimitOpen(false)}
                        >
                            Close
                        </Button>
                        <Button asChild type="button">
                            <Link href={workspace.meta.limit.upgradeHref}>View Plans</Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="inline-flex min-w-[10.5rem] items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
            </div>
            <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                {value}
            </div>
        </div>
    );
}

function StateBadge({
    icon,
    label,
    tone,
}: {
    icon?: ReactNode;
    label: string;
    tone: "info" | "neutral" | "positive" | "warning";
}) {
    return (
        <Badge
            variant="outline"
            className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold shadow-sm",
                tone === "info" &&
                    "border-sky-300/80 bg-sky-200 text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/80 dark:text-sky-100",
                tone === "neutral" &&
                    "border-slate-300/80 bg-slate-200 text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100",
                tone === "positive" &&
                    "border-emerald-300/80 bg-emerald-200 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/80 dark:text-emerald-100",
                tone === "warning" &&
                    "border-amber-300/80 bg-amber-200 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/80 dark:text-amber-100",
            )}
        >
            {icon ? <span className="mr-1">{icon}</span> : null}
            {label}
        </Badge>
    );
}

function formatWorkspaceTimestamp(timestamp: number): string {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(timestamp));
}

function DepartmentsWorkspaceSkeleton(): JSX.Element {
    return (
        <div className="space-y-4">
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-80 rounded-3xl" />
        </div>
    );
}
