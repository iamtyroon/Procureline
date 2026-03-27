import type { Metadata } from "next";
import {
    buildPublicEntrySelectionHref,
    getTrimmedSearchParam,
} from "@/lib/auth/public-entry";
import { readSignedDepartmentUserRequestContext } from "@/lib/auth/department-user-request-context";
import { PublicAccessGate } from "@/src/components/auth/PublicAccessGate";
import { DepartmentUserAccessForm } from "@/src/components/auth/DepartmentUserAccessForm";

export const metadata: Metadata = {
    title: "Department User Access - Procureline",
    description:
        "Sign in to Procureline with your department access code and email verification.",
};

interface DepartmentUserAccessPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DepartmentUserAccessPage({
    searchParams,
}: DepartmentUserAccessPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;
    const signedRequestContext = await readSignedDepartmentUserRequestContext();
    const backHref = buildPublicEntrySelectionHref(
        "department_user",
        resolvedSearchParams,
        "#department-access-next-steps",
        "/access",
    );
    const accessCode = getTrimmedSearchParam(resolvedSearchParams.accessCode);

    return (
        <PublicAccessGate>
            <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
                <div className="w-full max-w-md">
                    <DepartmentUserAccessForm
                        backHref={backHref}
                        initialAccessCode={accessCode}
                        signedRequestContext={signedRequestContext}
                    />
                </div>
            </div>
        </PublicAccessGate>
    );
}
