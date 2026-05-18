"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileStack,
  FolderTree,
  History,
  KeyRound,
  Layers3,
  MapPin,
  Plus,
  Users2,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { startTransition, useCallback, useEffect, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  buildProcurementOfficerWorkspaceModalPath,
  formatProcurementFiscalYearLabel,
  normalizeProcurementOfficerWorkspaceModalState,
  resolveProcurementOfficerWorkspaceNavigation,
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
  CATEGORY_NOT_FOUND_MESSAGE,
  getCategoryCrudErrorMessage,
  getCategoryCrudRecoveryHref,
  isCategoryCrudAuthorizationError,
  type CategoryIconName,
} from "@/lib/procurement-officer/categories";
import type {
  ProcurementOfficerDashboardDepartmentReadinessItem,
  ProcurementOfficerDashboardFuturePanel,
} from "@/lib/procurement-officer/dashboard-snapshot";
import { formatDeadlineCountdown } from "@/lib/procurement-officer/deadlines";
import {
  buildProcurementItemTierLimitState,
  getProcurementItemCrudErrorMessage,
  getProcurementItemCrudRecoveryHref,
  isProcurementItemCrudAuthorizationError,
} from "@/lib/procurement-officer/items";
import type { CategoryFormData } from "@/lib/validators/category";
import type { ItemFormData } from "@/lib/validators/item";
import { cn } from "@/lib/utils";
import {
  DepartmentFormDialog,
  type DepartmentFormDialogDepartment,
} from "./DepartmentFormDialog";
import {
  DeleteDepartmentDialog,
  type DeleteDepartmentDialogDepartment,
} from "./DeleteDepartmentDialog";
import { ProcurementOfficerPlanReviewSummaryModal } from "./ProcurementOfficerPlanReviewSummaryModal";
import { ProcurementOfficerSubmissionMonitoringWorkspace } from "./ProcurementOfficerSubmissionMonitoringWorkspace";
import { DashboardCategoryEditorDialog } from "./dashboard/category-editor-dialog";
import { CategoryManagementRow } from "./dashboard/category-management-row";
import { DashboardConfirmDialog } from "./dashboard/confirm-dialog";
import { DepartmentReadinessRow } from "./dashboard/department-readiness-row";
import { DashboardItemEditorDialog } from "./dashboard/item-editor-dialog";
import {
  BentoCard,
  DonutRing,
  IconBox,
  MiniStat,
  OrganizationStatPill,
  OverviewActionButton,
  OverviewMetric,
  ProcurementOfficerDashboardSkeleton,
  StateBadge,
  WorkflowPanelButton,
} from "./dashboard/primitives";
import type {
  DashboardCategoryWorkspaceData,
  DashboardDepartmentWorkspaceData,
  DashboardDepartmentWorkspaceRow,
  DashboardItemCategoryOption,
  DashboardItemsWorkspaceData,
} from "./dashboard/types";
import {
  findFuturePanel,
  findSummaryCard,
  formatDashboardPermanentDeleteRecordSummary,
  getInitials,
} from "./dashboard/utilities";
import { WorkspaceModal } from "./dashboard/workspace-modal";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function DashboardStatusPill({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-sm">
      <span className="text-primary">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function ActivityRow({
  label,
  meta,
  timestamp,
}: {
  label: string;
  meta: string;
  timestamp: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 px-1 py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">
            {label}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {meta}
          </div>
        </div>
      </div>
      <div className="max-w-[12rem] shrink-0 truncate text-right text-[11px] text-muted-foreground">
        {timestamp}
      </div>
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
  const extendDepartmentSubmissionDeadline = useMutation(
    api.functions.departments.extendDepartmentSubmissionDeadline,
  );
  const deleteDepartment = useMutation(api.functions.departments.deleteDepartment);
  const hardDeleteArchivedDepartment = useMutation(
    api.functions.departments.hardDeleteArchivedDepartment,
  );
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
  const [isEditDepartmentDeadlineExtending, setIsEditDepartmentDeadlineExtending] =
    useState(false);
  const [deleteDepartmentTarget, setDeleteDepartmentTarget] =
    useState<DeleteDepartmentDialogDepartment | null>(null);
  const [isDeleteDepartmentOpen, setIsDeleteDepartmentOpen] = useState(false);
  const [isDeleteDepartmentSubmitting, setIsDeleteDepartmentSubmitting] =
    useState(false);
  const [hardDeleteDepartmentTarget, setHardDeleteDepartmentTarget] =
    useState<DashboardDepartmentWorkspaceRow | null>(null);
  const [isHardDeleteDepartmentOpen, setIsHardDeleteDepartmentOpen] =
    useState(false);
  const [isHardDeleteDepartmentSubmitting, setIsHardDeleteDepartmentSubmitting] =
    useState(false);
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

  const replaceSelectedFiscalYear = useCallback((nextFiscalYear: string): void => {
    if (
      searchParams.get(PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear) ===
      nextFiscalYear
    ) {
      return;
    }

    const nextSearchParams = setFiscalYearSearchParam(
      new URLSearchParams(searchParams.toString()),
      nextFiscalYear,
    );
    const query = nextSearchParams.toString();
    startTransition(() =>
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname),
    );
  }, [pathname, router, searchParams]);

  if (!snapshot) return <ProcurementOfficerDashboardSkeleton />;

  const activeModal = normalizeProcurementOfficerWorkspaceModalState({
    modal: searchParams.get("modal"),
    planId: searchParams.get("planId"),
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
  const approvedDepartmentCount =
    snapshot.submissionProgress.approvedDepartmentCount;
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
  const dashboardDepartmentRows = (
    departmentsWorkspace?.rows.map((department) => ({
      department,
      readiness: snapshot.departmentReadiness.items.find(
        (item) => item.id === department.id,
      ),
    })) ??
    snapshot.departmentReadiness.items.map((readiness) => ({
      department: null,
      readiness,
    }))
  ).slice(0, 6);

  function setWorkspaceModal(
    modalState: ProcurementOfficerWorkspaceModalState | null,
    historyMode: "push" | "replace",
  ) {
    const href = modalState
      ? buildProcurementOfficerWorkspaceModalPath(modalState, {
          dashboardSearchParams: searchParams,
        })
      : buildDashboardHref(selectedFiscalYear);
    if (typeof window !== "undefined") {
      if (historyMode === "push") {
        window.history.pushState(null, "", href);
      } else {
        window.history.replaceState(null, "", href);
      }
      return;
    }

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
      hasSentAccessCode: departmentRow.hasSentAccessCode,
      id: departmentRow.id,
      name: departmentRow.name,
      planningImpactWarning: departmentRow.planningImpactWarning,
      submissionEndsAt: departmentRow.submissionEndsAt,
      submissionStartsAt: departmentRow.submissionStartsAt,
      voteNumber: departmentRow.voteNumber,
      readinessPills: [
        {
          id: "access_code",
          label: "Department code",
          state: departmentRow.code ? "available" : "setup_required",
          value: departmentRow.code || "Setup required",
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

  function openDashboardDepartmentEditFromRow(
    departmentRow: DashboardDepartmentWorkspaceRow,
    item?: ProcurementOfficerDashboardDepartmentReadinessItem,
  ): void {
    if (departmentRow.isArchived) {
      return;
    }

    setEditDepartment({
      budgetAllocation: departmentRow.budgetAllocation,
      code: departmentRow.code,
      hasSentAccessCode: departmentRow.hasSentAccessCode,
      id: departmentRow.id,
      name: departmentRow.name,
      planningImpactWarning: departmentRow.planningImpactWarning,
      submissionEndsAt: departmentRow.submissionEndsAt,
      submissionStartsAt: departmentRow.submissionStartsAt,
      voteNumber: departmentRow.voteNumber,
      readinessPills: item
        ? [
            {
              id: "access_code",
              label: "Department code",
              state: departmentRow.code ? "available" : "setup_required",
              value: departmentRow.code || "Setup required",
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
          ]
        : undefined,
    });
    setIsEditDepartmentOpen(true);
  }

  function openDashboardDepartmentArchiveDialog(
    departmentRow: DashboardDepartmentWorkspaceRow,
  ): void {
    setDeleteDepartmentTarget({
      activeDepartmentUserEmails: departmentRow.activeDepartmentUserEmails,
      canDelete: departmentRow.canDelete,
      deleteBlockerMessages: departmentRow.deleteBlockerMessages,
      id: departmentRow.id,
      name: departmentRow.name,
    });
    setIsDeleteDepartmentOpen(true);
  }

  function openDashboardDepartmentHardDeleteDialog(
    departmentRow: DashboardDepartmentWorkspaceRow,
  ): void {
    setHardDeleteDepartmentTarget(departmentRow);
    setIsHardDeleteDepartmentOpen(true);
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

  async function handleDepartmentDeadlineExtendOneWeek(
    department: DepartmentFormDialogDepartment,
  ): Promise<void> {
    if (typeof department.submissionEndsAt !== "number") {
      toast.error("Set the shared submission deadline before extending a department.");
      return;
    }

    setIsEditDepartmentDeadlineExtending(true);
    try {
      await extendDepartmentSubmissionDeadline({
        departmentId: department.id as any,
        submissionEndsAt: department.submissionEndsAt + WEEK_MS,
      });
      toast.success("Department deadline extended by 1 week.");
      setEditDepartment(null);
      setIsEditDepartmentOpen(false);
    } catch (error) {
      if (isDepartmentCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setEditDepartment(null);
        setIsEditDepartmentOpen(false);
        router.replace(getDepartmentCrudRecoveryHref());
        return;
      }

      toast.error(getDepartmentCrudErrorMessage(error));
    } finally {
      setIsEditDepartmentDeadlineExtending(false);
    }
  }

  async function handleDepartmentArchive(): Promise<void> {
    if (!deleteDepartmentTarget) {
      return;
    }

    setIsDeleteDepartmentSubmitting(true);

    try {
      await deleteDepartment({
        departmentId: deleteDepartmentTarget.id as any,
      });
      toast.success("Department archived.");
      setDeleteDepartmentTarget(null);
      setIsDeleteDepartmentOpen(false);
    } catch (error) {
      if (isDepartmentCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setDeleteDepartmentTarget(null);
        setIsDeleteDepartmentOpen(false);
        router.replace(getDepartmentCrudRecoveryHref());
        return;
      }

      toast.error(getDepartmentCrudErrorMessage(error));
    } finally {
      setIsDeleteDepartmentSubmitting(false);
    }
  }

  async function handleDepartmentHardDelete(): Promise<void> {
    if (!hardDeleteDepartmentTarget) {
      return;
    }

    setIsHardDeleteDepartmentSubmitting(true);

    try {
      await hardDeleteArchivedDepartment({
        departmentId: hardDeleteDepartmentTarget.id as any,
      });
      toast.success("Archived department permanently deleted.");
      setHardDeleteDepartmentTarget(null);
      setIsHardDeleteDepartmentOpen(false);
    } catch (error) {
      if (isDepartmentCrudAuthorizationError(error)) {
        toast.error("Your access changed. Redirecting to refresh your workspace.");
        setHardDeleteDepartmentTarget(null);
        setIsHardDeleteDepartmentOpen(false);
        router.replace(getDepartmentCrudRecoveryHref());
        return;
      }

      toast.error(getDepartmentCrudErrorMessage(error));
    } finally {
      setIsHardDeleteDepartmentSubmitting(false);
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
                        Department Readiness
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

                {dashboardDepartmentRows.length === 0 ? (
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
                        {dashboardDepartmentRows.map(({ department, readiness }, index) => (
                            <DepartmentReadinessRow
                              key={department?.id ?? readiness?.id ?? index}
                              department={department}
                              item={readiness}
                              showCoverage
                              onArchiveDepartment={
                                department
                                  ? () => openDashboardDepartmentArchiveDialog(department)
                                  : undefined
                              }
                              onDeleteDepartment={
                                department
                                  ? () => openDashboardDepartmentHardDeleteDialog(department)
                                  : undefined
                              }
                              onManageDepartment={() =>
                                department
                                  ? openDashboardDepartmentEditFromRow(
                                      department,
                                      readiness,
                                    )
                                  : openDashboardDepartmentEditDialog(readiness)
                              }
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
                {requestPanel ? (
                  <StateBadge
                    state={requestPanel.state}
                    label={requestPanel.statusLabel}
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
                    {[requestPanel]
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

                {/* Department codes quick link */}
                <div className="mt-auto rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-amber-300/70 bg-amber-200 text-amber-950 shadow-sm dark:border-amber-300/25 dark:bg-amber-400/20 dark:text-amber-50">
                        <KeyRound className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[12px] font-semibold text-foreground">
                        Department Codes
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                      onClick={() => handleWorkspaceAction("/po/departments")}
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Overview
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Monitor procurement readiness, department performance, and upcoming deadlines.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <DashboardStatusPill
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                label={fiscalYearLabel}
              />
              <DashboardStatusPill
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label={`${approvedDepartmentCount}/${submittedDepartmentScope} approved`}
              />
              <DashboardStatusPill
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label={requestPanel?.statusLabel ?? "No pending"}
              />
              <DashboardStatusPill
                icon={<Building2 className="h-3.5 w-3.5" />}
                label={snapshot.fiscalYears.state === "available" ? "Online" : "Setup required"}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,2fr)]">
            <BentoCard glowColor="primary">
              <div className="flex h-full flex-col justify-between gap-5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <IconBox tone="primary">
                      <Layers3 className="h-4 w-4" />
                    </IconBox>
                    <span className="text-[15px] font-bold text-foreground">
                      Master Plan Progress
                    </span>
                  </div>
                  <StateBadge state={snapshot.hero.state} />
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                        Current fiscal year
                      </div>
                      <div className="text-[15px] font-black tracking-[-0.03em] text-foreground">
                        {fiscalYearLabel} Master Plan
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {submittedDepartmentCount} submitted •{" "}
                        {approvedDepartmentCount} approved out of{" "}
                        {submittedDepartmentScope} departments
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black tracking-[-0.07em] text-primary">
                        {submissionPercent}%
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Approved
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
                  <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">
                    {submissionHelperText}
                  </p>
                  <Button
                    className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                    onClick={() => handleWorkspaceAction("/po/consolidation")}
                    type="button"
                  >
                    Open consolidation hub
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
                  <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2">
                    {departmentsConfiguredCard ? (
                      <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/25 px-2.5 py-1 text-[10px] font-semibold text-foreground">
                        <Building2 className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">Departments</span>
                        <span>{departmentsConfiguredCard.value}</span>
                      </div>
                    ) : null}
                    {accessCodeCard ? (
                      <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/25 px-2.5 py-1 text-[10px] font-semibold text-foreground">
                        <KeyRound className="h-3 w-3 text-amber-500" />
                        <span className="text-muted-foreground">Codes</span>
                        <span>{accessCodeCard.value}</span>
                      </div>
                    ) : null}
                    {deadlineCard ? (
                      <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/25 px-2.5 py-1 text-[10px] font-semibold text-foreground">
                        <CalendarClock className="h-3 w-3 text-emerald-500" />
                        <span className="text-muted-foreground">Deadline</span>
                        <span>{(liveDeadlineCard ?? deadlineCard).value}</span>
                      </div>
                    ) : null}
                    <StateBadge
                      state={snapshot.fiscalYears.state}
                      label={
                        snapshot.fiscalYears.state === "available"
                          ? fiscalYearLabel
                          : "Not configured"
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
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

                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3.5">
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

                  <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-2">
                    <OverviewActionButton
                      icon={
                        <IconBox tone="amber">
                          <KeyRound className="h-4 w-4" />
                        </IconBox>
                      }
                      label="Department Management"
                      meta="Manage department codes and settings"
                      onClick={() => handleWorkspaceAction("/po/departments")}
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
                      label="Manage Deadlines"
                      meta="View and update shared deadlines"
                      onClick={() => handleWorkspaceAction("/po/deadlines")}
                    />
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
                        Department Readiness
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

              {dashboardDepartmentRows.length === 0 ? (
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
                        {["Department", "Code", "Budget status", "Coverage", "Actions"].map(
                          (heading, index) => (
                            <th
                              key={heading}
                              className={cn(
                                "border-b border-border/60 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground",
                                index === 0 && "text-left",
                                index === 1 && "text-left",
                                index === 2 && "text-left",
                                index === 4 && "text-right",
                              )}
                            >
                              {heading}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardDepartmentRows.map(({ department, readiness }, index) => (
                          <DepartmentReadinessRow
                            key={department?.id ?? readiness?.id ?? index}
                            department={department}
                            item={readiness}
                            showCoverage
                            onArchiveDepartment={
                              department
                                ? () => openDashboardDepartmentArchiveDialog(department)
                                : undefined
                            }
                            onDeleteDepartment={
                              department
                                ? () => openDashboardDepartmentHardDeleteDialog(department)
                                : undefined
                            }
                            onManageDepartment={() =>
                              department
                                ? openDashboardDepartmentEditFromRow(
                                    department,
                                    readiness,
                                  )
                                : openDashboardDepartmentEditDialog(readiness)
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
                    Submission Monitoring
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {submissionPanel ? (
                    <StateBadge
                      state={submissionPanel.state}
                      label={submissionPanel.statusLabel}
                    />
                  ) : null}
                </div>
              </div>
              <div className="p-5">
                <ProcurementOfficerSubmissionMonitoringWorkspace
                  selectedFiscalYear={selectedFiscalYear}
                />
              </div>
            </BentoCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.95fr)_minmax(300px,0.95fr)_minmax(300px,1.05fr)]">
            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <IconBox tone="amber">
                    <AlertTriangle className="h-4 w-4" />
                  </IconBox>
                  <span className="text-[15px] font-bold text-foreground">
                    Requests
                  </span>
                </div>
                {requestPanel ? (
                  <StateBadge
                    state={requestPanel.state}
                    label={requestPanel.statusLabel}
                  />
                ) : null}
              </div>
              <div className="grid gap-2.5 p-4">
                {snapshot.alerts.length > 0 ? (
                  snapshot.alerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_auto] items-center gap-3 border-b border-border/50 px-1 py-2.5 text-[12px] last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">
                          {alert.title}
                        </div>
                        <div className="truncate text-muted-foreground">
                          {alert.message}
                        </div>
                      </div>
                      <div className="truncate text-muted-foreground">
                        {alert.cta.label}
                      </div>
                      <StateBadge state={alert.cta.state} label="Open" />
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-7 text-sm text-muted-foreground">
                    {requestPanel?.description ??
                      "No request activity is available yet for the selected fiscal year."}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="h-9 rounded-lg text-xs"
                  onClick={() => handleWorkspaceAction("/po/requests")}
                  type="button"
                >
                  View all requests
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
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
              <div className="p-4">
                <div>
                  {hasCategories ? (
                    <div className="space-y-2.5">
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
                <Button
                  className="mt-3 h-9 w-full rounded-lg text-xs"
                  onClick={() => handleWorkspaceAction("/po/items")}
                  type="button"
                  variant="outline"
                >
                  View all categories
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </div>
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <IconBox tone="emerald">
                    <History className="h-4 w-4" />
                  </IconBox>
                  <span className="text-[15px] font-bold text-foreground">
                    Recent Activity
                  </span>
                </div>
                <Button
                  className="h-8 rounded-lg text-xs"
                  disabled
                  type="button"
                  variant="outline"
                >
                  View all
                </Button>
              </div>
              <div className="grid gap-1 p-4">
                <ActivityRow
                  label="Master plan progress updated"
                  meta={fiscalYearLabel}
                  timestamp={snapshot.submissionProgress.helperText}
                />
                <ActivityRow
                  label={`${approvedDepartmentCount} departments approved`}
                  meta={`${submittedDepartmentCount} submitted`}
                  timestamp={snapshot.deadlineOverview.countdownLabel}
                />
                {snapshot.alerts.length > 0 ? (
                  snapshot.alerts.slice(0, 2).map((alert) => (
                    <ActivityRow
                      key={alert.id}
                      label={alert.title}
                      meta={alert.cta.label}
                      timestamp={alert.message}
                    />
                  ))
                ) : (
                  <ActivityRow
                    label="No pending operational alerts"
                    meta="System status"
                    timestamp="Online"
                  />
                )}
              </div>
            </BentoCard>
          </div>
        </div>
      </div>

      {departmentsWorkspace ? (
        <DepartmentFormDialog
          activeDepartments={departmentsWorkspace.rows
            .filter((row) => !row.isArchived)
            .map((row) => ({
              budgetAllocation: row.budgetAllocation,
              id: row.id,
            }))}
          budgetCeiling={departmentsWorkspace.meta.budgetCeiling}
          department={null}
          isSubmitting={isCreateDepartmentSubmitting}
          onOpenChange={setIsCreateDepartmentOpen}
          onSubmit={handleDepartmentCreateSubmit}
          open={isCreateDepartmentOpen}
          selectedFiscalYear={selectedFiscalYear}
          timeZone={departmentsWorkspace.meta.timeZone}
        />
      ) : null}

      {departmentsWorkspace ? (
        <DepartmentFormDialog
          activeDepartments={departmentsWorkspace.rows
            .filter((row) => !row.isArchived)
            .map((row) => ({
              budgetAllocation: row.budgetAllocation,
              id: row.id,
            }))}
          budgetCeiling={departmentsWorkspace.meta.budgetCeiling}
          department={editDepartment}
          isExtendingDeadline={isEditDepartmentDeadlineExtending}
          isSubmitting={isEditDepartmentSubmitting}
          onExtendDeadlineOneWeek={handleDepartmentDeadlineExtendOneWeek}
          onOpenChange={(open) => {
            setIsEditDepartmentOpen(open);
            if (!open) {
              setEditDepartment(null);
            }
          }}
          onSubmit={handleDepartmentEditSubmit}
          open={isEditDepartmentOpen}
          selectedFiscalYear={selectedFiscalYear}
          timeZone={departmentsWorkspace.meta.timeZone}
        />
      ) : null}

      <DeleteDepartmentDialog
        department={deleteDepartmentTarget}
        isDeleting={isDeleteDepartmentSubmitting}
        onConfirm={handleDepartmentArchive}
        onOpenChange={(open) => {
          setIsDeleteDepartmentOpen(open);
          if (!open) {
            setDeleteDepartmentTarget(null);
          }
        }}
        open={isDeleteDepartmentOpen}
      />

      <Dialog
        open={isHardDeleteDepartmentOpen}
        onOpenChange={(open) => {
          setIsHardDeleteDepartmentOpen(open);
          if (!open) {
            setHardDeleteDepartmentTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {hardDeleteDepartmentTarget
                ? `Permanently delete ${hardDeleteDepartmentTarget.name}?`
                : "Permanently delete department?"}
            </DialogTitle>
            <DialogDescription>
              This hard deletes the archived department, its plans, department code records,
              Departmental User profiles, and related department records.
            </DialogDescription>
          </DialogHeader>
          {hardDeleteDepartmentTarget ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formatDashboardPermanentDeleteRecordSummary(
                hardDeleteDepartmentTarget.permanentDeleteRecordCounts,
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isHardDeleteDepartmentSubmitting}
              onClick={() => setIsHardDeleteDepartmentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isHardDeleteDepartmentSubmitting}
              onClick={() => void handleDepartmentHardDelete()}
            >
              {isHardDeleteDepartmentSubmitting
                ? "Deleting..."
                : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        activeModal={activeModal?.modal === "review" ? null : activeModal}
        selectedFiscalYear={selectedFiscalYear}
        onSelectedFiscalYearChange={replaceSelectedFiscalYear}
        onClose={() => setWorkspaceModal(null, "replace")}
      />
      <ProcurementOfficerPlanReviewSummaryModal
        onClose={() => setWorkspaceModal(null, "replace")}
        open={activeModal?.modal === "review"}
        planId={activeModal?.modal === "review" ? activeModal.planId : null}
      />
    </div>
  );
}
