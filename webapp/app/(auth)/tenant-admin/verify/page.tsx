import { TenantAdminTwoFactorVerifyForm } from "@/src/components/auth/TenantAdminTwoFactorVerifyForm";

export default function TenantAdminVerifyPage(): JSX.Element {
    return (
        <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-12">
            <TenantAdminTwoFactorVerifyForm />
        </div>
    );
}
