"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildProcurementOfficerSubmissionModalPath,
  PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS,
} from "@/lib/procurement-officer/submissions";

export function ProcurementOfficerSubmissionReviewPlaceholder(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");
  const hasRedirectedRef = useRef(false);
  const queueHref = buildProcurementOfficerSubmissionModalPath({
    submissionWorkspaceSearchParams: searchParams,
  });
  const reviewTarget = useQuery(
    api.functions.procurementOfficerSubmissions.getProcurementOfficerSubmissionReviewTarget,
    planId ? { planId } : "skip",
  );

  useEffect(() => {
    if (!reviewTarget || reviewTarget.state !== "redirect" || hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    if (reviewTarget.message) {
      toast.error(reviewTarget.message);
    }

    router.replace(
      buildProcurementOfficerSubmissionModalPath({
        notice: "review-target-unavailable",
        submissionWorkspaceSearchParams: searchParams,
      }),
    );
  }, [reviewTarget, router, searchParams]);

  if (!planId) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
        <Card className="w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-3">
            <Badge
              variant="outline"
              className="w-fit rounded-full border-amber-300/70 bg-amber-50 text-amber-900"
            >
              Review target missing
            </Badge>
            <CardTitle className="text-3xl tracking-tight text-foreground">
              No plan was selected for review
            </CardTitle>
            <CardDescription className="text-base leading-7 text-muted-foreground">
              Return to the submission queue and pick a plan row to reserve the
              Story 6.4 handoff route.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href={queueHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to submission queue
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!reviewTarget || reviewTarget.state === "redirect") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-10">
        <div className="flex max-w-md items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-5 py-4 text-sm text-muted-foreground shadow-sm">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          <p>Preparing the review handoff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center px-4 py-10 sm:px-6">
      <Card className="w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-4">
          <Badge
            variant="outline"
            className="w-fit rounded-full border-primary/20 bg-primary/10 text-primary"
          >
            Story 6.4 handoff reserved
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight text-foreground">
              Review workspace arrives in the next story
            </CardTitle>
            <CardDescription className="text-base leading-7 text-muted-foreground">
              This route already resolves a tenant-scoped live plan and keeps the
              queue read-only. Story 6.4 will attach the detailed review surface
              here without changing the queue contract.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-3xl border border-border/70 bg-muted/20 p-5 md:grid-cols-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Department
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {reviewTarget.row.departmentName}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Status
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {reviewTarget.row.statusLabel}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Submitted
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {reviewTarget.row.submittedAtLabel}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Amount
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {reviewTarget.row.totalAmountLabel}
              </div>
            </div>
          </div>
          {searchParams.get(PROCUREMENT_OFFICER_SUBMISSION_QUERY_KEYS.status) ? (
            <div className="text-sm text-muted-foreground">
              Queue filters from the submissions workspace are preserved on this
              route and will carry back if you return now.
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={queueHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to submission queue
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
