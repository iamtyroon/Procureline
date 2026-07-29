"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, CheckCircle2, Plus } from "lucide-react";
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
import {
  buildProcurementOfficerWorkspaceModalPath,
  formatProcurementFiscalYearLabel,
  normalizeProcurementOfficerWorkspaceModalState,
  resolveProcurementOfficerWorkspaceNavigation,
  type ProcurementOfficerWorkspaceModalState,
} from "@/lib/procurement-officer/dashboard";
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
import { DashboardItemEditorDialog } from "./dashboard/item-editor-dialog";
import {
  BentoCard,
  ProcurementOfficerDashboardSkeleton,
  StateBadge,
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
} from "./dashboard/utilities";
import { WorkspaceModal } from "./dashboard/workspace-modal";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function QuietStat({
  label,
  meta,
  value,
}: {
  label: string;
  meta?: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 px-4 py-3.5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      {meta ? (
        <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function QuickLinkTile({
  label,
  meta,
  onClick,
}: {
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-card/60 px-4 py-3.5 text-left transition hover:border-primary/30 hover:bg-primary/5"
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {meta}
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </button>
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

  const closeAllLocalDialogs = useCallback((): void => {
    setIsCreateDepartmentOpen(false);
    setIsCreateCategoryOpen(false);
    setIsCreateItemOpen(false);
    setItemCategoryOverride(null);
    setIsEditDepartmentOpen(false);
    setEditDepartment(null);
    setIsDeleteDepartmentOpen(false);
    setDeleteDepartmentTarget(null);
    setIsHardDeleteDepartmentOpen(false);
    setHardDeleteDepartmentTarget(null);
    setIsEditCategoryOpen(false);
    setEditCategory(null);
    setDeleteCategoryTarget(null);
  }, []);

  const activeModalParam = searchParams.get("modal");

  useEffect(() => {
    if (activeModalParam) {
      closeAllLocalDialogs();
    }
  }, [activeModalParam, closeAllLocalDialogs]);

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
  const requestPanel = findFuturePanel(snapshot.futurePanels, "request_inbox");
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
  const submittedDepartmentCount =
    snapshot.submissionProgress.submittedDepartmentCount;
  const approvedDepartmentCount =
    snapshot.submissionProgress.approvedDepartmentCount;
  const submittedDepartmentScope = snapshot.submissionProgress.totalDepartmentCount;
  const submissionPercent = snapshot.submissionProgress.utilizationPercent;
  const submissionHelperText = snapshot.submissionProgress.helperText;
  const organizationBudget = snapshot.organizationOverview.budget;
  const otherFiscalYears = snapshot.fiscalYears.options.filter(
    (y) => y !== snapshot.fiscalYears.selectedFiscalYear,
  );
  const allPlansApproved =
    submittedDepartmentScope > 0 &&
    approvedDepartmentCount === submittedDepartmentScope;
  const heroHeadline = allPlansApproved
    ? `${fiscalYearLabel} is fully approved and ready to consolidate`
    : submittedDepartmentCount === 0
      ? `Waiting on department submissions for ${fiscalYearLabel}`
      : `${approvedDepartmentCount} of ${submittedDepartmentScope} department plans approved so far`;

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
    closeAllLocalDialogs();
    setWorkspaceModal(target.modalState, "push");
  }

  function isWorkspaceModalActive(): boolean {
    return typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).has("modal")
      : Boolean(activeModalParam);
  }

  function openDashboardDepartmentCreateDialog(): void {
    if (isWorkspaceModalActive()) {
      return;
    }
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
    if (isWorkspaceModalActive()) {
      return;
    }
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
    if (departmentRow.isArchived || isWorkspaceModalActive()) {
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
    if (isWorkspaceModalActive()) {
      return;
    }
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
    if (isWorkspaceModalActive()) {
      return;
    }
    setHardDeleteDepartmentTarget(departmentRow);
    setIsHardDeleteDepartmentOpen(true);
  }

  function handleManageDepartmentById(departmentId: string): void {
    const departmentRow = departmentsWorkspace?.rows.find(
      (row) => row.id === departmentId,
    );
    const readiness = snapshot?.departmentReadiness.items.find(
      (item) => item.id === departmentId,
    );
    if (departmentRow) {
      openDashboardDepartmentEditFromRow(departmentRow, readiness);
      return;
    }
    if (readiness) {
      openDashboardDepartmentEditDialog(readiness);
    }
  }

  function handleArchiveDepartmentById(departmentId: string): void {
    const departmentRow = departmentsWorkspace?.rows.find(
      (row) => row.id === departmentId,
    );
    if (!departmentRow) {
      toast.error("Department details are still loading. Try again.");
      return;
    }
    if (departmentRow.isArchived) {
      openDashboardDepartmentHardDeleteDialog(departmentRow);
    } else {
      openDashboardDepartmentArchiveDialog(departmentRow);
    }
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
    if (isWorkspaceModalActive()) {
      return;
    }
    setEditCategory(category);
    setIsEditCategoryOpen(true);
  }

  function openDashboardCategoryCreateDialog(): void {
    if (isWorkspaceModalActive()) {
      return;
    }
    setEditCategory(null);
    setIsEditCategoryOpen(false);
    setIsCreateCategoryOpen(true);
  }

  function requestDashboardCategoryDelete(
    category: DashboardCategoryWorkspaceData["rows"][number],
  ): void {
    if (isWorkspaceModalActive()) {
      return;
    }
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
    if (isWorkspaceModalActive()) {
      return;
    }
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

      <div className="hidden lg:block">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1440px] flex-col gap-4 px-4 py-5 xl:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Overview
              </h1>
              <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
                Monitor procurement readiness, department performance, and
                upcoming deadlines.
              </p>
            </div>
          </div>

          <BentoCard glowColor="primary">
            <div className="flex flex-col gap-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 max-w-2xl">
                  <div className="text-[12px] font-medium text-muted-foreground">
                    {fiscalYearLabel} master plan
                  </div>
                  <h2 className="mt-1 text-[22px] font-semibold leading-snug tracking-tight text-foreground [text-wrap:balance]">
                    {heroHeadline}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {submissionHelperText}
                  </p>
                </div>
                <Button
                  className="h-10 shrink-0 rounded-xl px-5 text-sm font-semibold"
                  onClick={() => handleWorkspaceAction("/po/consolidation")}
                  type="button"
                >
                  Open consolidation hub
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${Math.min(100, submissionPercent)}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
                  <span className="tabular-nums">
                    {approvedDepartmentCount} of {submittedDepartmentScope}{" "}
                    department plans approved · {submittedDepartmentCount}{" "}
                    submitted
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Other cycles</span>
                    {otherFiscalYears.length === 0 ? (
                      <span>none yet</span>
                    ) : (
                      otherFiscalYears.slice(0, 3).map((year) => (
                        <button
                          key={year}
                          className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
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
            </div>
          </BentoCard>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <QuietStat
              label="Departments"
              value={String(snapshot.organizationOverview.activeDepartmentCount)}
            />
            <QuietStat
              label="Active users"
              value={String(snapshot.organizationOverview.activeUserCount)}
            />
            <QuietStat
              label="Total items"
              value={String(snapshot.organizationOverview.totalItemCount)}
            />
            <QuietStat
              label="Budget used"
              value={
                organizationBudget.state === "available"
                  ? `${organizationBudget.utilizationPercent}%`
                  : "--"
              }
              meta={
                organizationBudget.state === "available"
                  ? `${organizationBudget.usedBudgetLabel} of ${organizationBudget.totalBudgetLabel}`
                  : "Budget not configured"
              }
            />
            <QuickLinkTile
              label="Department management"
              meta="Codes and settings"
              onClick={() => handleWorkspaceAction("/po/departments")}
            />
            <QuickLinkTile
              label="Deadlines"
              meta={(liveDeadlineCard ?? deadlineCard)?.value ?? "Not set"}
              onClick={() => handleWorkspaceAction("/po/deadlines")}
            />
          </div>

          <BentoCard>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-6 py-4">
              <div>
                <div className="text-[15px] font-semibold text-foreground">
                  Departments
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  {snapshot.departmentReadiness.summary}
                </div>
              </div>
              <Button
                className="h-8 rounded-lg text-xs"
                onClick={openDashboardDepartmentCreateDialog}
                type="button"
                variant="outline"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add department
              </Button>
            </div>
            <div className="px-6 py-4">
              <ProcurementOfficerSubmissionMonitoringWorkspace
                onArchiveDepartment={handleArchiveDepartmentById}
                onManageDepartment={handleManageDepartmentById}
                readinessItems={snapshot.departmentReadiness.items}
                selectedFiscalYear={selectedFiscalYear}
              />
            </div>
          </BentoCard>

          <div className="grid gap-4 xl:grid-cols-3">
            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                <span className="text-[15px] font-semibold text-foreground">
                  Requests
                </span>
                {requestPanel ? (
                  <StateBadge
                    state={requestPanel.state}
                    label={requestPanel.statusLabel}
                  />
                ) : null}
              </div>
              <div className="grid gap-2.5 p-5">
                {snapshot.alerts.length > 0 ? (
                  snapshot.alerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between gap-3 border-b border-border/40 py-2.5 text-[12px] last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {alert.title}
                        </div>
                        <div className="truncate text-muted-foreground">
                          {alert.message}
                        </div>
                      </div>
                      <StateBadge state={alert.cta.state} label="Open" />
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-[13px] leading-6 text-muted-foreground">
                    No catalog requests yet. New item and category requests from
                    departments appear here.
                  </p>
                )}
                <Button
                  className="h-9 justify-start rounded-lg px-2 text-xs text-primary hover:text-primary"
                  onClick={() => handleWorkspaceAction("/po/requests")}
                  type="button"
                  variant="ghost"
                >
                  View all requests
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </div>
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                <span className="text-[15px] font-semibold text-foreground">
                  Categories
                </span>
                <Button
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={openDashboardCategoryCreateDialog}
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New
                </Button>
              </div>
              <div className="p-5">
                {hasCategories ? (
                  <div className="space-y-2.5">
                    {availableCategories.slice(0, 5).map((category) => (
                      <CategoryManagementRow
                        key={category.id}
                        category={category}
                        density="comfortable"
                        onDelete={requestDashboardCategoryDelete}
                        onEdit={openDashboardCategoryEditDialog}
                      />
                    ))}
                    {availableCategories.length > 5 ? (
                      <div className="pt-1 text-[12px] text-muted-foreground">
                        {availableCategories.length - 5} more categor
                        {availableCategories.length - 5 === 1 ? "y" : "ies"}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="py-3 text-[13px] leading-6 text-muted-foreground">
                    No categories yet. Create one to start building the shared
                    catalog.
                  </p>
                )}
                <Button
                  className="mt-2 h-9 justify-start rounded-lg px-2 text-xs text-primary hover:text-primary"
                  onClick={() => handleWorkspaceAction("/po/items")}
                  type="button"
                  variant="ghost"
                >
                  View all categories
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </div>
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                <span className="text-[15px] font-semibold text-foreground">
                  Recent activity
                </span>
              </div>
              <div className="grid gap-1 p-5">
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
                {snapshot.alerts.slice(0, 2).map((alert) => (
                  <ActivityRow
                    key={alert.id}
                    label={alert.title}
                    meta={alert.cta.label}
                    timestamp={alert.message}
                  />
                ))}
                <div className="pt-2 text-[11px] text-muted-foreground">
                  {snapshot.alerts.length === 0
                    ? "No pending operational alerts · system online"
                    : "System online"}
                </div>
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
