"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DepartmentUserRoutePlaceholder({
    mode,
}: {
    mode: "detail" | "index" | "new";
}): JSX.Element {
    const params = useParams<{ planId?: string }>();
    const searchParams = useSearchParams();
    const categories = (searchParams.get("categories") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    const fiscalYear = searchParams.get("fiscalYear");
    const viewMode = searchParams.get("mode") ?? (mode === "new" ? "edit" : "view");

    const title =
        mode === "new"
            ? "Plan workspace handoff reserved"
            : mode === "detail"
              ? "Plan detail handoff reserved"
              : "Department plan routes reserved";
    const description =
        mode === "new"
            ? "Story 5.1 preserves the selected categories and fiscal year here so Story 5.2 can open the Blockly workspace without changing the DU dashboard contract."
            : mode === "detail"
              ? "Story 5.1 routes truthful view and edit actions here so the DU dashboard never dead-ends into a placeholder alert."
              : "These DU planning routes stay protected and intentionally lightweight until the Blockly workspace story lands.";

    return (
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center px-4 py-10 sm:px-6">
            <Card className="w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">
                            DU handoff contract
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                            {viewMode}
                        </Badge>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl tracking-tight text-foreground">{title}</CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            {description}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                        <PlaceholderMetric label="Mode" value={viewMode} />
                        <PlaceholderMetric label="Fiscal Year" value={fiscalYear ?? "Not provided"} />
                        <PlaceholderMetric label="Plan ID" value={params.planId ?? "New plan"} />
                    </div>
                    <div className="rounded-3xl border border-border/70 bg-muted/25 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            <Layers3 className="h-4 w-4" />
                            Selected categories
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {categories.length === 0 ? (
                                <Badge variant="secondary" className="rounded-full">
                                    No categories preserved
                                </Badge>
                            ) : (
                                categories.map((categoryId) => (
                                    <Badge key={categoryId} variant="secondary" className="rounded-full">
                                        {categoryId}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Button asChild variant="outline" className="rounded-full">
                            <Link href="/du">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to dashboard
                            </Link>
                        </Button>
                        <Button type="button" disabled className="rounded-full">
                            Blockly workspace lands in Story 5.2
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function PlaceholderMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-3 text-lg font-semibold text-foreground">{value}</div>
        </div>
    );
}
