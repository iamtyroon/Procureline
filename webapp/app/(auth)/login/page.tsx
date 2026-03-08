import { getSingleSearchParam } from "@/lib/auth/password-reset";
import { LoginForm } from "@/src/components/auth/LoginForm";

interface LoginPageProps {
    searchParams: Promise<{
        reason?: string | string[] | undefined;
    }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedSearchParams = await searchParams;

    return (
        <LoginForm reason={getSingleSearchParam(resolvedSearchParams.reason) ?? null} />
    );
}
