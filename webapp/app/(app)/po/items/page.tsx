import { redirect } from "next/navigation";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export default function ProcurementOfficerItemsPage() {
    redirect(resolveProcurementOfficerWorkspaceNavigation("/po/items").href);
}
