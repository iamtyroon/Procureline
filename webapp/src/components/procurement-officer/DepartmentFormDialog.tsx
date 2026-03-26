"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import {
    buildDepartmentOverAllocationWarning,
} from "@/lib/procurement-officer/departments";
import {
    departmentFormSchema,
    type DepartmentFormData,
} from "@/lib/validators/department";

interface DepartmentFormInput {
    budgetAllocation: number;
    code: string;
    name: string;
}

export interface DepartmentFormDialogDepartment {
    budgetAllocation: number | null;
    code: string;
    id: string;
    name: string;
    planningImpactWarning: string | null;
}

interface DepartmentFormDialogProps {
    activeDepartments: ReadonlyArray<{
        budgetAllocation: number | null;
        id: string;
    }>;
    budgetCeiling: number | null;
    department?: DepartmentFormDialogDepartment | null;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: DepartmentFormData) => Promise<void>;
    open: boolean;
}

export function DepartmentFormDialog({
    activeDepartments,
    budgetCeiling,
    department,
    isSubmitting,
    onOpenChange,
    onSubmit,
    open,
}: DepartmentFormDialogProps): JSX.Element {
    const form = useForm<DepartmentFormInput, unknown, DepartmentFormData>({
        resolver: zodResolver(departmentFormSchema),
        defaultValues: {
            budgetAllocation: department?.budgetAllocation ?? Number.NaN,
            code: department?.code ?? "",
            name: department?.name ?? "",
        },
    });

    useEffect(() => {
        if (!open) {
            return;
        }

        form.reset({
            budgetAllocation: department?.budgetAllocation ?? Number.NaN,
            code: department?.code ?? "",
            name: department?.name ?? "",
        });
    }, [department, form, open]);
    const draftBudgetAllocation = form.watch("budgetAllocation");
    const overAllocationWarning = buildDepartmentOverAllocationWarning({
        budgetCeiling,
        currentBudgetAllocation: draftBudgetAllocation,
        currentDepartmentId: department?.id ?? null,
        departments: activeDepartments,
    });

    const title = department ? `Edit ${department.name}` : "Create Department";
    const description = department
        ? "Update the department's live structure, budget, and ownership details."
        : "Add a department to anchor DU ownership, budgets, and procurement setup.";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {department?.planningImpactWarning ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                        <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Planning activity detected
                        </div>
                        <p className="mt-1 leading-6">{department.planningImpactWarning}</p>
                    </div>
                ) : null}

                {overAllocationWarning ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                        <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Budget warning
                        </div>
                        <p className="mt-1 leading-6">{overAllocationWarning.message}</p>
                    </div>
                ) : null}

                <Form {...form}>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            void form.handleSubmit(onSubmit)(event);
                        }}
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Human Resources" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department code</FormLabel>
                                    <FormControl>
                                        <Input
                                            autoCapitalize="characters"
                                            placeholder="HR01"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="budgetAllocation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Budget allocation</FormLabel>
                                    <FormControl>
                                        <Input
                                            min="0"
                                            placeholder="2500000"
                                            step="0.01"
                                            type="number"
                                            value={Number.isFinite(field.value) ? String(field.value) : ""}
                                            onChange={(event) => {
                                                field.onChange(
                                                    event.target.value.length === 0
                                                        ? Number.NaN
                                                        : Number(event.target.value),
                                                );
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting
                                    ? department
                                        ? "Saving..."
                                        : "Creating..."
                                    : department
                                      ? "Save changes"
                                      : "Create department"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
