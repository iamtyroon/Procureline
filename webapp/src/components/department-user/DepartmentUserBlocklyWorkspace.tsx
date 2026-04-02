"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, LoaderCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BlocklyEditor } from "@/src/components/blockly/BlocklyEditor";
import { BlocklyLoadingSkeleton } from "@/src/components/blockly/BlocklyLoadingSkeleton";
import {
    getDepartmentUserWorkspaceAccessRefreshDelay,
    getDepartmentUserWorkspaceAccessRefreshKey,
    getDepartmentUserMissingLaunchContextMessage,
    parseDepartmentUserLaunchContext,
} from "@/lib/blockly/du-plan-routes";

export function DepartmentUserBlocklyWorkspace({
    routeMode,
}: {
    routeMode: "detail" | "new";
}): JSX.Element {
    if (routeMode === "new") {
        return <DepartmentUserNewPlanWorkspace />;
    }

    return <DepartmentUserExistingPlanWorkspace />;
}

function DepartmentUserNewPlanWorkspace(): JSX.Element {
    const searchParams = useSearchParams();
    const router = useRouter();
    const ensureDraftPlan = useMutation(api.functions.plans.ensureDepartmentUserDraftPlan);
    const launchContext = parseDepartmentUserLaunchContext(searchParams);
    const [ensureError, setEnsureError] = useState<string | null>(null);
    const [isEnsuringPlan, setIsEnsuringPlan] = useState(false);
    const workspaceContext = useQuery(
        api.functions.plans.getDepartmentUserNewPlanWorkspaceContext,
        launchContext.isValid && launchContext.fiscalYear
            ? {
                  categoryIds: launchContext.categoryIds,
                  fiscalYear: launchContext.fiscalYear,
              }
            : "skip",
    );

    useEffect(() => {
        if (!workspaceContext?.redirectHref) {
            return;
        }

        router.replace(workspaceContext.redirectHref);
    }, [router, workspaceContext?.redirectHref]);

    useEffect(() => {
        if (!workspaceContext || workspaceContext.meta.state !== "ready" || isEnsuringPlan) {
            return;
        }

        let isCancelled = false;
        const readyContext = workspaceContext;

        async function ensurePlan(): Promise<void> {
            setIsEnsuringPlan(true);
            try {
                const result = await ensureDraftPlan({
                    categoryIds: readyContext.meta.selectedCategoryIds,
                    fiscalYear: readyContext.meta.fiscalYear,
                });
                if (!isCancelled) {
                    router.replace(`/du/plans/${result.planId}?mode=edit`);
                }
            } catch (error) {
                if (!isCancelled) {
                    setEnsureError(
                        error instanceof Error
                            ? error.message
                            : "The planning workspace could not be created.",
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsEnsuringPlan(false);
                }
            }
        }

        void ensurePlan();

        return () => {
            isCancelled = true;
        };
    }, [ensureDraftPlan, isEnsuringPlan, router, workspaceContext]);

    if (!launchContext.isValid) {
        return (
            <DepartmentUserWorkspaceState
                description={getDepartmentUserMissingLaunchContextMessage()}
                title="Launchpad context required"
            />
        );
    }

    if (!workspaceContext || isEnsuringPlan) {
        return (
            <DepartmentUserWorkspaceScaffold>
                <BlocklyLoadingSkeleton />
            </DepartmentUserWorkspaceScaffold>
        );
    }

    if (ensureError) {
        return (
            <DepartmentUserWorkspaceState
                description={ensureError}
                title="Workspace creation failed"
            />
        );
    }

    if (workspaceContext.meta.state !== "ready" && workspaceContext.meta.state !== "redirect") {
        return (
            <DepartmentUserWorkspaceState
                description={
                    workspaceContext.statusMessage ??
                    "This planning route can't open yet. Return to the dashboard launchpad."
                }
                title={workspaceContext.meta.title}
            />
        );
    }

    return (
        <DepartmentUserWorkspaceScaffold>
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-5 py-4 text-sm text-muted-foreground shadow-sm">
                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                    Preparing the Blockly workspace...
                </div>
            </div>
        </DepartmentUserWorkspaceScaffold>
    );
}

function DepartmentUserExistingPlanWorkspace(): JSX.Element {
    const params = useParams<{ planId?: string }>();
    const searchParams = useSearchParams();
    const [accessRefreshKey, setAccessRefreshKey] = useState(() =>
        getDepartmentUserWorkspaceAccessRefreshKey(),
    );

    useEffect(() => {
        let timerId: number | null = null;

        function scheduleRefresh(now = Date.now()): void {
            setAccessRefreshKey(getDepartmentUserWorkspaceAccessRefreshKey(now));
            timerId = window.setTimeout(() => {
                scheduleRefresh(Date.now());
            }, getDepartmentUserWorkspaceAccessRefreshDelay(now));
        }

        scheduleRefresh();

        return () => {
            if (timerId !== null) {
                window.clearTimeout(timerId);
            }
        };
    }, []);

    const workspaceContext = useQuery(api.functions.plans.getDepartmentUserPlanWorkspace, {
        accessRefreshKey,
        planId: params.planId ?? "",
        requestedMode: searchParams.get("mode") === "edit" ? "edit" : "view",
    });

    if (!workspaceContext) {
        return (
            <DepartmentUserWorkspaceScaffold>
                <BlocklyLoadingSkeleton />
            </DepartmentUserWorkspaceScaffold>
        );
    }

    if (workspaceContext.meta.state !== "ready" || !workspaceContext.plan) {
        return (
            <DepartmentUserWorkspaceState
                description={
                    workspaceContext.statusMessage ??
                    "This plan is unavailable or no longer belongs to your department workspace."
                }
                title={workspaceContext.meta.title}
            />
        );
    }

    return (
        <DepartmentUserWorkspaceScaffold>
            <BlocklyEditor
                accessMode={workspaceContext.meta.accessMode}
                actor={workspaceContext.meta.actor}
                actorLabel={workspaceContext.meta.actorLabel}
                categories={workspaceContext.catalog.categories}
                currentUserId={workspaceContext.meta.currentUserId}
                department={workspaceContext.department}
                fiscalYear={workspaceContext.meta.fiscalYear}
                items={workspaceContext.catalog.items}
                mode={workspaceContext.meta.mode}
                modeIndicatorLabel={workspaceContext.meta.modeIndicatorLabel}
                planId={workspaceContext.plan.id}
                selectedCategoryIds={workspaceContext.meta.selectedCategoryIds}
                subtitle={workspaceContext.meta.subtitle}
                unavailableCategories={workspaceContext.meta.unavailableCategories}
                workspaceState={workspaceContext.plan.workspaceState}
            />
        </DepartmentUserWorkspaceScaffold>
    );
}

function DepartmentUserWorkspaceScaffold({
    children,
}: {
    children: ReactNode;
}): JSX.Element {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <div className="px-4 py-8 sm:px-6 lg:hidden">
                <Card className="mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm">
                    <CardHeader className="space-y-4">
                        <Badge className="w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary">
                            Desktop required
                        </Badge>
                        <CardTitle className="text-2xl text-foreground">
                            DU planning workspaces are designed for desktop viewports
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            Open this route on a desktop-sized viewport to use the Blockly editor, toolbox, and budget meter.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <div className="hidden lg:block">
                <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 xl:px-5">
                    {children}
                </div>
            </div>
        </div>
    );
}

function DepartmentUserWorkspaceState({
    description,
    title,
}: {
    description: string;
    title: string;
}) {
    return (
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
            <Card className="w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-800">
                            Planning blocked
                        </Badge>
                        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl tracking-tight text-foreground">
                            {title}
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            {description}
                        </CardDescription>
                    </div>
                    <Alert className="rounded-2xl border-border/70 bg-muted/20">
                        <AlertTitle>Recovery path</AlertTitle>
                        <AlertDescription>
                            Return to the DU dashboard launchpad, confirm the fiscal year, and open the workspace from there.
                        </AlertDescription>
                    </Alert>
                    <div className="flex items-center gap-3">
                        <Button asChild variant="outline">
                            <Link href="/du">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to dashboard
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>
        </div>
    );
}
