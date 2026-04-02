"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function BlocklyLoadingSkeleton(): JSX.Element {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Skeleton className="h-32 rounded-[28px]" />
                <Skeleton className="h-32 rounded-[28px]" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                <Skeleton className="h-[72vh] rounded-[28px]" />
                <Skeleton className="h-[72vh] rounded-[28px]" />
            </div>
        </div>
    );
}
