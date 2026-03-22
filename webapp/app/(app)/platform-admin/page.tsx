import { PlatformAdminSecurityCard } from "@/src/components/auth/PlatformAdminSecurityCard";

export default function PlatformAdminPage() {
    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-600">
                    Platform Admin
                </p>
                <h1 className="text-3xl font-semibold text-foreground">
                    Secure Platform Access
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    Story 2.1 intentionally keeps this surface small: verified admin
                    access, concurrent session visibility, revoke-all controls, backup
                    code status, and the hard deletion block required by the security
                    specification.
                </p>
            </div>
            <PlatformAdminSecurityCard />
        </div>
    );
}
