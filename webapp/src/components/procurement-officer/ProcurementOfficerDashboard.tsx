"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileStack,
  FolderTree,
  KeyRound,
  Layers3,
  MapPin,
  PackagePlus,
  PencilLine,
  Plus,
  Trash2,
  Users2,
  Zap,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildProcurementOfficerWorkspaceModalPath,
  formatProcurementFiscalYearLabel,
  normalizeProcurementOfficerWorkspaceModalState,
  resolveProcurementOfficerWorkspaceNavigation,
  type ProcurementDashboardState,
  type ProcurementOfficerWorkspaceModalState,
} from "@/lib/procurement-officer/dashboard";
import {
  formatDepartmentUserCount,
} from "@/lib/department-user/dashboard";
import type { DepartmentFormData } from "@/lib/validators/department";
import {
  extractProcurementOfficerDashboardSearchParams,
  PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS,
} from "@/lib/procurement-officer/dashboard-search";
import {
  DEPARTMENT_NOT_FOUND_MESSAGE,
  getDepartmentCrudErrorMessage,
  getDepartmentCrudRecoveryHref,
  isDepartmentCrudAuthorizationError,
} from "@/lib/procurement-officer/departments";
import {
  buildCategoryToolboxStyle,
  CATEGORY_NOT_FOUND_MESSAGE,
  getCategoryCrudErrorMessage,
  getCategoryCrudRecoveryHref,
  getCategoryIconOption,
  getCategoryIconOptions,
  getDefaultCategoryIconOption,
  isCategoryCrudAuthorizationError,
  type CategoryIconName,
} from "@/lib/procurement-officer/categories";
import type {
  ProcurementOfficerDashboardDepartmentReadinessItem,
  ProcurementOfficerDashboardFuturePanel,
  ProcurementOfficerDashboardSummaryCard,
} from "@/lib/procurement-officer/dashboard-snapshot";
import { formatDeadlineCountdown } from "@/lib/procurement-officer/deadlines";
import {
  buildProcurementItemTierLimitState,
  getProcurementItemCrudErrorMessage,
  getProcurementItemCrudRecoveryHref,
  isProcurementItemCrudAuthorizationError,
  PROCUREMENT_ITEM_PROCUREMENT_METHODS,
  PROCUREMENT_ITEM_UNITS,
  type ProcurementItemProcurementMethod,
  type ProcurementItemTierLimitState,
  type ProcurementItemWorkspaceRow,
} from "@/lib/procurement-officer/items";
import { categoryFormSchema, type CategoryFormData } from "@/lib/validators/category";
import { itemFormSchema, type ItemFormData } from "@/lib/validators/item";
import { cn } from "@/lib/utils";
import { ProcurementOfficerAccessCodesWorkspace } from "./ProcurementOfficerAccessCodesWorkspace";
import {
  DepartmentFormDialog,
  type DepartmentFormDialogDepartment,
} from "./DepartmentFormDialog";
import { ProcurementOfficerDeadlinesWorkspace } from "./ProcurementOfficerDeadlinesWorkspace";
import { ProcurementOfficerRequestsWorkspace } from "./ProcurementOfficerRequestsWorkspace";
import { ProcurementOfficerSubmissionsWorkspace } from "./ProcurementOfficerSubmissionsWorkspace";

/* ─── Donut Ring ──────────────────────────────────────────────────── */

interface DashboardDepartmentWorkspaceData {
  meta: {
    budgetCeiling: number | null;
  };
  rows: Array<{
    budgetAllocation: number | null;
    code: string;
    id: string;
    name: string;
    planningImpactWarning: string | null;
    voteNumber: string;
  }>;
}

interface DashboardCategoryWorkspaceData {
  meta: {
    activeCategoryCount: number;
  };
  rows: Array<{
    canDelete: boolean;
    color: string | null;
    deleteBlockerMessages: string[];
    description: string | null;
    id: string;
    icon: CategoryIconName | null;
    isActive: boolean;
    itemCount: number;
    name: string;
    planningImpactWarning: string | null;
    revision: number;
  }>;
}

interface DashboardItemCategoryOption {
  id: string;
  isActive: boolean;
  limit: ProcurementItemTierLimitState;
  name: string;
}

interface DashboardItemsWorkspaceData {
  categories: DashboardItemCategoryOption[];
  meta: {
    tier: "enterprise" | "free" | "professional" | "starter";
  };
}

interface DashboardCategoryItemsBrowseData {
  rows: ProcurementItemWorkspaceRow[];
}

