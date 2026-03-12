import type { Metadata } from "next";
import {
    buildPublicEntrySelectionHref,
    getTrimmedSearchParam,
} from "@/lib/auth/public-entry";
import { PublicAccessGate } from "@/src/components/auth/PublicAccessGate";
import { RoleAccessComingSoon } from "@/src/components/auth/RoleAccessComingSoon";

export const metadata: Metadata = {
    title: "Department User Access - Procureline",
    description:
        "Role-specific Department User sign-in placeholder for the future access-code login flow.",
};

interface DepartmentUserAccessPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DepartmentUserAccessPage({
    searchParams,
}: DepartmentUserAccessPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;
    const backHref = buildPublicEntrySelectionHref(
        "department_user",
        resolvedSearchParams,
        "#department-access-next-steps",
        "/access",
    );
    const accessCode = getTrimmedSearchParam(resolvedSearchParams.accessCode);

    return (
        <PublicAccessGate>
            <RoleAccessComingSoon
                backHref={backHref}
                details={
                    accessCode
                        ? `Department access code preserved: ${accessCode}. Keep this code handy because the dedicated Department User access-code form will live on this page.`
                        : "Department Users sign in with a department-scoped access code issued by their Procurement Officer. This page is reserved for that role-specific access flow."
                }
                hint="The future Department User form will be added here instead of sending users through the generic shared login."
                title="Department User Sign In"
            />
        </PublicAccessGate>
    );
}
