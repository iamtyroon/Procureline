import { TenantAdminRoutePlaceholder } from "@/src/components/tenant-admin/TenantAdminRoutePlaceholder";

export default function TenantAdminReportsPage() {
    return (
        <TenantAdminRoutePlaceholder
            eyebrow="Reserved route"
            title="Reports will plug into this dashboard namespace next"
            description="The reporting experience is intentionally held behind a stable `/tenant-admin/reports` route so later stories can deepen analytics without changing tenant-admin navigation."
        />
    );
}
