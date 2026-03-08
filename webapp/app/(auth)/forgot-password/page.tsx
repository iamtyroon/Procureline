import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/src/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
    title: "Forgot Password — Procureline",
    description:
        "Request a Procureline password reset email to regain access to your account.",
};

export default function ForgotPasswordPage() {
    return <ForgotPasswordForm />;
}
