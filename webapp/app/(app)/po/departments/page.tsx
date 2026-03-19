import { redirect } from "next/navigation";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export default function ProcurementOfficerDepartmentsPage() {
    redirect(resolveProcurementOfficerWorkspaceNavigation("/po/departments").href);
}
