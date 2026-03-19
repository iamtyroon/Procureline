import { redirect } from "next/navigation";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export default function ProcurementOfficerCategoryItemsPage() {
    redirect(resolveProcurementOfficerWorkspaceNavigation("/po/categories/items").href);
}
