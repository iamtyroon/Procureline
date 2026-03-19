import { redirect } from "next/navigation";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export default function ProcurementOfficerAccessCodesPage() {
    redirect(resolveProcurementOfficerWorkspaceNavigation("/po/access-codes").href);
}
