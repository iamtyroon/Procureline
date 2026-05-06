import type { Metadata } from "next";
import { buildPublicEntrySelectionHref } from "@/lib/shared/auth/public-entry";
import { PublicAccessGate } from "@/src/components/auth/PublicAccessGate";
import { ProcurementOfficerAccessForm } from "@/src/components/auth/ProcurementOfficerAccessForm";
import { resolveProcurementOfficerHandoff } from "@/lib/procurement-officer/invitations";

export const metadata: Metadata = {
    title: "Procurement Officer Access - Procureline",
    description:
        "Continue with a Procurement Officer invite link or activation code.",
};

interface ProcurementOfficerAccessPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProcurementOfficerAccessPage({
    searchParams,
}: ProcurementOfficerAccessPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;
    const initialHandoff = resolveProcurementOfficerHandoff(resolvedSearchParams);
    const backHref = buildPublicEntrySelectionHref(
        "procurement_officer",
        resolvedSearchParams,
        "#role-guidance",
        "/access",
    );

    return (
        <PublicAccessGate>
            <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
                <div className="w-full max-w-md">
                    <ProcurementOfficerAccessForm
                        backHref={backHref}
                        initialHandoff={initialHandoff}
                    />
                </div>
            </div>
        </PublicAccessGate>
    );
}
