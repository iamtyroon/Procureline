"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DeleteDepartmentDialogDepartment {
    activeDepartmentUserEmails: string[];
    canDelete: boolean;
    deleteBlockerMessages: string[];
    id: string;
    name: string;
}

interface DeleteDepartmentDialogProps {
    department: DeleteDepartmentDialogDepartment | null;
    isDeleting: boolean;
    onConfirm: () => Promise<void>;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}

export function DeleteDepartmentDialog({
    department,
    isDeleting,
    onConfirm,
    onOpenChange,
    open,
}: DeleteDepartmentDialogProps): JSX.Element {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {department ? `Archive ${department.name}?` : "Archive department?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            <p>
                                This archives the department, keeps it visible as archived, and removes
                                its active Departmental User access.
                            </p>
                            {department && department.deleteBlockerMessages.length > 0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900">
                                    {department.deleteBlockerMessages.map((message) => (
                                        <p key={message}>{message}</p>
                                    ))}
                                    {department.activeDepartmentUserEmails.length > 0 ? (
                                        <p className="mt-2">
                                            Affected DUs:{" "}
                                            {department.activeDepartmentUserEmails.join(", ")}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                            {department?.canDelete &&
                            department.activeDepartmentUserEmails.length > 0 &&
                            department.deleteBlockerMessages.length === 0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900">
                                    <p>
                                        Assigned Departmental Users and active department codes will be
                                        deactivated.
                                    </p>
                                    <p className="mt-2">
                                        Affected DUs:{" "}
                                        {department.activeDepartmentUserEmails.join(", ")}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={!department?.canDelete || isDeleting}
                        onClick={(event) => {
                            event.preventDefault();
                            void onConfirm();
                        }}
                    >
                        {isDeleting ? "Archiving..." : "Archive department"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