function DonutRing({
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

/* ─── State Badge ─────────────────────────────────────────────────── */

function StateBadge({
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

/* ─── Bento Card wrapper ──────────────────────────────────────────── */

function BentoCard({
  children,
  className,
  glowColor,
}: {
  children: React.ReactNode;
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

/* ─── Icon container ──────────────────────────────────────────────── */

function IconBox({
  children,
  tone = "primary",
}: {
  children: React.ReactNode;
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

/* ─── Main component ──────────────────────────────────────────────── */

export function ProcurementOfficerDashboard(): JSX.Element {
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedFiscalYear =
    searchParams.get(PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear) ??
    undefined;

  const snapshot = useQuery(
    api.functions.procurementOfficerDashboard
      .getProcurementOfficerDashboardSnapshot,
    requestedFiscalYear ? { selectedFiscalYear: requestedFiscalYear } : {},
  );
  const departmentsWorkspace = useQuery(
    api.functions.departments.getDepartmentsWorkspace,
    {},
  ) as DashboardDepartmentWorkspaceData | undefined;
  const categoriesWorkspace = useQuery(
    api.functions.categories.getCategoriesWorkspace,
    {},
  ) as DashboardCategoryWorkspaceData | undefined;
  const itemsWorkspace = useQuery(
    api.functions.items.getItemsWorkspace,
    {},
  ) as DashboardItemsWorkspaceData | undefined;
  const createDepartment = useMutation(api.functions.departments.createDepartment);
  const createCategory = useMutation(api.functions.categories.createCategory);
  const createItem = useMutation(api.functions.items.createItem);
  const updateDepartment = useMutation(api.functions.departments.updateDepartment);
  const updateCategory = useMutation(api.functions.categories.updateCategory);
  const deleteCategory = useMutation(api.functions.categories.deleteCategory);
  const [isCreateDepartmentOpen, setIsCreateDepartmentOpen] = useState(false);
  const [isCreateDepartmentSubmitting, setIsCreateDepartmentSubmitting] =
    useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateCategorySubmitting, setIsCreateCategorySubmitting] =
    useState(false);
  const [isCategoryAddItemPending, setIsCategoryAddItemPending] =
    useState(false);
  const [isCreateItemOpen, setIsCreateItemOpen] = useState(false);
  const [isCreateItemSubmitting, setIsCreateItemSubmitting] = useState(false);
  const [itemCategoryOverride, setItemCategoryOverride] =
    useState<DashboardItemCategoryOption | null>(null);
  const [itemDialogCategoryId, setItemDialogCategoryId] = useState("");
  const [editDepartment, setEditDepartment] =
    useState<DepartmentFormDialogDepartment | null>(null);
  const [isEditDepartmentOpen, setIsEditDepartmentOpen] = useState(false);
  const [isEditDepartmentSubmitting, setIsEditDepartmentSubmitting] = useState(false);
  const [editCategory, setEditCategory] =
    useState<DashboardCategoryWorkspaceData["rows"][number] | null>(null);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [isEditCategorySubmitting, setIsEditCategorySubmitting] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<DashboardCategoryWorkspaceData["rows"][number] | null>(null);
  const [isDeleteCategorySubmitting, setIsDeleteCategorySubmitting] =
    useState(false);

  useEffect(() => {
    if (!snapshot?.deadlineOverview.targetAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [snapshot?.deadlineOverview.targetAt]);

  useEffect(() => {
    if (
      itemCategoryOverride &&
      (itemsWorkspace?.categories ?? []).some(
        (category) => category.id === itemCategoryOverride.id,
      )
    ) {
      setItemCategoryOverride(null);
    }
  }, [itemCategoryOverride, itemsWorkspace?.categories]);

  if (!snapshot) return <ProcurementOfficerDashboardSkeleton />;

  const activeModal = normalizeProcurementOfficerWorkspaceModalState({
    modal: searchParams.get("modal"),
  });
  const selectedFiscalYear =
    snapshot.fiscalYears.selectedFiscalYear ?? requestedFiscalYear;
  const fiscalYearLabel = snapshot.fiscalYears.selectedFiscalYear
    ? formatProcurementFiscalYearLabel(snapshot.fiscalYears.selectedFiscalYear)
    : "Fiscal year unavailable";
  const departmentsConfiguredCard = findSummaryCard(
    snapshot.summaryCards,
    "departments_configured",
  );
  const accessCodeCard = findSummaryCard(
    snapshot.summaryCards,
    "access_code_coverage",
  );
  const deadlineCard = findSummaryCard(
    snapshot.summaryCards,
    "deadline_readiness",
  );
  const liveDeadlineCard =
    deadlineCard && snapshot.deadlineOverview.targetAt
      ? {
          ...deadlineCard,
          value:
            snapshot.deadlineOverview.state === "available"
              ? formatDeadlineCountdown({
                  deadlineAt: snapshot.deadlineOverview.targetAt,
                  now: countdownNow,
                })
              : deadlineCard.value,
        }
      : deadlineCard;
  const duCoverageCard = findSummaryCard(
    snapshot.summaryCards,
    "du_assignment_coverage",
  );
  const requestPanel = findFuturePanel(snapshot.futurePanels, "request_inbox");
  const submissionPanel = findFuturePanel(
    snapshot.futurePanels,
    "submission_monitoring",
  );
  const availableCategories =
    categoriesWorkspace?.rows.filter((row) => row.isActive) ?? [];
  const hasCategories = availableCategories.length > 0;
  const fallbackItemCategories =
    itemCategoryOverride &&
    !(itemsWorkspace?.categories ?? []).some(
      (category) => category.id === itemCategoryOverride.id,
    )
      ? [itemCategoryOverride]
      : [];
  const dashboardItemCategories = [
    ...(itemsWorkspace?.categories.filter((category) => category.isActive) ?? []),
    ...fallbackItemCategories,
  ];
  const readyDepartmentCount = snapshot.departmentReadiness.items.filter(
    (i) => i.overallState === "available",
  ).length;
  const readinessPercent =
    snapshot.meta.selectedDepartmentCount === 0
      ? 0
      : Math.round(
          (readyDepartmentCount / snapshot.meta.selectedDepartmentCount) * 100,
        );
  const submittedDepartmentCount =
    snapshot.submissionProgress.submittedDepartmentCount;
  const submittedDepartmentScope = snapshot.submissionProgress.totalDepartmentCount;
  const submissionPercent = snapshot.submissionProgress.utilizationPercent;
  const submissionHelperText = snapshot.submissionProgress.helperText;
  const organizationBudget = snapshot.organizationOverview.budget;
  const organizationDepartmentLabel = formatDepartmentUserCount(
    snapshot.organizationOverview.activeDepartmentCount,
    "department",
  );
  const organizationActiveUserLabel = formatDepartmentUserCount(
    snapshot.organizationOverview.activeUserCount,
    "active user",
  );
  const organizationItemLabel = formatDepartmentUserCount(
    snapshot.organizationOverview.totalItemCount,
    "item",
  );
  const otherFiscalYears = snapshot.fiscalYears.options.filter(
    (y) => y !== snapshot.fiscalYears.selectedFiscalYear,
  );

  function setFiscalYearSearchParam(
    nextSearchParams: URLSearchParams,
    nextFiscalYear?: string,
  ): URLSearchParams {
    if (nextFiscalYear) {
      nextSearchParams.set(
        PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear,
        nextFiscalYear,
      );
    } else {
      nextSearchParams.delete(PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear);
    }

    return nextSearchParams;
  }

  function buildDashboardHref(nextFiscalYear?: string): string {
    const nextSearchParams = setFiscalYearSearchParam(
      extractProcurementOfficerDashboardSearchParams(searchParams),
      nextFiscalYear,
    );

    const query = nextSearchParams.toString();
    return query.length > 0 ? `${pathname}?${query}` : pathname;
  }

  function replaceSelectedFiscalYear(nextFiscalYear: string): void {
    const nextSearchParams = setFiscalYearSearchParam(
      new URLSearchParams(searchParams.toString()),
      nextFiscalYear,
    );
    const query = nextSearchParams.toString();
    startTransition(() =>
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname),
    );
  }

  function setWorkspaceModal(
    modalState: ProcurementOfficerWorkspaceModalState | null,
    historyMode: "push" | "replace",
  ) {
    const href = modalState
      ? buildProcurementOfficerWorkspaceModalPath(modalState, {
          dashboardSearchParams: searchParams,
        })
      : buildDashboardHref(selectedFiscalYear);
    if (historyMode === "push") router.push(href);
    else router.replace(href);
  }

  function handleWorkspaceAction(href: string) {
    const targetUrl = new URL(href, "https://procureline.local");
    if (targetUrl.pathname === "/po/departments") {
      openDashboardDepartmentCreateDialog();
      return;
    }

    const target = resolveProcurementOfficerWorkspaceNavigation(href);
    if (target.type === "route") {
      router.push(target.href);
      return;
    }
    setWorkspaceModal(target.modalState, "push");
  }

  function openDashboardDepartmentCreateDialog(): void {
    if (!departmentsWorkspace) {
      toast.error("Department details are still loading. Try again.");
      return;
    }

    setIsCreateDepartmentOpen(true);
  }

  async function handleDepartmentCreateSubmit(
    values: DepartmentFormData,
  ): Promise<void> {
    setIsCreateDepartmentSubmitting(true);

    try {
      await createDepartment({
        budgetAllocation: values.budgetAllocation,
        code: values.code,
        name: values.name,
        voteNumber: values.voteNumber,
      });
      toast.success("Department created.");
      setIsCreateDepartmentOpen(false);
    } catch (error) {
      if (isDepartmentCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setIsCreateDepartmentOpen(false);
        router.replace(getDepartmentCrudRecoveryHref());
        return;
      }

      toast.error(getDepartmentCrudErrorMessage(error));
    } finally {
      setIsCreateDepartmentSubmitting(false);
    }
  }

  function openDashboardDepartmentEditDialog(
    item: ProcurementOfficerDashboardDepartmentReadinessItem,
  ): void {
    const departmentRow = departmentsWorkspace?.rows.find((row) => row.id === item.id);
    if (!departmentRow) {
      toast.error("Department details are still loading. Try again.");
      return;
    }

    setEditDepartment({
      budgetAllocation: departmentRow.budgetAllocation,
      code: departmentRow.code,
      id: departmentRow.id,
      name: departmentRow.name,
      planningImpactWarning: departmentRow.planningImpactWarning,
      voteNumber: departmentRow.voteNumber,
      readinessPills: [
        {
          id: "access_code",
          label: "Access code",
          state: item.accessCode.state,
          value: item.accessCode.label,
        },
        {
          id: "department_user",
          label: "DU",
          state: item.departmentUser.state,
          value: item.departmentUser.label,
        },
        {
          id: "deadline",
          label: "Deadline",
          state: item.deadline.state,
          value: item.deadline.label,
        },
        {
          id: "budget",
          label: "Budget",
          state: item.budgetStatus.state,
          value: item.budgetStatus.label,
        },
      ],
    });
    setIsEditDepartmentOpen(true);
  }

  async function handleDepartmentEditSubmit(
    values: DepartmentFormData,
  ): Promise<void> {
    if (!editDepartment) {
      return;
    }

    setIsEditDepartmentSubmitting(true);

    try {
      await updateDepartment({
        budgetAllocation: values.budgetAllocation,
        code: values.code,
        departmentId: editDepartment.id as any,
        name: values.name,
        voteNumber: values.voteNumber,
      });
      toast.success("Department updated.");
      setIsEditDepartmentOpen(false);
      setEditDepartment(null);
    } catch (error) {
      if (isDepartmentCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setIsEditDepartmentOpen(false);
        setEditDepartment(null);
        router.replace(getDepartmentCrudRecoveryHref());
        return;
      }

      const message = getDepartmentCrudErrorMessage(error);
      if (message === DEPARTMENT_NOT_FOUND_MESSAGE) {
        setIsEditDepartmentOpen(false);
        setEditDepartment(null);
      }
      toast.error(message);
    } finally {
      setIsEditDepartmentSubmitting(false);
    }
  }

  function openDashboardCategoryEditDialog(
    category: DashboardCategoryWorkspaceData["rows"][number],
  ): void {
    setEditCategory(category);
    setIsEditCategoryOpen(true);
  }

  function openDashboardCategoryCreateDialog(): void {
    setEditCategory(null);
    setIsEditCategoryOpen(false);
    setIsCreateCategoryOpen(true);
  }

  function requestDashboardCategoryDelete(
    category: DashboardCategoryWorkspaceData["rows"][number],
  ): void {
    if (!category.canDelete) {
      toast.error(
        category.deleteBlockerMessages[0] ??
          "This category cannot be deleted right now.",
      );
      return;
    }

    setDeleteCategoryTarget(category);
  }

  async function handleCategoryEditSubmit(
    values: CategoryFormData,
  ): Promise<void> {
    if (!editCategory) {
      return;
    }

    setIsEditCategorySubmitting(true);

    try {
      await updateCategory({
        categoryId: editCategory.id as any,
        color: values.color,
        description: values.description,
        expectedRevision: editCategory.revision,
        icon: values.icon,
        name: values.name,
      });
      toast.success("Category updated.");
      setIsEditCategoryOpen(false);
      setEditCategory(null);
    } catch (error) {
      if (isCategoryCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setIsEditCategoryOpen(false);
        setEditCategory(null);
        router.replace(getCategoryCrudRecoveryHref());
        return;
      }

      const message = getCategoryCrudErrorMessage(error);
      if (message === CATEGORY_NOT_FOUND_MESSAGE) {
        setIsEditCategoryOpen(false);
        setEditCategory(null);
      }
      toast.error(message);
    } finally {
      setIsEditCategorySubmitting(false);
    }
  }

  async function persistDashboardCategory(
    values: CategoryFormData,
  ): Promise<DashboardCategoryWorkspaceData["rows"][number]> {
    const result = await createCategory({
      color: values.color,
      description: values.description,
      icon: values.icon,
      name: values.name,
    });

    return {
      canDelete: true,
      color: values.color ?? null,
      deleteBlockerMessages: [],
      description: values.description ?? null,
      icon: (values.icon as CategoryIconName | null | undefined) ?? null,
      id: result.categoryId,
      isActive: true,
      itemCount: 0,
      name: values.name,
      planningImpactWarning: null,
      revision: result.revision,
    };
  }

  function openDashboardItemCreateDialog(categoryId?: string | null): void {
    if (!itemsWorkspace && !itemCategoryOverride) {
      toast.error("Item details are still loading. Try again.");
      return;
    }

    const requestedCategoryId = categoryId?.trim() ?? "";
    const fallbackCategoryId = dashboardItemCategories[0]?.id ?? "";
    setItemDialogCategoryId(requestedCategoryId || fallbackCategoryId);
    setIsCreateItemOpen(true);
  }

  async function handleCategoryAddItemFromCreate(
    values: CategoryFormData,
  ): Promise<void> {
    setIsCategoryAddItemPending(true);

    try {
      const createdCategory = await persistDashboardCategory(values);
      setItemCategoryOverride({
        id: createdCategory.id,
        isActive: true,
        limit: buildProcurementItemTierLimitState({
          activeItemCount: 0,
          tier: itemsWorkspace?.meta.tier ?? "free",
        }),
        name: createdCategory.name,
      });
      setIsCreateCategoryOpen(false);
      setEditCategory(createdCategory);
      setIsEditCategoryOpen(true);
      setItemDialogCategoryId(createdCategory.id);
      setIsCreateItemOpen(true);
      toast.success("Category created.");
    } catch (error) {
      if (isCategoryCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setIsCreateCategoryOpen(false);
        router.replace(getCategoryCrudRecoveryHref());
        return;
      }

      toast.error(getCategoryCrudErrorMessage(error));
    } finally {
      setIsCategoryAddItemPending(false);
    }
  }

  async function handleCategoryCreateSubmit(
    values: CategoryFormData,
  ): Promise<void> {
    setIsCreateCategorySubmitting(true);

    try {
      await persistDashboardCategory(values);
      toast.success("Category created.");
      setIsCreateCategoryOpen(false);
    } catch (error) {
      if (isCategoryCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setIsCreateCategoryOpen(false);
        router.replace(getCategoryCrudRecoveryHref());
        return;
      }

      toast.error(getCategoryCrudErrorMessage(error));
    } finally {
      setIsCreateCategorySubmitting(false);
    }
  }

  async function handleDashboardItemCreateSubmit(
    values: ItemFormData,
  ): Promise<void> {
    setIsCreateItemSubmitting(true);

    try {
      await createItem({
        categoryId: values.categoryId as never,
        complianceFlags: values.complianceFlags,
        customUnit: values.customUnit,
        maxQuantity: values.maxQuantity,
        minQuantity: values.minQuantity,
        name: values.name,
        procurementMethod: values.procurementMethod,
        sourceOfFunds: values.sourceOfFunds,
        unit: values.unitOption === "custom" ? "custom" : (values.unit ?? ""),
        unitPrice: values.unitPrice,
      });
      toast.success("Item created.");
      setItemCategoryOverride(null);
      setIsCreateItemOpen(false);
    } catch (error) {
      if (isProcurementItemCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setItemCategoryOverride(null);
        setIsCreateItemOpen(false);
        router.replace(getProcurementItemCrudRecoveryHref());
        return;
      }

      toast.error(getProcurementItemCrudErrorMessage(error));
    } finally {
      setIsCreateItemSubmitting(false);
    }
  }

  async function handleCategoryDeleteConfirm(): Promise<void> {
    if (!deleteCategoryTarget) {
      return;
    }

    setIsDeleteCategorySubmitting(true);

    try {
      await deleteCategory({
        categoryId: deleteCategoryTarget.id as any,
        expectedRevision: deleteCategoryTarget.revision,
      });
      toast.success("Category deleted.");
      setDeleteCategoryTarget(null);
    } catch (error) {
      if (isCategoryCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setDeleteCategoryTarget(null);
        router.replace(getCategoryCrudRecoveryHref());
        return;
      }

      const message = getCategoryCrudErrorMessage(error);
      if (message === CATEGORY_NOT_FOUND_MESSAGE) {
        setDeleteCategoryTarget(null);
      }
      toast.error(message);
    } finally {
      setIsDeleteCategorySubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* ── Mobile fallback ── */}
      <div className="px-4 py-8 sm:px-6 lg:hidden">
        <Card className="mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm">
          <CardHeader className="space-y-4">
            <Badge className="w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary">
              Desktop required
            </Badge>
            <CardTitle className="text-2xl text-foreground">
              Procurement Officer dashboards are designed for desktop viewports
            </CardTitle>
            <CardDescription className="text-base leading-7 text-muted-foreground">
              This workspace follows the desktop-only platform strategy from the
              Procureline UX specification.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* ── Desktop bento grid ── */}
      <div className="hidden">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-none flex-col gap-3 px-4 py-4 xl:px-5">
          {/* Row 2 — Consolidation Hub + Org Overview + Workflow Panels */}
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.56fr)_minmax(320px,0.9fr)]">
            {/* Left column */}
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.38fr)_minmax(280px,0.92fr)]">
              {/* Consolidation Hub — 2×1 dominant card */}
              <BentoCard glowColor="primary">
                <div className="flex flex-col gap-4 p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <IconBox tone="primary">
                        <Layers3 className="h-4 w-4" />
                      </IconBox>
                      <span className="text-[15px] font-bold text-foreground">
                        Consolidation Hub
                      </span>
                    </div>
                    <StateBadge state={snapshot.hero.state} />
                  </div>

                  {/* Donut + stats */}
                  <div className="flex items-center gap-5 rounded-xl border border-border/60 bg-muted/30 p-4">
                    <div className="relative shrink-0">
                      <DonutRing
                        size={108}
                        strokeWidth={9}
                        value={readinessPercent}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black leading-none tracking-[-0.06em] text-foreground">
                          {readinessPercent}%
                        </span>
                        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Ready
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
                          Current Fiscal Year
                        </div>
                        <div className="text-base font-bold tracking-[-0.03em] text-foreground">
                          {fiscalYearLabel}
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {readyDepartmentCount} of{" "}
                          {snapshot.meta.selectedDepartmentCount} Departments
                          Ready
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary via-chart-3 to-chart-4 transition-all duration-700 shadow-[0_0_6px_var(--primary)]"
                            style={{ width: `${readinessPercent}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Preparation completion
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <Button
                    asChild
                    className="h-10 w-full rounded-xl text-sm font-semibold shadow-sm shadow-primary/20"
                  >
                    <Link href="/po/consolidation">
                      <Zap className="mr-2 h-4 w-4" />
                      Open Consolidation Workspace
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Link>
                  </Button>

                  {/* Previous cycles */}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                    <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Previous cycles
                    </span>
                    {otherFiscalYears.length === 0 ? (
                      <span className="text-[12px] text-muted-foreground">
                        None yet
                      </span>
                    ) : (
                      otherFiscalYears.slice(0, 3).map((year) => (
                        <button
                          key={year}
                          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                          onClick={() => replaceSelectedFiscalYear(year)}
                          type="button"
                        >
                          {formatProcurementFiscalYearLabel(year)}
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </BentoCard>

              {/* Organization Overview */}
              <BentoCard>
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <IconBox tone="muted">
                        <Building2 className="h-4 w-4" />
                      </IconBox>
                      <span className="text-[14px] font-bold text-foreground">
                        Organization
                      </span>
                    </div>
                    <StateBadge
                      state={snapshot.fiscalYears.state}
                      label={
                        snapshot.fiscalYears.state === "available"
                          ? fiscalYearLabel
                          : "Not configured"
                      }
                    />
                  </div>

                  {/* Tenant */}
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-black tracking-[-0.04em] text-primary-foreground shadow-sm shadow-primary/20">
                      {getInitials(snapshot.meta.tenantName)}
                    </div>
                    <div>
                      <div className="text-sm font-bold tracking-[-0.02em] text-foreground">
                        {snapshot.meta.tenantName}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        Procurement workspace
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-foreground">
                        Preparation
                      </span>
                      <span className="text-lg font-black tracking-[-0.04em] text-primary">
                        {readinessPercent}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${readinessPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Ready: {readyDepartmentCount} depts</span>
                      <span>{fiscalYearLabel}</span>
                    </div>
                  </div>

                  {departmentsConfiguredCard &&
                  accessCodeCard &&
                  deadlineCard ? (
                    <div className="space-y-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Workspace signals
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <OrganizationStatPill
                          card={departmentsConfiguredCard}
                          icon={<Building2 className="h-3.5 w-3.5" />}
                          tone="primary"
                        />
                        <OrganizationStatPill
                          card={accessCodeCard}
                          icon={<KeyRound className="h-3.5 w-3.5" />}
                          tone="amber"
                        />
                        <OrganizationStatPill
                          card={liveDeadlineCard ?? deadlineCard}
                          icon={<CalendarClock className="h-3.5 w-3.5" />}
                          tone="emerald"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat
                        label="Departments"
                        value={String(snapshot.meta.selectedDepartmentCount)}
                      />
                      <MiniStat
                        label="DU Coverage"
                        value={duCoverageCard?.value ?? "--"}
                      />
                      <MiniStat
                        label="Alerts"
                        value={String(snapshot.alerts.length)}
                        highlight={snapshot.alerts.length > 0}
                      />
                    </div>
                  )}
                </div>
              </BentoCard>

              {/* Department Management — full width */}
              <BentoCard className="xl:col-span-2">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <IconBox tone="primary">
                      <Users2 className="h-4 w-4" />
                    </IconBox>
                    <div>
                      <div className="text-[14px] font-bold text-foreground">
                        Department Management
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {snapshot.departmentReadiness.summary}
                      </div>
                    </div>
                  </div>
                  <Button
                    className="h-8 rounded-lg text-xs"
                    onClick={openDashboardDepartmentCreateDialog}
                    type="button"
                  >
                    Add department
                  </Button>
                </div>

                {snapshot.departmentReadiness.items.length === 0 ? (
                  <div className="p-5">
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                      <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                      <div className="text-sm font-medium text-muted-foreground">
                        Department readiness appears here once active
                        departments exist.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-muted/20">
                          {[
                            "Department",
                            "Vote #",
                            "Readiness",
                            "Coverage",
                            "Actions",
                          ].map((h, i) => (
                            <th
                              key={h}
                              className={cn(
                                "border-b border-border/60 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground",
                                i === 0 && "text-left",
                                i === 4 && "text-right",
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.departmentReadiness.items
                          .slice(0, 6)
                          .map((item) => (
                            <DepartmentReadinessRow
                              key={item.id}
                              item={item}
                              onManageDepartment={openDashboardDepartmentCreateDialog}
                            />
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </BentoCard>
            </div>

            {/* Right column — Workflow Panels */}
            <BentoCard className="flex flex-col">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <IconBox tone="info">
                    <FileStack className="h-4 w-4" />
                  </IconBox>
                  <span className="text-[14px] font-bold text-foreground">
                    Workflow Panels
                  </span>
                </div>
                {submissionPanel ? (
                  <StateBadge
                    state={submissionPanel.state}
                    label={submissionPanel.statusLabel}
                  />
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                {/* Review Center */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-foreground">
                      Review Center
                    </div>
                    {requestPanel ? (
                      <StateBadge
                        state={requestPanel.state}
                        label={requestPanel.statusLabel}
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {[requestPanel, submissionPanel]
                      .filter(
                        (p): p is ProcurementOfficerDashboardFuturePanel =>
                          Boolean(p),
                      )
                      .map((panel) => (
                        <WorkflowPanelButton
                          key={panel.id}
                          panel={panel}
                          onClick={() => handleWorkspaceAction(panel.cta.href)}
                        />
                      ))}
                  </div>
                </div>

                {/* Categories & Items */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <FolderTree className="h-3.5 w-3.5" />
                      </div>
                      <div className="text-[15px] font-bold text-foreground">
                        Categories
                      </div>
                    </div>
                    <Button
                      className="h-8 rounded-lg px-3 text-xs font-semibold"
                      onClick={openDashboardCategoryCreateDialog}
                      type="button"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      New
                    </Button>
                  </div>
                  <div className="mt-5 border-t border-border/60 pt-6">
                    {hasCategories ? (
                      <div className="space-y-2">
                        {availableCategories.slice(0, 4).map((category) => (
                          <CategoryManagementRow
                            key={category.id}
                            category={category}
                            density="compact"
                            onDelete={requestDashboardCategoryDelete}
                            onEdit={openDashboardCategoryEditDialog}
                          />
                        ))}
                        {availableCategories.length > 4 ? (
                          <div className="pt-1 text-center text-[12px] text-muted-foreground">
                            {availableCategories.length - 4} more categor
                            {availableCategories.length - 4 === 1 ? "y" : "ies"}{" "}
                            available
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex min-h-[6.5rem] items-center justify-center text-center text-sm text-muted-foreground">
                        No categories yet. Click &quot;+ New&quot; to add one.
                      </div>
                    )}
                  </div>
                </div>

                {/* Access Codes quick link */}
                <div className="mt-auto rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-amber-300/70 bg-amber-200 text-amber-950 shadow-sm dark:border-amber-300/25 dark:bg-amber-400/20 dark:text-amber-50">
                        <KeyRound className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[12px] font-semibold text-foreground">
                        Access Codes
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                      onClick={() => handleWorkspaceAction("/po/access-codes")}
                      type="button"
                    >
                      Manage
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Deadlines quick link */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-xl border shadow-sm",
                          snapshot.alerts.some((a) => a.id === "deadline")
                            ? "border-rose-300/70 bg-rose-200 text-rose-950 dark:border-rose-300/25 dark:bg-rose-400/20 dark:text-rose-50"
                            : "border-emerald-300/70 bg-emerald-200 text-emerald-950 dark:border-emerald-300/25 dark:bg-emerald-400/20 dark:text-emerald-50",
                        )}
                      >
                        {snapshot.alerts.some((a) => a.id === "deadline") ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span className="text-[12px] font-semibold text-foreground">
                        Deadlines
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                      onClick={() => handleWorkspaceAction("/po/deadlines")}
                      type="button"
                    >
                      Review
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-none flex-col gap-4 px-4 py-4 xl:px-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <BentoCard glowColor="primary">
              <div className="flex h-full flex-col gap-6 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <IconBox tone="primary">
                      <Layers3 className="h-4 w-4" />
                    </IconBox>
                    <span className="text-[15px] font-bold text-foreground">
                      Consolidation Hub
                    </span>
                  </div>
                  <StateBadge state={snapshot.hero.state} />
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                        Current fiscal year
                      </div>
                      <div className="text-2xl font-black tracking-[-0.05em] text-foreground">
                        {fiscalYearLabel} Master Plan
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {submittedDepartmentCount} of {submittedDepartmentScope}{" "}
                        departments submitted
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black tracking-[-0.07em] text-foreground">
                        {submissionPercent}%
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Submitted
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(100, submissionPercent)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                    {submissionHelperText}
                  </p>
                  <Button
                    className="h-10 rounded-lg px-4 text-xs font-semibold"
                    onClick={() => handleWorkspaceAction("/po/consolidation")}
                    type="button"
                  >
                    Open workspace
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="border-t border-border/60 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Other cycles
                    </span>
                    {otherFiscalYears.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        None yet
                      </span>
                    ) : (
                      otherFiscalYears.slice(0, 3).map((year) => (
                        <button
                          key={year}
                          className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-[11px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                          onClick={() => replaceSelectedFiscalYear(year)}
                          type="button"
                        >
                          {formatProcurementFiscalYearLabel(year)}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </BentoCard>

            <BentoCard>
              <div className="flex h-full flex-col gap-5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <IconBox tone="muted">
                      <Building2 className="h-4 w-4" />
                    </IconBox>
                    <span className="text-[15px] font-bold text-foreground">
                      Organization Overview
                    </span>
                  </div>
                  <StateBadge
                    state={snapshot.fiscalYears.state}
                    label={
                      snapshot.fiscalYears.state === "available"
                        ? fiscalYearLabel
                        : "Not configured"
                    }
                      />
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-base font-black tracking-[-0.05em] text-primary shadow-sm shadow-primary/10">
                          {getInitials(snapshot.meta.tenantName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[20px] font-black tracking-[-0.04em] text-foreground">
                            {snapshot.meta.tenantName}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                            <span>Procurement workspace</span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            <span>{organizationDepartmentLabel}</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full rounded-2xl border border-border/60 bg-background/80 p-3.5 lg:max-w-[18rem]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            Budget utilization
                          </span>
                          <span className="text-[22px] font-black tracking-[-0.05em] text-primary">
                            {organizationBudget.state === "available"
                              ? `${organizationBudget.utilizationPercent}%`
                              : "--"}
                          </span>
                        </div>
                        <Progress
                          className="mt-3 h-2.5 bg-muted/80"
                          value={Math.min(100, organizationBudget.utilizationPercent)}
                        />
                        <div className="mt-3 flex items-center justify-between gap-4 text-[12px] text-muted-foreground">
                          <span>Used: {organizationBudget.usedBudgetLabel}</span>
                          <span>Total: {organizationBudget.totalBudgetLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <OverviewMetric
                        label="Departments"
                        value={String(snapshot.organizationOverview.activeDepartmentCount)}
                        meta={organizationDepartmentLabel}
                      />
                      <OverviewMetric
                        label="Active users"
                        value={String(snapshot.organizationOverview.activeUserCount)}
                        meta={organizationActiveUserLabel}
                      />
                      <OverviewMetric
                        label="Total items"
                        value={String(snapshot.organizationOverview.totalItemCount)}
                        meta={organizationItemLabel}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)]">
                  <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Operational signals
                    </div>
                    <div className="grid gap-2.5">
                    {departmentsConfiguredCard ? (
                      <OverviewSignalRow
                        card={departmentsConfiguredCard}
                        icon={<Building2 className="h-3.5 w-3.5" />}
                        tone="primary"
                      />
                    ) : null}
                    {accessCodeCard ? (
                      <OverviewSignalRow
                        card={accessCodeCard}
                        icon={<KeyRound className="h-3.5 w-3.5" />}
                        tone="amber"
                      />
                    ) : null}
                    {deadlineCard ? (
                      <OverviewSignalRow
                        card={liveDeadlineCard ?? deadlineCard}
                        icon={<CalendarClock className="h-3.5 w-3.5" />}
                        tone="emerald"
                      />
                    ) : null}
                    {!departmentsConfiguredCard &&
                    !accessCodeCard &&
                    !deadlineCard ? (
                      <OverviewMetric
                        label="DU Coverage"
                        value={duCoverageCard?.value ?? "--"}
                        meta={
                          duCoverageCard?.helperText ??
                          "Department-user assignment coverage."
                        }
                      />
                    ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Quick actions
                    </div>
                    <div className="grid gap-3">
                      <OverviewActionButton
                        icon={
                          <IconBox tone="amber">
                            <KeyRound className="h-4 w-4" />
                          </IconBox>
                        }
                        label="Access Codes"
                        meta={accessCodeCard?.statusLabel ?? "Manage"}
                        onClick={() => handleWorkspaceAction("/po/access-codes")}
                      />
                      <OverviewActionButton
                        icon={
                          <IconBox
                            tone={
                              snapshot.alerts.some((alert) => alert.id === "deadline")
                                ? "amber"
                                : "emerald"
                            }
                          >
                            <CalendarClock className="h-4 w-4" />
                          </IconBox>
                        }
                        label="Deadlines"
                        meta={
                          liveDeadlineCard?.statusLabel ??
                          deadlineCard?.statusLabel ??
                          "Review"
                        }
                        onClick={() => handleWorkspaceAction("/po/deadlines")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <IconBox tone="primary">
                    <Users2 className="h-4 w-4" />
                  </IconBox>
                  <div>
                    <div className="text-[15px] font-bold text-foreground">
                      Department Management
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {snapshot.departmentReadiness.summary}
                    </div>
                  </div>
                </div>
                <Button
                  className="h-8 rounded-lg text-xs"
                  onClick={openDashboardDepartmentCreateDialog}
                  type="button"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add department
                </Button>
              </div>

              {snapshot.departmentReadiness.items.length === 0 ? (
                <div className="p-5">
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <div className="text-sm font-medium text-muted-foreground">
                      Department readiness appears here once active departments
                      exist.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto px-4 pb-4 pt-2">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        {["Department", "Vote #", "Budget status", "Actions"].map(
                          (heading, index) => (
                            <th
                              key={heading}
                              className={cn(
                                "border-b border-border/60 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground",
                                index === 0 && "text-left",
                                index === 1 && "text-left",
                                index === 2 && "text-left",
                                index === 3 && "text-right",
                              )}
                            >
                              {heading}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.departmentReadiness.items
                        .slice(0, 6)
                        .map((item) => (
                          <DepartmentReadinessRow
                            key={item.id}
                            item={item}
                            onManageDepartment={() =>
                              openDashboardDepartmentEditDialog(item)
                            }
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <IconBox tone="amber">
                    <FileStack className="h-4 w-4" />
                  </IconBox>
                  <span className="text-[15px] font-bold text-foreground">
                    Submitted Plans
                  </span>
                </div>
                {submissionPanel ? (
                  <StateBadge
                    state={submissionPanel.state}
                    label={submissionPanel.statusLabel}
                  />
                ) : null}
              </div>
              <div className="p-5">
                <div className="flex min-h-[13rem] flex-col justify-between rounded-xl border border-dashed border-border/60 bg-muted/10 p-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">
                      Submission monitoring
                    </div>
                    <div className="text-sm leading-6 text-muted-foreground">
                      {submissionPanel?.description ??
                        "Submitted plans will appear here as departments move into review."}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="h-9 rounded-lg text-xs"
                      onClick={() => handleWorkspaceAction("/po/submissions")}
                      type="button"
                    >
                      Open submissions
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]">
            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <IconBox tone="amber">
                    <AlertTriangle className="h-4 w-4" />
                  </IconBox>
                  <span className="text-[15px] font-bold text-foreground">
                    Pending Requests
                  </span>
                </div>
                {requestPanel ? (
                  <StateBadge
                    state={requestPanel.state}
                    label={requestPanel.statusLabel}
                  />
                ) : null}
              </div>
              <div className="p-5">
                <div className="flex min-h-[10rem] flex-col justify-between rounded-xl border border-dashed border-border/60 bg-muted/10 p-4">
                  <div className="text-sm leading-6 text-muted-foreground">
                    {requestPanel?.description ??
                      "No request activity is available yet for the selected fiscal year."}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="h-9 rounded-lg text-xs"
                      onClick={() => handleWorkspaceAction("/po/requests")}
                      type="button"
                    >
                      Open request inbox
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <IconBox tone="info">
                    <FolderTree className="h-4 w-4" />
                  </IconBox>
                  <span className="text-[15px] font-bold text-foreground">
                    Categories
                  </span>
                </div>
                <Button
                  className="h-9 rounded-lg px-4 text-xs font-semibold"
                  onClick={openDashboardCategoryCreateDialog}
                  type="button"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New
                </Button>
              </div>
              <div className="p-5">
                <div className="border-t border-border/60 pt-8">
                  {hasCategories ? (
                    <div className="space-y-3">
                      {availableCategories.slice(0, 6).map((category) => (
                        <CategoryManagementRow
                          key={category.id}
                          category={category}
                          density="comfortable"
                          onDelete={requestDashboardCategoryDelete}
                          onEdit={openDashboardCategoryEditDialog}
                        />
                      ))}
                      {availableCategories.length > 6 ? (
                        <div className="pt-1 text-center text-[13px] text-muted-foreground">
                          {availableCategories.length - 6} more categor
                          {availableCategories.length - 6 === 1 ? "y" : "ies"} available
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex min-h-[8.5rem] items-center justify-center text-center text-[15px] text-muted-foreground">
                      No categories yet. Click &quot;+ New&quot; to add one.
                    </div>
                  )}
                </div>
              </div>
            </BentoCard>
          </div>
        </div>
      </div>

      {departmentsWorkspace ? (
        <DepartmentFormDialog
          activeDepartments={departmentsWorkspace.rows.map((row) => ({
            budgetAllocation: row.budgetAllocation,
            id: row.id,
          }))}
          budgetCeiling={departmentsWorkspace.meta.budgetCeiling}
          department={null}
          isSubmitting={isCreateDepartmentSubmitting}
          onOpenChange={setIsCreateDepartmentOpen}
          onSubmit={handleDepartmentCreateSubmit}
          open={isCreateDepartmentOpen}
        />
      ) : null}

      {departmentsWorkspace ? (
        <DepartmentFormDialog
          activeDepartments={departmentsWorkspace.rows.map((row) => ({
            budgetAllocation: row.budgetAllocation,
            id: row.id,
          }))}
          budgetCeiling={departmentsWorkspace.meta.budgetCeiling}
          department={editDepartment}
          isSubmitting={isEditDepartmentSubmitting}
          onOpenChange={(open) => {
            setIsEditDepartmentOpen(open);
            if (!open) {
              setEditDepartment(null);
            }
          }}
          onSubmit={handleDepartmentEditSubmit}
          open={isEditDepartmentOpen}
        />
      ) : null}

      <DashboardCategoryEditorDialog
        category={null}
        isAddItemPending={isCategoryAddItemPending}
        isSubmitting={isCreateCategorySubmitting}
        onAddItem={async (values, categoryId) => {
          if (categoryId) {
            openDashboardItemCreateDialog(categoryId);
            return;
          }

          if (!values) {
            return;
          }

          await handleCategoryAddItemFromCreate(values);
        }}
        onOpenChange={setIsCreateCategoryOpen}
        onSubmit={handleCategoryCreateSubmit}
        open={isCreateCategoryOpen}
      />

      <DashboardCategoryEditorDialog
        category={editCategory}
        isAddItemPending={false}
        isSubmitting={isEditCategorySubmitting}
        onAddItem={async (_, categoryId) => {
          openDashboardItemCreateDialog(categoryId);
        }}
        onOpenChange={(open) => {
          setIsEditCategoryOpen(open);
          if (!open) {
            setEditCategory(null);
          }
        }}
        onSubmit={handleCategoryEditSubmit}
        open={isEditCategoryOpen}
      />

      <DashboardItemEditorDialog
        categories={dashboardItemCategories}
        initialCategoryId={itemDialogCategoryId}
        isSubmitting={isCreateItemSubmitting}
        onOpenChange={(open) => {
          setIsCreateItemOpen(open);
          if (!open) {
            setItemCategoryOverride(null);
          }
        }}
        onSubmit={handleDashboardItemCreateSubmit}
        open={isCreateItemOpen}
      />

      <DashboardConfirmDialog
        body={
          deleteCategoryTarget?.deleteBlockerMessages.length
            ? deleteCategoryTarget.deleteBlockerMessages.join(" ")
            : "This permanently removes the category from the procurement catalog."
        }
        confirmLabel="Delete category"
        description={
          deleteCategoryTarget
            ? `Delete ${deleteCategoryTarget.name} from the dashboard catalog.`
            : "Delete the selected category."
        }
        isPending={isDeleteCategorySubmitting}
        onConfirm={() => {
          void handleCategoryDeleteConfirm();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCategoryTarget(null);
          }
        }}
        open={Boolean(deleteCategoryTarget)}
        title={
          deleteCategoryTarget
            ? `Delete ${deleteCategoryTarget.name}?`
            : "Delete category?"
        }
      />

      {/* Workspace modal */}
      <WorkspaceModal
        activeModal={activeModal}
        selectedFiscalYear={selectedFiscalYear}
        onSelectedFiscalYearChange={replaceSelectedFiscalYear}
        onClose={() => setWorkspaceModal(null, "replace")}
      />
    </div>
  );
}

/* ─── Organization summary pill ───────────────────────────────────── */

function OrganizationStatPill({
  card,
  icon,
  tone,
}: {
  card: ProcurementOfficerDashboardSummaryCard;
  icon: React.ReactNode;
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

function OverviewSignalRow({
  card,
  icon,
  tone,
}: {
  card: ProcurementOfficerDashboardSummaryCard;
  icon: React.ReactNode;
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

/* ─── Mini stat cell ──────────────────────────────────────────────── */

function CategoryManagementRow({
  category,
  density,
  onDelete,
  onEdit,
}: {
  category: DashboardCategoryWorkspaceData["rows"][number];
  density: "compact" | "comfortable";
  onDelete: (category: DashboardCategoryWorkspaceData["rows"][number]) => void;
  onEdit: (category: DashboardCategoryWorkspaceData["rows"][number]) => void;
}) {
  const iconOption =
    getCategoryIconOption(category.icon) ?? getDefaultCategoryIconOption();
  const Icon = iconOption.icon;
  const preview = buildCategoryToolboxStyle({
    color: category.color ?? "",
    icon: category.icon ?? undefined,
  }).preview;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background",
        density === "compact" ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl text-white",
            density === "compact" ? "h-8 w-8" : "h-9 w-9",
          )}
          style={{ backgroundColor: preview.color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "truncate font-medium text-foreground",
              density === "compact" ? "text-sm" : "text-[15px]",
            )}
          >
            {category.name}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border border-border/60 bg-muted/35 text-muted-foreground",
            density === "compact"
              ? "px-2.5 py-1 text-[11px]"
              : "px-3 py-1 text-[12px]",
          )}
        >
          {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
        </span>
        <Button
          aria-label={`Edit ${category.name}`}
          className={cn(
            "border-border/60 bg-background hover:border-primary/30 hover:bg-primary/5",
            density === "compact"
              ? "h-8 w-8 rounded-lg p-0"
              : "h-9 w-9 rounded-xl p-0",
          )}
          onClick={() => onEdit(category)}
          size="sm"
          type="button"
          variant="outline"
        >
          <PencilLine className="h-4 w-4" />
        </Button>
        <Button
          aria-label={`Delete ${category.name}`}
          className={cn(
            "border-border/60 bg-background",
            category.canDelete
              ? "text-rose-500 hover:border-rose-300/60 hover:bg-rose-500/10 hover:text-rose-500"
              : "text-muted-foreground hover:text-muted-foreground",
            density === "compact"
              ? "h-8 w-8 rounded-lg p-0"
              : "h-9 w-9 rounded-xl p-0",
          )}
          onClick={() => onDelete(category)}
          size="sm"
          title={
            category.canDelete
              ? `Delete ${category.name}`
              : category.deleteBlockerMessages[0] ??
                "Category cannot be deleted."
          }
          type="button"
          variant="outline"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DashboardCategoryEditorDialog({
  category,
  isAddItemPending,
  isSubmitting,
  onAddItem,
  onOpenChange,
  onSubmit,
  open,
}: {
  category: DashboardCategoryWorkspaceData["rows"][number] | null;
  isAddItemPending: boolean;
  isSubmitting: boolean;
  onAddItem: (
    values: CategoryFormData | null,
    categoryId: string | null,
  ) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CategoryFormData) => Promise<void>;
  open: boolean;
}) {
  const router = useRouter();
  const archiveItem = useMutation(api.functions.items.archiveItem);
  const form = useForm<
    { color?: string; description?: string; icon?: string; name: string },
    unknown,
    CategoryFormData
  >({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      color: category?.color ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "",
      name: category?.name ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      color: category?.color ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "",
      name: category?.name ?? "",
    });
  }, [category, form, open]);
  const categoryItems = useQuery(
    api.functions.items.browseItemsCatalog,
    category?.id
      ? {
          categoryIds: [category.id],
          complianceFlags: [],
          maxPrice: undefined,
          minPrice: undefined,
          page: 1,
          pageSize: 100,
          searchText: "",
        }
      : "skip",
  ) as DashboardCategoryItemsBrowseData | undefined;
  const [archiveTarget, setArchiveTarget] =
    useState<ProcurementItemWorkspaceRow | null>(null);
  const [isArchivingItem, setIsArchivingItem] = useState(false);

  async function handleArchiveItem(): Promise<void> {
    if (!archiveTarget) {
      return;
    }

    setIsArchivingItem(true);
    try {
      await archiveItem({
        expectedRevision: archiveTarget.revision,
        itemId: archiveTarget.id as never,
      });
      toast.success("Item archived.");
      setArchiveTarget(null);
    } catch (error) {
      if (isProcurementItemCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setArchiveTarget(null);
        router.replace(getProcurementItemCrudRecoveryHref());
        return;
      }

      toast.error(getProcurementItemCrudErrorMessage(error));
    } finally {
      setIsArchivingItem(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setArchiveTarget(null);
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[min(96vw,72rem)] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-12 sm:pr-14">
            <div className="space-y-1.5">
              <DialogTitle>
                {category ? `Edit ${category.name}` : "Create category"}
              </DialogTitle>
              <DialogDescription>
                {category
                  ? "Update the category details used across the procurement dashboard."
                  : "Add a new category to the procurement dashboard catalog."}
              </DialogDescription>
              {category?.planningImpactWarning ? (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="inline-flex w-fit cursor-help items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 transition hover:border-amber-400/60 hover:bg-amber-500/15 dark:border-amber-300/60 dark:text-amber-100"
                        type="button"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Active plan warning
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      align="start"
                      className="max-w-sm border-amber-300/30 bg-slate-950 text-slate-50"
                      side="bottom"
                    >
                      <p className="text-sm leading-5">
                        {category.planningImpactWarning}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-xl"
              disabled={isSubmitting || isAddItemPending}
              onClick={() => {
                if (category?.id) {
                  void onAddItem(null, category.id);
                  return;
                }

                void form.handleSubmit(async (values) => {
                  await onAddItem(values, null);
                })();
              }}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              {isAddItemPending ? "Preparing..." : "Add item"}
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event);
            }}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category name</FormLabel>
                  <FormControl>
                    <Input placeholder="Stationery" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional guidance for procurement operators."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="#4A90D9"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getCategoryIconOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/15">
              <div className="border-b border-border/60 px-4 py-3">
                <div className="text-sm font-semibold text-foreground">
                  Current Items in Category
                </div>
              </div>
              {category?.id ? (
                categoryItems?.rows.length ? (
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryItems.rows.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-foreground">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.unitOfMeasurement ?? "Not set"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatKesAmount(item.unitPrice ?? 0)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.procurementMethod ?? "Not set"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.sourceOfFunds ?? "Not set"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                  aria-label={`Archive ${item.name}`}
                                  onClick={() => setArchiveTarget(item)}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No items in this category yet. Use <span className="font-medium text-foreground">Add item</span> to create the first one.
                  </div>
                )
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Items will appear here after the category is created.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : category
                    ? "Save changes"
                    : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <DashboardConfirmDialog
          body="This archives the item from the live procurement catalog for this category."
          confirmLabel="Archive item"
          description={
            archiveTarget
              ? `Archive ${archiveTarget.name} from this category.`
              : "Archive the selected item."
          }
          isPending={isArchivingItem}
          onConfirm={() => {
            void handleArchiveItem();
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setArchiveTarget(null);
            }
          }}
          open={Boolean(archiveTarget)}
          title={
            archiveTarget
              ? `Archive ${archiveTarget.name}?`
              : "Archive item?"
          }
        />
      </DialogContent>
    </Dialog>
  );
}

function DashboardItemEditorDialog(props: {
  categories: DashboardItemCategoryOption[];
  initialCategoryId: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ItemFormData) => Promise<void>;
  open: boolean;
}) {
  const form = useForm<
    {
      categoryId: string;
      complianceFlags: string[];
      customUnit?: string;
      maxQuantity?: number;
      minQuantity?: number;
      name: string;
      procurementMethod?: string;
      sourceOfFunds?: string;
      unit: string;
      unitPrice: number;
    },
    unknown,
    ItemFormData
  >({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      categoryId: props.initialCategoryId,
      complianceFlags: [],
      customUnit: "",
      maxQuantity: undefined,
      minQuantity: undefined,
      name: "",
      procurementMethod: "RFQ",
      sourceOfFunds: "GOK",
      unit: "each",
      unitPrice: 0,
    },
  });

  useEffect(() => {
    if (!props.open) {
      return;
    }

    form.reset({
      categoryId: props.initialCategoryId,
      complianceFlags: [],
      customUnit: "",
      maxQuantity: undefined,
      minQuantity: undefined,
      name: "",
      procurementMethod: "RFQ",
      sourceOfFunds: "GOK",
      unit: "each",
      unitPrice: 0,
    });
  }, [form, props.initialCategoryId, props.open]);

  const watchedCategoryId = form.watch("categoryId");
  const watchedUnit = form.watch("unit");
  const selectedCategory =
    props.categories.find((category) => category.id === watchedCategoryId) ?? null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[min(96vw,52rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add catalog item</DialogTitle>
          <DialogDescription>
            Add an item to the live procurement catalog and attach it to the right
            category immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit(props.onSubmit)(event);
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {props.categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Laptop Computer Core i7" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROCUREMENT_ITEM_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        onChange={(event) =>
                          field.onChange(event.target.valueAsNumber)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="procurementMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proc Method</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "RFQ"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROCUREMENT_ITEM_PROCUREMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {watchedUnit === "custom" ? (
              <FormField
                control={form.control}
                name="customUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Unit</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="service"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="sourceOfFunds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Of Funds</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="GOK"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? undefined
                              : event.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? undefined
                              : event.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedCategory?.limit.atLimit ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                This category is already at its active-item cap for the current
                plan tier.
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => props.onOpenChange(false)}
                disabled={props.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  props.isSubmitting ||
                  props.categories.length === 0 ||
                  selectedCategory?.limit.atLimit
                }
              >
                {props.isSubmitting ? "Saving..." : "Create item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DashboardConfirmDialog(props: {
  body: string;
  confirmLabel: string;
  description: string;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
          {props.body}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={props.isPending}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatKesAmount(amount: number): string {
  return `KES ${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

function MiniStat({
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

/* ─── Workflow panel button ───────────────────────────────────────── */

function OverviewMetric({
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

function OverviewActionButton({
  icon,
  label,
  meta,
  onClick,
}: {
  icon: React.ReactNode;
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

function WorkflowPanelButton({
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

/* ─── Department Readiness Row ────────────────────────────────────── */

function DepartmentReadinessRow({
  item,
  onManageDepartment,
}: {
  item: ProcurementOfficerDashboardDepartmentReadinessItem;
  onManageDepartment: () => void;
}) {
  return (
    <tr className="transition hover:bg-muted/20">
      <td className="border-b border-border/50 px-3 py-3 text-left">
        <div>
          <div className="text-[13px] font-semibold text-foreground">
            {item.name}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {item.blockerSummary}
          </div>
        </div>
      </td>
      <td className="border-b border-border/50 px-3 py-3 text-left">
        <span className="inline-flex rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground">
          {item.voteNumber || "--"}
        </span>
      </td>
      <td className="border-b border-border/50 px-3 py-3 text-left">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              item.budgetStatus.state === "available" && "bg-emerald-500",
              item.budgetStatus.state === "setup_required" && "bg-rose-500",
              (item.budgetStatus.state === "empty" ||
                item.budgetStatus.state === "unavailable") &&
                "bg-muted-foreground/50",
            )}
          />
          <span className="text-[12px] font-medium text-foreground">
            {item.budgetStatus.label}
          </span>
        </div>
      </td>
      <td className="border-b border-border/50 px-3 py-3 text-right">
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-9 rounded-xl border-border/60 bg-background p-0 hover:border-primary/30 hover:bg-primary/5"
          aria-label={`Manage ${item.name}`}
          onClick={onManageDepartment}
          type="button"
        >
          <PencilLine className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

/* ─── Workspace Modal ─────────────────────────────────────────────── */

function WorkspaceModal({
  activeModal,
  selectedFiscalYear,
  onSelectedFiscalYearChange,
  onClose,
}: {
  activeModal: ProcurementOfficerWorkspaceModalState | null;
  selectedFiscalYear?: string;
  onSelectedFiscalYearChange: (fiscalYear: string) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      open={Boolean(activeModal)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-4xl overflow-hidden border-border/70 p-0 sm:rounded-[28px]">
        <div className="border-b border-border/70 bg-muted/35 px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {activeModal ? (
                  getWorkspaceIcon(activeModal.modal)
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-primary/20 bg-primary/10 text-primary"
              >
                Procurement workspace
              </Badge>
            </div>
            <DialogTitle className="text-2xl tracking-[-0.04em] text-foreground">
              {getWorkspaceTitle(activeModal)}
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-7 text-muted-foreground">
              {getWorkspaceDescription(activeModal)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          {activeModal?.modal === "requests" ? (
            <ProcurementOfficerRequestsWorkspace />
          ) : null}

          {activeModal?.modal === "submissions" ? (
            <ProcurementOfficerSubmissionsWorkspace
              selectedFiscalYear={selectedFiscalYear}
            />
          ) : null}

          {activeModal?.modal === "access-codes" ? (
            <ProcurementOfficerAccessCodesWorkspace />
          ) : null}

          {activeModal?.modal === "deadlines" ? (
            <ProcurementOfficerDeadlinesWorkspace
              onSelectedFiscalYearChange={onSelectedFiscalYearChange}
              selectedFiscalYear={selectedFiscalYear}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Small sub-components ────────────────────────────────────────── */

/* ─── Skeleton ────────────────────────────────────────────────────── */

function ProcurementOfficerDashboardSkeleton() {
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

/* ─── Utilities ───────────────────────────────────────────────────── */

function findSummaryCard(
  cards: ProcurementOfficerDashboardSummaryCard[],
  id: ProcurementOfficerDashboardSummaryCard["id"],
) {
  return cards.find((c) => c.id === id);
}

function findFuturePanel(
  panels: ProcurementOfficerDashboardFuturePanel[],
  id: ProcurementOfficerDashboardFuturePanel["id"],
) {
  return panels.find((p) => p.id === id);
}

function getWorkspaceIcon(
  modal: ProcurementOfficerWorkspaceModalState["modal"],
) {
  switch (modal) {
    case "submissions":
      return <CheckCircle2 className="h-5 w-5" />;
    case "requests":
      return <FileStack className="h-5 w-5" />;
    case "access-codes":
      return <KeyRound className="h-5 w-5" />;
    case "deadlines":
      return <CalendarClock className="h-5 w-5" />;
  }
}

function getWorkspaceTitle(
  activeModal: ProcurementOfficerWorkspaceModalState | null,
): string {
  switch (activeModal?.modal) {
    case "submissions":
      return "Submission queue";
    case "requests":
      return "Requests workspace";
    case "access-codes":
      return "Access-code management";
    case "deadlines":
      return "Deadline readiness";
    default:
      return "Procurement workspace";
  }
}

function getWorkspaceDescription(
  activeModal: ProcurementOfficerWorkspaceModalState | null,
): string {
  switch (activeModal?.modal) {
    case "submissions":
      return "Track submitted, approved, and rejected departmental plans in one live queue, then hand each row into the reserved review route without leaving the /po shell.";
    case "requests":
      return "Review item and category requests, approve or deny with audit trails, and track history without leaving the /po shell.";
    case "access-codes":
      return "Access-code management now runs as a real dashboard workspace, so you can generate, rotate, deactivate, email, and review bounded login history without leaving the /po shell.";
    case "deadlines":
      return "Deadline warnings now resolve inside the dashboard, keeping fiscal-year signals, alerts, and department readiness in one flow.";
    default:
      return "Open a procurement workspace from the dashboard to continue operating inside the /po shell.";
  }
}

function humanizeState(state: ProcurementDashboardState): string {
  switch (state) {
    case "available":
      return "Ready";
    case "coming_soon":
      return "Coming soon";
    case "empty":
      return "Empty";
    case "setup_required":
      return "Setup required";
    default:
      return "Unavailable";
  }
}

function getInitials(value: string): string {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "PO";
}
