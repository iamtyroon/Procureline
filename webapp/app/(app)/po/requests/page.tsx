import { redirect } from "next/navigation";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export default function ProcurementOfficerRequestsPage() {
    redirect(resolveProcurementOfficerWorkspaceNavigation("/po/requests").href);
}
