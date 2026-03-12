import type { Metadata } from "next";
import { buildPublicEntrySelectionHref } from "@/lib/auth/public-entry";
import { PublicAccessGate } from "@/src/components/auth/PublicAccessGate";
import { RoleAccessComingSoon } from "@/src/components/auth/RoleAccessComingSoon";

export const metadata: Metadata = {
    title: "Procurement Officer Access - Procureline",
    description:
        "Role-specific Procurement Officer sign-in placeholder for the future invite and activation flow.",
};

interface ProcurementOfficerAccessPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProcurementOfficerAccessPage({
    searchParams,
}: ProcurementOfficerAccessPageProps): Promise<JSX.Element> {
    const resolvedSearchParams = await searchParams;
    const backHref = buildPublicEntrySelectionHref(
        "procurement_officer",
        resolvedSearchParams,
        "#role-guidance",
        "/access",
    );

    return (
        <PublicAccessGate>
            <RoleAccessComingSoon
                backHref={backHref}
                details="Procurement Officers sign in through a role-specific flow that will use the invite link or activation details issued by the Tenant Admin. This page is reserved for that onboarding experience."
                hint="Recognized invite and activation context can be preserved into this route now, and the actual Procurement Officer form can be added here later."
                title="Procurement Officer Sign In"
            />
        </PublicAccessGate>
    );
}
