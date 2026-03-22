import type { Metadata } from "next";
import { getSingleSearchParam } from "@/lib/auth/password-reset";
import { LoginForm } from "@/src/components/auth/LoginForm";

export const metadata: Metadata = {
    title: "Login - Procureline",
    description: "Sign in to Procureline to access your procurement workspace.",
};

interface LoginPageProps {
    searchParams: Promise<{
        reason?: string | string[] | undefined;
    }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedSearchParams = await searchParams;

    return (
        <LoginForm
            reason={getSingleSearchParam(resolvedSearchParams.reason) ?? null}
        />
    );
}
