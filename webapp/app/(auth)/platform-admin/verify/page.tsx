import type { Metadata } from "next";
import { PlatformAdminTwoFactorForm } from "@/src/components/auth/PlatformAdminTwoFactorForm";

export const metadata: Metadata = {
    title: "Verify Platform Admin Access - Procureline",
    description:
        "Complete the Platform Admin verification challenge before entering Procureline.",
};

export default function PlatformAdminVerifyPage() {
    return <PlatformAdminTwoFactorForm mode="verify" />;
}
