import { PlatformAdminTenantManagementView } from "@/src/components/platform-admin/PlatformAdminTenantManagementView";

export default function PlatformAdminTenantManagementPage({
    params,
}: {
    params: { tenantId: string };
}) {
    return <PlatformAdminTenantManagementView tenantId={params.tenantId} />;
}
