"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 63);
}

export function PlatformAdminTenantProvisioningForm(): JSX.Element {
    const [organizationName, setOrganizationName] = useState("");
    const [subdomain, setSubdomain] = useState("");
    const [tenantAdminEmail, setTenantAdminEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ inviteUrl: string; tenantId: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const provisionTenant = useMutation(api.functions.platformAdminTenants.provisionTenant);
    const availability = useQuery(
        api.functions.platformAdminTenants.checkTenantSubdomainAvailability,
        subdomain.trim().length > 0 ? { subdomain } : "skip",
    );
    const canSubmit = useMemo(
        () =>
            organizationName.trim().length > 0 &&
            subdomain.trim().length > 0 &&
            tenantAdminEmail.trim().length > 0 &&
            availability?.available === true &&
            !isSubmitting,
        [availability?.available, isSubmitting, organizationName, subdomain, tenantAdminEmail],
    );

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const response = await provisionTenant({
                organizationName,
                subdomain,
                tenantAdminEmail,
            });
            setResult({
                inviteUrl: response.inviteUrl,
                tenantId: String(response.tenantId),
            });
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Tenant provisioning failed.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-[calc(100vh-4rem)] bg-background px-8 py-8">
            <div className="mx-auto max-w-3xl space-y-6">
                <Link
                    href="/platform-admin/tenants"
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    All tenants
                </Link>
                <header className="border-b border-border/70 pb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Create tenant</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Provision the tenant record, default settings, admin invitation, and invitation email in one audited operation.
                    </p>
                </header>

                {result ? (
                    <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5" />
                            <div>
                                <h2 className="font-semibold">Tenant provisioned</h2>
                                <p className="mt-1 text-sm">
                                    The tenant is visible in the roster with pending onboarding until the Tenant Admin accepts.
                                </p>
                                <div className="mt-4 flex gap-2">
                                    <Button asChild>
                                        <Link href={`/platform-admin/tenants/${result.tenantId}`}>
                                            Manage tenant
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline">
                                        <Link href={result.inviteUrl}>Open invitation</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : (
                    <form
                        onSubmit={(event) => {
                            void handleSubmit(event);
                        }}
                        className="space-y-5 rounded-lg border border-border/70 bg-card p-5"
                    >
                        <label className="block space-y-2">
                            <span className="text-sm font-medium">Organization name</span>
                            <Input
                                value={organizationName}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setOrganizationName(value);
                                    if (!subdomain) {
                                        setSubdomain(slugify(value));
                                    }
                                }}
                                required
                            />
                        </label>
                        <label className="block space-y-2">
                            <span className="text-sm font-medium">Subdomain</span>
                            <Input
                                value={subdomain}
                                onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
                                pattern="[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])"
                                required
                            />
                            <span className={availability?.available ? "text-sm text-emerald-700" : "text-sm text-muted-foreground"}>
                                {availability?.message ?? "Use lowercase letters, numbers, and hyphens."}
                            </span>
                        </label>
                        <label className="block space-y-2">
                            <span className="text-sm font-medium">Tenant Admin email</span>
                            <Input
                                type="email"
                                value={tenantAdminEmail}
                                onChange={(event) => setTenantAdminEmail(event.target.value)}
                                required
                            />
                        </label>
                        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                        <Button type="submit" disabled={!canSubmit}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Provision tenant
                        </Button>
                    </form>
                )}
            </div>
        </main>
    );
}
