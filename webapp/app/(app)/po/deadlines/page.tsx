import { redirect } from "next/navigation";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export default function ProcurementOfficerDeadlinesPage() {
    redirect(resolveProcurementOfficerWorkspaceNavigation("/po/deadlines").href);
}
