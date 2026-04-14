import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    buildCatalogRequestStatusMeta,
    type CatalogRequestBadgeTone,
    type CatalogRequestStatus,
    type CatalogRequestSummary,
    type CatalogRequestType,
} from "@/lib/procurement/catalog-requests";

export interface CatalogRequestInboxRow {
    canCancel: boolean;
    canEdit: boolean;
    createdAtLabel: string;
    id: string;
    reason: string | null;
    status: CatalogRequestStatus;
    statusLabel?: string;
    submittedAtLabel: string;
    summary: string;
    type: CatalogRequestType;
    typeLabel: string;
    updatedAtLabel: string;
}

function getStatusBadgeClassName(tone: CatalogRequestBadgeTone): string {
    if (tone === "approved") {
        return "border-emerald-300 bg-emerald-50 text-emerald-800";
    }
    if (tone === "denied") {
        return "border-rose-300 bg-rose-50 text-rose-800";
    }
    if (tone === "expired") {
        return "border-amber-300 bg-amber-50 text-amber-800";
    }

    return "border-slate-300 bg-slate-100 text-slate-800";
}

export function CatalogRequestInbox(props: {
    mode: "edit" | "view";
    onCancelRequest: (requestId: string) => void;
    onEditRequest: (requestId: string) => void;
    requests: CatalogRequestInboxRow[];
    summary: CatalogRequestSummary;
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-sm">
            <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                        <Badge variant="outline" className="w-fit rounded-full">
                            Request inbox
                        </Badge>
                        <CardTitle className="text-xl tracking-[-0.04em]">
                            Catalog request history
                        </CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="rounded-full">
                            {props.summary.totalPendingCount} pending
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                            {props.summary.totalCount} total
                        </Badge>
                    </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                    {props.mode === "view"
                        ? "Statuses stay visible in read-only mode."
                        : "Pending requests stay editable here until Procurement Officer review begins."}
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {props.requests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                        No catalog requests have been submitted from this planning flow yet.
                    </div>
                ) : null}

                {props.requests.map((request) => {
                    const statusMeta = buildCatalogRequestStatusMeta(request.status);

                    return (
                        <div
                            key={request.id}
                            className="rounded-2xl border border-border/70 bg-muted/15 p-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="rounded-full">
                                            {request.typeLabel}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className={`rounded-full ${getStatusBadgeClassName(statusMeta.badgeTone)}`}
                                        >
                                            {request.statusLabel ?? statusMeta.label}
                                        </Badge>
                                    </div>
                                    <p className="font-medium text-foreground">{request.summary}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Submitted {request.submittedAtLabel}. Updated {request.updatedAtLabel}.
                                    </p>
                                    {request.reason ? (
                                        <p className="text-sm text-muted-foreground">{request.reason}</p>
                                    ) : null}
                                </div>

                                {props.mode === "edit" &&
                                (request.canEdit || request.canCancel) ? (
                                    <div className="flex flex-wrap gap-2">
                                        {request.canEdit ? (
                                            <Button
                                                onClick={() => props.onEditRequest(request.id)}
                                                size="sm"
                                                type="button"
                                                variant="outline"
                                            >
                                                Edit
                                            </Button>
                                        ) : null}
                                        {request.canCancel ? (
                                            <Button
                                                onClick={() => props.onCancelRequest(request.id)}
                                                size="sm"
                                                type="button"
                                                variant="outline"
                                            >
                                                Cancel
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
