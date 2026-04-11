"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveProcurementOfficerWorkspaceNavigation } from "@/lib/procurement-officer/dashboard";

export function ProcurementOfficerWorkspaceRouteRedirect({
  href,
}: {
  href: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFallback, setShowFallback] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const redirectHref = useMemo(() => {
    const nextSearchParams = searchParams.toString();
    return nextSearchParams.length > 0 ? `${href}?${nextSearchParams}` : href;
  }, [href, searchParams]);
  const targetHref = useMemo(
    () => resolveProcurementOfficerWorkspaceNavigation(redirectHref).href,
    [redirectHref],
  );

  useEffect(() => {
    let isCancelled = false;

    try {
      router.replace(targetHref);
    } catch {
      setRedirectFailed(true);
      setShowFallback(true);
    }

    const fallbackTimer = window.setTimeout(() => {
      if (!isCancelled) {
        setShowFallback(true);
      }
    }, 1500);

    return () => {
      isCancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [router, targetHref]);

  function handleRetryRedirect(): void {
    setRedirectFailed(false);
    setShowFallback(false);
    router.replace(targetHref);
  }

  if (!showFallback) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-10">
        <div className="flex max-w-md items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-5 py-4 text-sm text-muted-foreground shadow-sm">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          <p>Opening the Procurement Officer workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-xl rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl tracking-[-0.04em]">
              {redirectFailed
                ? "Workspace redirect failed"
                : "Still opening the workspace"}
            </CardTitle>
            <CardDescription className="text-sm leading-7">
              This route should open inside the Procurement Officer dashboard
              shell. If the modal workspace did not appear, retry the redirect
              or open the dashboard directly.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleRetryRedirect} type="button">
              Retry redirect
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={targetHref}>
                Open dashboard workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
