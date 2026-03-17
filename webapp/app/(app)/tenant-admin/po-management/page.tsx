import { TenantAdminRoutePlaceholder } from "@/src/components/tenant-admin/TenantAdminRoutePlaceholder";

export default function TenantAdminPoManagementPage() {
    return (
        <TenantAdminRoutePlaceholder
            eyebrow="Reserved route"
            title="PO management is staged for the next tenant-admin story"
            description="This placeholder keeps the `/tenant-admin/po-management` destination stable while Story 3.3 lands the real Procurement Officer management workflow."
        />
    );
}
