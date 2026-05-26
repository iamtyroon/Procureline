"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const operationsApi = (api as any).functions.tenantAdminOperations;

export function TenantAdminTwoFactorVerifyForm(): JSX.Element {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const authContext = useQuery(api.functions.users.getAuthContext, isAuthenticated ? {} : "skip");
    const verify = useMutation(operationsApi.verifyCurrentTwoFactorCode);
    const verifyRecovery = useMutation(operationsApi.verifyCurrentRecoveryCode);
    const router = useRouter();
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useRecoveryCode, setUseRecoveryCode] = useState(false);

    useEffect(() => {
        if (isLoading || authContext === undefined) return;
        if (!isAuthenticated || !authContext?.isSessionValid) {
            router.replace("/login?reason=session_expired");
            return;
        }
        if (authContext.role !== "tenant_admin") {
            router.replace(authContext.homePath);
            return;
        }
        if (!authContext.requiresTenantAdminVerification) {
            router.replace(authContext.homePath);
        }
    }, [authContext, isAuthenticated, isLoading, router]);

    async function handleVerify(): Promise<void> {
        setBusy(true);
        setError(null);
        try {
            const result = useRecoveryCode
                ? await verifyRecovery({ code: code.trim() })
                : await verify({ code: code.trim() });
            router.replace(result.redirectPath);
        } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : "Authenticator verification failed.");
        } finally {
            setBusy(false);
        }
    }

    if (isLoading || authContext === undefined) {
        return <div className="flex min-h-[18rem] items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin" /></div>;
    }

    return (
        <Card className="mx-auto max-w-md">
            <CardHeader className="text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
                <CardTitle>Verify Tenant Admin Access</CardTitle>
                <CardDescription>{useRecoveryCode ? "Enter one unused recovery code to continue." : "Enter the current code from your authenticator app to continue."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
                <Input autoComplete="one-time-code" inputMode={useRecoveryCode ? "text" : "numeric"} placeholder={useRecoveryCode ? "Recovery code" : "6-digit authenticator code"} value={code} onChange={(event) => setCode(event.target.value)} />
                <Button className="w-full" disabled={busy || !code.trim()} onClick={() => void handleVerify()}>
                    {busy ? "Verifying..." : "Verify"}
                </Button>
                <Button className="w-full" variant="ghost" onClick={() => { setCode(""); setError(null); setUseRecoveryCode((current) => !current); }}>
                    {useRecoveryCode ? "Use authenticator app instead" : "Use a recovery code"}
                </Button>
            </CardContent>
        </Card>
    );
}
