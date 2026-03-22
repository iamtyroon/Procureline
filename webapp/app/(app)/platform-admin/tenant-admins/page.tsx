import { PlatformAdminRoutePlaceholder } from "@/src/components/platform-admin/PlatformAdminRoutePlaceholder";

export default function PlatformAdminTenantAdminsPage() {
    return (
        <PlatformAdminRoutePlaceholder
            eyebrow="Reserved for Story 2.8"
            title="Tenant Admins"
            description="Cross-tenant user management is staged here on purpose so the sidebar contract is already stable for the later administration stories."
        />
    );
}
