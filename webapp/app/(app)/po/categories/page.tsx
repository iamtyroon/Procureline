import { redirect } from "next/navigation";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export default function ProcurementOfficerCategoriesPage() {
    redirect(resolveProcurementOfficerWorkspaceNavigation("/po/categories").href);
}
