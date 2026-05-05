import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProcurementDashboardState } from "@/lib/procurement-officer/dashboard";
import type {
  ProcurementOfficerDashboardFuturePanel,
  ProcurementOfficerDashboardSummaryCard,
} from "@/lib/procurement-officer/dashboard-snapshot";
import { cn } from "@/lib/utils";
import { humanizeState } from "./utilities";

export function DonutRing({
  value,
  size = 120,
  strokeWidth = 10,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2.5;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(value, 100);
  const offset = circumference - (filled / 100) * circumference;

  const color =
    filled >= 100
      ? "stroke-emerald-500"
      : filled >= 60
        ? "stroke-primary"
        : filled >= 30
          ? "stroke-amber-400"
          : "stroke-rose-400";

  return (
    <svg
      className={cn("rotate-[-90deg]", className)}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
    >
      <circle
        className="stroke-muted"
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        strokeWidth={strokeWidth}
      />
      <circle
        className={cn("transition-all duration-700 ease-out", color)}
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

export function StateBadge({
  label,
  state,
}: {
  label?: string;
  state: ProcurementDashboardState;
}) {
  const rendered = label ?? humanizeState(state);
  const isPulsing = state === "setup_required" || state === "coming_soon";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm",
        state === "available" &&
          "border-emerald-300/80 bg-emerald-200 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/80 dark:text-emerald-100",
        state === "coming_soon" &&
          "border-sky-300/80 bg-sky-200 text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/80 dark:text-sky-100",
        state === "empty" &&
          "border-slate-300/80 bg-slate-200 text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100",
        state === "setup_required" &&
          "border-amber-300/80 bg-amber-200 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/80 dark:text-amber-100",
        state === "unavailable" &&
          "border-slate-300/80 bg-slate-200 text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          isPulsing && "animate-pulse",
        )}
      />
      {rendered}
    </span>
  );
}

export function BentoCard({
  children,
  className,
  glowColor,
}: {
  children: ReactNode;
  className?: string;
  glowColor?: "primary" | "amber" | "emerald";
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-sm",
        "transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md hover:border-border/80",
        glowColor === "primary" && "hover:border-primary/30",
        glowColor === "amber" && "hover:border-amber-400/30",
        glowColor === "emerald" && "hover:border-emerald-400/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IconBox({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "muted" | "amber" | "emerald" | "info";
}) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm",
        tone === "primary" &&
          "bg-primary text-primary-foreground shadow-primary/25",
        tone === "muted" &&
          "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
        tone === "amber" &&
          "bg-amber-200 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100",
        tone === "emerald" &&
          "bg-emerald-200 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-100",
        tone === "info" &&
          "bg-sky-200 text-sky-950 dark:bg-sky-950/80 dark:text-sky-100",
      )}
    >
      {children}
    </div>
  );
}

export function OrganizationStatPill({
  card,
  icon,
  tone,
}: {
  card: ProcurementOfficerDashboardSummaryCard;
  icon: ReactNode;
  tone: "primary" | "amber" | "emerald";
}) {
  return (
    <div className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/25 px-2.5 py-1.5">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          tone === "primary" && "bg-primary text-primary-foreground",
          tone === "amber" &&
            "bg-amber-200 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100",
          tone === "emerald" &&
            "bg-emerald-200 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-100",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[7px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {card.label}
        </div>
        <div className="truncate text-[11px] font-semibold tracking-[-0.02em] text-foreground">
          {card.value}
        </div>
      </div>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          card.state === "available" && "bg-emerald-500",
          card.state === "coming_soon" && "bg-primary",
          card.state === "setup_required" && "bg-amber-500",
          (card.state === "empty" || card.state === "unavailable") &&
            "bg-muted-foreground/50",
        )}
      />
    </div>
  );
}

export function OverviewSignalRow({
  card,
  icon,
  tone,
}: {
  card: ProcurementOfficerDashboardSummaryCard;
  icon: ReactNode;
  tone: "primary" | "amber" | "emerald";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-3.5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
            tone === "primary" && "bg-primary/12 text-primary",
            tone === "amber" &&
              "bg-amber-200 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100",
            tone === "emerald" &&
              "bg-emerald-200 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-100",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {card.label}
          </div>
          <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            {card.value}
          </div>
        </div>
      </div>
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          card.state === "available" && "bg-emerald-500",
          card.state === "coming_soon" && "bg-primary",
          card.state === "setup_required" && "bg-amber-500",
          (card.state === "empty" || card.state === "unavailable") &&
            "bg-muted-foreground/50",
        )}
      />
    </div>
  );
}

export function MiniStat({
  label,
  meta,
  value,
  highlight,
}: {
  label: string;
  meta?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 text-center">
      <div
        className={cn(
          "text-lg font-black tracking-[-0.04em]",
          highlight ? "text-rose-500" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {meta ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{meta}</div>
      ) : null}
    </div>
  );
}

export function OverviewMetric({
  label,
  meta,
  value,
  highlight,
}: {
  label: string;
  meta?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          {meta ? (
            <div className="mt-1 truncate text-[12px] text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "shrink-0 text-[30px] font-black leading-none tracking-[-0.06em]",
            highlight ? "text-rose-500" : "text-foreground",
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export function OverviewActionButton({
  icon,
  label,
  meta,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-3.5 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
      onClick={onClick}
      type="button"
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{label}</div>
          <div className="truncate text-[12px] text-muted-foreground">{meta}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </button>
  );
}

export function WorkflowPanelButton({
  panel,
  onClick,
}: {
  panel: ProcurementOfficerDashboardFuturePanel;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-primary/5"
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-foreground">
          {panel.label}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[10px] leading-[1.4] text-muted-foreground">
          {panel.description}
        </div>
      </div>
      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </button>
  );
}

export function ProcurementOfficerDashboardSkeleton() {
  return (
    <div className="mx-auto hidden w-full max-w-none gap-4 px-4 py-4 lg:flex lg:flex-col xl:px-5">
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}
