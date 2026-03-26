"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
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
    FormDescription,
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
    adminEmail?: string;
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
    const generateDepartmentCode = useAction(
        api.functions.departments.generateDepartmentCode,
    );
    const emailDepartmentCode = useAction(
        api.functions.departments.emailDepartmentCode,
    );
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [isEmailingCode, setIsEmailingCode] = useState(false);
    const form = useForm<DepartmentFormInput, unknown, DepartmentFormData>({
        resolver: zodResolver(departmentFormSchema),
        defaultValues: {
            adminEmail: "",
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
            adminEmail: "",
            budgetAllocation: department?.budgetAllocation ?? Number.NaN,
            code: department?.code ?? "",
            name: department?.name ?? "",
        });
        setGeneratedCode(null);
    }, [department, form, open]);
    const draftBudgetAllocation = form.watch("budgetAllocation");
    const draftCode = form.watch("code");
    const draftName = form.watch("name");
    const overAllocationWarning = buildDepartmentOverAllocationWarning({
        budgetCeiling,
        currentBudgetAllocation: draftBudgetAllocation,
        currentDepartmentId: department?.id ?? null,
        departments: activeDepartments,
    });
    const isCreateMode = !department;
    const isGeneratedCodeReady = isCreateMode && generatedCode === draftCode;

    const title = department ? `Edit ${department.name}` : "Create Department";
    const description = department
        ? "Update the department's live structure, budget, and ownership details."
        : "Add a department to anchor DU ownership, budgets, and procurement setup.";

    useEffect(() => {
        if (!isCreateMode) {
            return;
        }

        if (!generatedCode) {
            return;
        }

        if (draftCode !== generatedCode) {
            setGeneratedCode(null);
        }
    }, [draftCode, generatedCode, isCreateMode]);

    async function handleCodeAction(): Promise<void> {
        if (!isCreateMode) {
            return;
        }

        if (isGeneratedCodeReady) {
            const isValid = await form.trigger(["adminEmail", "code"]);
            if (!isValid) {
                return;
            }

            setIsEmailingCode(true);
            try {
                const result = await emailDepartmentCode({
                    code: form.getValues("code"),
                    departmentName: draftName,
                    email: form.getValues("adminEmail") ?? "",
                });
                if (result.deliveryStatus === "sent") {
                    toast.success("Department code emailed.");
                } else {
                    toast.error("Email delivery is unavailable right now.");
                }
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "We could not email that department code right now.";
                toast.error(message);
            } finally {
                setIsEmailingCode(false);
            }

            return;
        }

        setIsGeneratingCode(true);
        try {
            const result = await generateDepartmentCode({
                name: draftName,
            });
            form.setValue("code", result.code, {
                shouldDirty: true,
                shouldValidate: true,
            });
            setGeneratedCode(result.code);
            toast.success("Department code generated.");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "We could not generate a department code right now.";
            toast.error(message);
        } finally {
            setIsGeneratingCode(false);
        }
    }

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

                        {isCreateMode ? (
                            <FormField
                                control={form.control}
                                name="adminEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Admin Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                autoComplete="email"
                                                placeholder="du@institution.ac.ke"
                                                type="email"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Use this address when you want to email the generated
                                            department code directly from the modal.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}

                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department code</FormLabel>
                                    <FormControl>
                                        {isCreateMode ? (
                                            <div className="relative">
                                                <Input
                                                    autoCapitalize="characters"
                                                    className="pr-28"
                                                    placeholder="HR01"
                                                    {...field}
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={
                                                        isGeneratedCodeReady
                                                            ? "secondary"
                                                            : "outline"
                                                    }
                                                    className="absolute right-1 top-1/2 h-7 -translate-y-1/2 rounded-md px-3"
                                                    disabled={
                                                        isSubmitting ||
                                                        isGeneratingCode ||
                                                        isEmailingCode
                                                    }
                                                    onClick={() => {
                                                        void handleCodeAction();
                                                    }}
                                                >
                                                    {isGeneratingCode
                                                        ? "Generating..."
                                                        : isEmailingCode
                                                          ? "Emailing..."
                                                          : isGeneratedCodeReady
                                                            ? "Email"
                                                            : "Generate"}
                                                </Button>
                                            </div>
                                        ) : (
                                            <Input
                                                autoCapitalize="characters"
                                                placeholder="HR01"
                                                {...field}
                                            />
                                        )}
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
