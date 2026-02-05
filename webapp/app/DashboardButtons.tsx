"use client";

import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function DashboardButtons() {
  // TODO: Add Convex Auth integration
  return (
    <ErrorBoundary>
      <div className="flex gap-4">
        <Link href="/auth/signin">
          <Button variant="ghost">Sign in</Button>
        </Link>
        <Link href="/auth/signup">
          <Button>Sign up</Button>
        </Link>
      </div>
    </ErrorBoundary>
  );
}
