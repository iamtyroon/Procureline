import type { Metadata } from "next";
import { PlatformAdminTwoFactorForm } from "@/src/components/auth/PlatformAdminTwoFactorForm";

export const metadata: Metadata = {
    title: "Set Up Platform Admin 2FA - Procureline",
    description:
        "Finish Platform Admin two-factor enrollment before entering Procureline.",
};

export default function PlatformAdminSetupTwoFactorPage() {
    return <PlatformAdminTwoFactorForm mode="setup" />;
}
