"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, FileDown, PackagePlus, Redo2, Save, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CatalogRequestDialog } from "@/src/components/blockly/CatalogRequestDialog";
import { BlocklyLoadingSkeleton } from "@/src/components/blockly/BlocklyLoadingSkeleton";
import type {
    BlocklyWorkspaceChangePayload,
    BlocklyWorkspaceHistoryState,
} from "@/src/components/blockly/BlocklyWorkspace";
import {
    areBlocklyWorkspaceJsonEquivalent,
    type BlocklyWorkspaceRecord,
} from "@/lib/shared/blockly/blockly-serialization";
import { getPersistedPlanSummaryForWorkspaceSummaryChange } from "@/lib/frontend/blockly/du-editor-fallback";
import { buildDepartmentUserToolbox } from "@/lib/frontend/blockly/du-toolbox";
import {
    calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord,
    getDepartmentUserWorkspaceAnnouncement,
    mapDepartmentUserBudgetMeterState,
    resolveDepartmentUserDisplayedWorkspaceSummary,
    type DepartmentUserBudgetMeterState,
    type DepartmentUserPersistedPlanSummary,
    type DepartmentUserWorkspaceSummary,
} from "@/lib/shared/blockly/du-workspace-calculations";
import {
    buildDepartmentUserPlanSubmissionReviewSummary,
    canDepartmentUserOpenPlanSubmissionReview,
    getDepartmentUserPlanSubmitState,
    type DepartmentUserPlanSubmissionFixTarget,
    type DepartmentUserPlanSubmissionIssue,
} from "@/lib/shared/blockly/plan-submission";
import { mapDepartmentUserFlaggedTargetsToIssues } from "@/lib/department-user/revision-feedback";
import { formatDeadlineDateTime } from "@/lib/procurement-officer/deadlines";
import { buildDepartmentUserWorkspaceDraftSaveInput } from "@/lib/shared/blockly/workspace-save";
import {
    collectDepartmentUserWorkspaceSourceUsage,
    type DepartmentUserWorkspaceSourceUsage,
} from "@/lib/shared/blockly/workspace-catalog-identity";
import {
    claimDepartmentUserWorkspaceSessionLease,
    clearDepartmentUserWorkspaceDraftState,
    coalesceDepartmentUserWorkspaceSnapshot,
    compareDepartmentUserWorkspaceRecoveryFreshness,
    createDepartmentUserWorkspaceLeaveGuardHistoryState,
    createClearedDepartmentUserWorkspaceRecord,
    createRecoveredDepartmentUserWorkspaceRecord,
    getDepartmentUserWorkspaceLeaveGuardHistoryAction,
    getDepartmentUserWorkspaceRecoveryMessage,
    getDepartmentUserWorkspaceSaveIndicatorLabel,
    hasCompetingDepartmentUserWorkspaceSession,
    parseDepartmentUserWorkspaceSaveFailure,
    readDepartmentUserWorkspaceDraftState,
    readDepartmentUserWorkspaceSessionLease,
    releaseDepartmentUserWorkspaceSessionLease,
    shouldInterceptDepartmentUserRouteNavigation,
    shouldWarnDepartmentUserBeforeLeave,
    upsertDepartmentUserWorkspaceQueuedSnapshot,
    upsertDepartmentUserWorkspaceRecoverySnapshot,
    type DepartmentUserWorkspaceSaveIndicatorState,
    type DepartmentUserWorkspaceStorageFailure,
} from "@/lib/frontend/blockly/workspace-draft-queue";
import {
    buildCatalogRequestStatusMeta,
    type CatalogCategoryRequestFormValues,
    type CatalogItemRequestFormValues,
} from "@/lib/procurement/catalog-requests";
import {
    PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE,
    PROCUREMENT_ITEM_VALIDATION_CHANGE_NOTICE,
    PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE,
} from "@/lib/procurement-officer/items";
import type { CategoryIconName } from "@/lib/procurement-officer/categories";
import styles from "./BlocklyWorkspace.module.css";

const LazyBlocklyWorkspace = dynamic(
    () =>
        import("./BlocklyWorkspace").then((module) => ({
            default: module.BlocklyWorkspace,
        })),
    {
        loading: () => <BlocklyLoadingSkeleton />,
        ssr: false,
    },
);

type PendingNavigationTarget =
    | {
          kind: "back";
      }
    | {
          href: string;
          kind: "href";
      };

type DepartmentUserCatalogRequestRecord = {
    canCancel: boolean;
    canEdit: boolean;
    categoryId?: string | null;
    categoryName?: string | null;
    categoryReferenceMode?: "existing" | "request";
    categoryRequest?: {
        description: string;
        id: string;
        justification: string;
        name: string;
        revision: number;
    } | null;
    createdAt: number;
    description: string;
    estimatedUnitPrice?: number;
    id: string;
    justification: string;
    linkedCategoryRequestId?: string | null;
    name: string;
    reason: string | null;
    revision: number;
    status: "approved" | "cancelled" | "denied" | "expired" | "pending";
    submittedAt: number;
    type: "category" | "item";
    updatedAt: number;
};

type DepartmentUserCatalogRequestData = {
    meta: {
        accessMode: "editable" | "read_only_grace" | null;
        canCreate: boolean;
    };
    requests: DepartmentUserCatalogRequestRecord[];
    summary: {
        pendingCategoryCount: number;
        pendingItemCount: number;
        totalCount: number;
        totalPendingCount: number;
    };
};

export function BlocklyEditor(props: {
    accessMode: "editable" | "read_only_grace" | null;
    actor: "department_user" | "procurement_officer";
    actorLabel: string;
    categories: Array<{
        color?: string | null;
        id: string;
        icon?: CategoryIconName | null;
        isActive: boolean;
        name: string;
        sortOrder: number;
    }>;
    department: {
        budgetAllocation: number | null;
        code: string;
        id: string;
        name: string;
        voteNumber: string;
    };
    currentUserId: string;
    fiscalYear: string;
    items: Array<{
        categoryId: string;
        complianceFlags?: readonly string[] | null;
        description: string | null;
        id: string;
        isActive: boolean;
        lastPriceChangedAt: number | null;
        maxQuantity: number | null;
        minQuantity: number | null;
        name: string;
        procurementMethod: string | null;
        sortOrder: number;
        sourceOfFunds: string | null;
        unitOfMeasurement: string | null;
        unitPrice: number | null;
    }>;
    mode: "edit" | "view";
    modeIndicatorLabel: string | null;
    planId: string;
    planMeta: {
        canWithdraw: boolean;
        reviewStartedAt: number | null;
        revisionContext: {
            activeDecision: null | {
                comment: string;
                decidedAt: number;
                decisionType: "approved" | "rejected" | "revision_requested";
                effectiveRevisionDeadlineAt: number | null;
                flaggedTargets: Array<{
                    categoryId: string;
                    id: string;
                    itemId: string | null;
                    label: string;
                    type: "category" | "item";
                }>;
                id: string;
                lifecycleStatus: "active" | "superseded" | "undone" | null;
                revisionDeadlineAt: number | null;
                submissionReference: string | null;
            };
            effectiveDeadlineExpired: boolean;
            history: Array<{
                detail: string;
                id: string;
                kind:
                    | "approved"
                    | "rejected"
                    | "revision_requested"
                    | "submitted"
                    | "withdrawn";
                timestamp: number | null;
                timestampLabel: string;
                title: string;
            }>;
            inconsistentStateMessage: string | null;
            reviewDecisions: Array<{
                comment: string;
                decidedAt: number;
                decisionType: "approved" | "rejected" | "revision_requested";
                effectiveRevisionDeadlineAt: number | null;
                flaggedTargets: Array<{
                    categoryId: string;
                    id: string;
                    itemId: string | null;
                    label: string;
                    type: "category" | "item";
                }>;
                id: string;
                lifecycleStatus: "active" | "superseded" | "undone" | null;
                revisionDeadlineAt: number | null;
                submissionReference: string | null;
            }>;
        } | null;
        status: "approved" | "draft" | "rejected" | "submitted";
        submissionEmailErrorMessage: string | null;
        submissionEmailStatus: "failed" | "queued" | null;
        submissionReference: string | null;
        submittedAt: number | null;
        timeZone: string;
    };
    persistedPlanSummary: DepartmentUserPersistedPlanSummary;
    selectedCategoryIds: string[];
    subtitle: string;
    unavailableCategories: Array<{
        id: string;
        name: string;
        reason: string;
    }>;
    workspaceState: BlocklyWorkspaceRecord | null;
}) {
    const router = useRouter();
    const saveWorkspaceDraft = useMutation(api.functions.plans.saveDepartmentUserWorkspaceDraft);
    const submitDepartmentUserPlan = useMutation(api.functions.plans.submitDepartmentUserPlan);
    const withdrawDepartmentUserPlanSubmission = useMutation(
        api.functions.plans.withdrawDepartmentUserPlanSubmission,
    );
    const createCategoryRequest = useAction(api.functions.catalogRequests.createCategoryRequest);
    const createItemRequest = useAction(api.functions.catalogRequests.createItemRequest);
    const updateCategoryRequest = useAction(api.functions.catalogRequests.updateCategoryRequest);
    const updateItemRequest = useAction(api.functions.catalogRequests.updateItemRequest);
    const catalogRequestData = useQuery(api.functions.catalogRequests.getDepartmentUserCatalogRequests, {
        planId: props.planId,
    }) as DepartmentUserCatalogRequestData | undefined;
    const [searchQuery, setSearchQuery] = useState("");
    const [activeWorkspaceState, setActiveWorkspaceState] = useState<BlocklyWorkspaceRecord | null>(
        props.workspaceState,
    );
    const [isCatalogRequestDialogOpen, setIsCatalogRequestDialogOpen] = useState(false);
    const [catalogRequestDialogTab, setCatalogRequestDialogTab] =
        useState<"category" | "item">("item");
    const [editingCatalogRequestId, setEditingCatalogRequestId] = useState<string | null>(null);
    const [workspaceMountKey, setWorkspaceMountKey] = useState(0);
    const [historyActionRequest, setHistoryActionRequest] = useState<{
        kind: "redo" | "undo";
        nonce: number;
    } | null>(null);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const initialSourceUsage = useMemo(
        () =>
            collectDepartmentUserWorkspaceSourceUsage({
                categories: props.categories.map((category) => ({
                    id: category.id,
                    name: category.name,
                })),
                items: props.items,
                workspaceState: activeWorkspaceState,
            }),
        [activeWorkspaceState, props.categories, props.items],
    );
    const [sourceUsage, setSourceUsage] = useState<DepartmentUserWorkspaceSourceUsage>(
        initialSourceUsage,
    );
    const toolbox = useMemo(
        () =>
            buildDepartmentUserToolbox({
                categories: props.categories,
                department: {
                    budgetAllocation: props.department.budgetAllocation,
                    departmentId: props.department.id,
                    departmentName: props.department.name,
                    voteNumber: props.department.voteNumber,
                },
                editorMode: props.mode,
                items: props.items,
                preserveUnavailableRequestedCategories: true,
                searchQuery: deferredSearchQuery,
                selectedCategoryIds: props.selectedCategoryIds,
                sourceUsage,
            }),
        [
            deferredSearchQuery,
            props.categories,
            props.department,
            props.items,
            props.mode,
            props.selectedCategoryIds,
            sourceUsage,
        ],
    );
    const initialSummary = useMemo(
        () =>
            calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
                items: props.items,
                totalBudget: props.department.budgetAllocation,
                workspaceState: activeWorkspaceState,
            }),
        [activeWorkspaceState, props.department.budgetAllocation, props.items],
    );
    const preferredInitialSummary = useMemo(
        () =>
            resolveDepartmentUserDisplayedWorkspaceSummary({
                persistedPlanSummary: props.persistedPlanSummary,
                totalBudget: props.department.budgetAllocation,
                workspaceState: activeWorkspaceState,
                workspaceSummary: initialSummary,
            }),
        [
            activeWorkspaceState,
            initialSummary,
            props.department.budgetAllocation,
            props.persistedPlanSummary,
        ],
    );
    const [workspaceSummary, setWorkspaceSummary] = useState<DepartmentUserWorkspaceSummary | null>(
        preferredInitialSummary,
    );
    const [budgetState, setBudgetState] = useState<DepartmentUserBudgetMeterState>(
        () =>
            preferredInitialSummary?.budgetState ??
            mapDepartmentUserBudgetMeterState({
                totalBudget: props.department.budgetAllocation,
                usedAmount: 0,
            }),
    );
    const [liveAnnouncement, setLiveAnnouncement] = useState("");
    const [saveState, setSaveState] =
        useState<DepartmentUserWorkspaceSaveIndicatorState>("idle");
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(
        activeWorkspaceState?.editorMetadata.lastSavedAt ?? null,
    );
    const latestLocalWorkspaceRevisionRef = useRef(
        activeWorkspaceState?.editorMetadata.revision ?? 0,
    );
    const previousPlanIdRef = useRef<string | null>(null);
    const previousResetKeyRef = useRef<string | null>(null);
    const previousAnnouncementKeyRef = useRef<string | null>(null);
    const previousItemsRef = useRef(props.items);
    const allowEditModePersistedFallbackRef = useRef(true);
    const currentWorkspaceRecordRef = useRef<BlocklyWorkspaceRecord | null>(activeWorkspaceState);
    const queuedWorkspaceRef = useRef<BlocklyWorkspaceRecord | null>(null);
    const isSaveInFlightRef = useRef(false);
    const storageWarningMessageRef = useRef<string | null>(null);
    const saveIndicatorAnnouncementRef = useRef<string | null>(null);
    const hasSessionConflictRef = useRef(false);
    const pendingNavigationTargetRef = useRef<PendingNavigationTarget | null>(null);
    const navigationGuardBypassRef = useRef(false);
    const historyGuardArmedRef = useRef(false);
    const handleStorageFailureRef = useRef<
        (error: DepartmentUserWorkspaceStorageFailure) => void
    >(() => {});
    const persistRecoverySnapshotRef = useRef<
        (snapshot: BlocklyWorkspaceRecord) => Promise<void>
    >(async () => {});
    const clearLocalDraftStateRef = useRef<() => Promise<void>>(async () => {});
    const flushWorkspaceDraftRef = useRef<
        (snapshot: BlocklyWorkspaceRecord) => Promise<void>
    >(async () => {});
    const sessionIdRef = useRef(
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `workspace-session-${Date.now()}`,
    );
    const [saveAnnouncement, setSaveAnnouncement] = useState("");
    const [storageWarning, setStorageWarning] = useState<string | null>(null);
    const [blockedSyncMessage, setBlockedSyncMessage] = useState<string | null>(null);
    const [recoverySnapshot, setRecoverySnapshot] = useState<BlocklyWorkspaceRecord | null>(null);
    const [hasUnsyncedRisk, setHasUnsyncedRisk] = useState(false);
    const [hasSessionConflict, setHasSessionConflict] = useState(false);
    const [workspaceHistoryState, setWorkspaceHistoryState] =
        useState<BlocklyWorkspaceHistoryState>({
            canRedo: false,
            canUndo: false,
        });
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
    const [isSubmitPending, setIsSubmitPending] = useState(false);
    const [isWithdrawPending, setIsWithdrawPending] = useState(false);
    const previousCatalogRequestStatusRef = useRef<Map<string, string>>(new Map());
    const previousIncomingWorkspaceSyncKeyRef = useRef<string | null>(null);
    const workspaceItemIds = useMemo(
        () =>
            new Set(
                workspaceSummary?.categories.flatMap((category) =>
                    category.items
                        .map((item) => item.itemId?.trim() ?? "")
                        .filter((itemId) => itemId.length > 0),
                ) ?? [],
            ),
        [workspaceSummary],
    );
    const incomingWorkspaceSyncKey = `${props.planId}:${props.workspaceState?.editorMetadata.revision ?? 0}:${props.workspaceState?.editorMetadata.lastSavedAt ?? 0}`;

    useEffect(() => {
        if (previousIncomingWorkspaceSyncKeyRef.current === incomingWorkspaceSyncKey) {
            return;
        }

        previousIncomingWorkspaceSyncKeyRef.current = incomingWorkspaceSyncKey;

        if (
            isSameWorkspaceSnapshotIgnoringSavedAt(
                props.workspaceState,
                currentWorkspaceRecordRef.current,
            )
        ) {
            setActiveWorkspaceState((currentState) =>
                currentState
                    ? {
                          ...currentState,
                          editorMetadata: {
                              ...currentState.editorMetadata,
                              lastSavedAt:
                                  props.workspaceState?.editorMetadata.lastSavedAt ??
                                  currentState.editorMetadata.lastSavedAt,
                          },
                      }
                    : props.workspaceState,
            );
            currentWorkspaceRecordRef.current = props.workspaceState;
            queuedWorkspaceRef.current = null;
            return;
        }

        setActiveWorkspaceState(props.workspaceState);
        currentWorkspaceRecordRef.current = props.workspaceState;
        queuedWorkspaceRef.current = null;
        setWorkspaceMountKey((current) => current + 1);
    }, [
        incomingWorkspaceSyncKey,
        props.workspaceState,
    ]);

    useEffect(() => {
        const incomingRevision = activeWorkspaceState?.editorMetadata.revision ?? 0;
        const isPlanSwitch = previousPlanIdRef.current !== props.planId;
        const resetKey = `${props.planId}:${activeWorkspaceState?.editorMetadata.revision ?? 0}:${activeWorkspaceState?.editorMetadata.lastSavedAt ?? 0}:${props.department.budgetAllocation ?? "null"}`;
        if (previousResetKeyRef.current === resetKey) {
            return;
        }
        if (!isPlanSwitch && incomingRevision < latestLocalWorkspaceRevisionRef.current) {
            return;
        }

        previousPlanIdRef.current = props.planId;
        previousResetKeyRef.current = resetKey;
        latestLocalWorkspaceRevisionRef.current = incomingRevision;
        allowEditModePersistedFallbackRef.current = true;
        setSourceUsage(initialSourceUsage);
        setSearchQuery("");
        setWorkspaceSummary(preferredInitialSummary);
        setBudgetState(
            preferredInitialSummary?.budgetState ??
                mapDepartmentUserBudgetMeterState({
                    totalBudget: props.department.budgetAllocation,
                    usedAmount: 0,
                }),
        );
        setLastSavedAt(activeWorkspaceState?.editorMetadata.lastSavedAt ?? null);
        setWorkspaceHistoryState({
            canRedo: false,
            canUndo: false,
        });
        previousAnnouncementKeyRef.current = preferredInitialSummary
            ? getDepartmentUserWorkspaceAnnouncement(preferredInitialSummary).key
            : null;
    }, [
        activeWorkspaceState,
        initialSourceUsage,
        preferredInitialSummary,
        props.department.budgetAllocation,
        props.planId,
    ]);

    useEffect(() => {
        const previousItems = previousItemsRef.current;
        previousItemsRef.current = props.items;

        if (previousItems === props.items) {
            return;
        }

        const previousItemsById = new Map(
            previousItems.map((item) => [item.id, item] as const),
        );
        const currentItemsById = new Map(
            props.items.map((item) => [item.id, item] as const),
        );
        const workspaceCatalogItemIds = Array.from(workspaceItemIds);
        const hasWorkspaceCatalogPriceChange = workspaceCatalogItemIds.some((itemId) => {
            const previousItem = previousItemsById.get(itemId);
            const currentItem = currentItemsById.get(itemId);
            if (!previousItem || !currentItem) {
                return false;
            }

            return (
                (previousItem.unitPrice ?? null) !== (currentItem.unitPrice ?? null) ||
                (previousItem.lastPriceChangedAt ?? null) !==
                    (currentItem.lastPriceChangedAt ?? null)
            );
        });
        const hasWorkspaceCatalogValidationChange = workspaceCatalogItemIds.some((itemId) => {
            const previousItem = previousItemsById.get(itemId);
            const currentItem = currentItemsById.get(itemId);
            if (!previousItem || !currentItem) {
                return false;
            }

            return (
                previousItem.isActive !== currentItem.isActive ||
                (previousItem.unitOfMeasurement ?? null) !==
                    (currentItem.unitOfMeasurement ?? null) ||
                (previousItem.maxQuantity ?? null) !==
                    (currentItem.maxQuantity ?? null) ||
                (previousItem.minQuantity ?? null) !==
                    (currentItem.minQuantity ?? null)
            );
        });
        const hasWorkspaceCatalogRemoval = workspaceCatalogItemIds.some((itemId) => {
            const previousItem = previousItemsById.get(itemId);
            const currentItem = currentItemsById.get(itemId);

            return Boolean(previousItem) && (!currentItem || currentItem.isActive === false);
        });

        if (hasWorkspaceCatalogPriceChange) {
            toast.info(PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE);
        }
        if (hasWorkspaceCatalogRemoval) {
            toast.warning(PROCUREMENT_ITEM_WORKSPACE_UNAVAILABLE_MESSAGE);
        } else if (hasWorkspaceCatalogValidationChange) {
            toast.info(PROCUREMENT_ITEM_VALIDATION_CHANGE_NOTICE);
        }
    }, [props.items, workspaceItemIds]);

    useEffect(() => {
        if (!canDepartmentUserOpenPlanSubmissionReview(props.planMeta.status)) {
            setIsSubmitReviewOpen(false);
        }
    }, [props.planMeta.status]);

    useEffect(() => {
        const announcement = getDepartmentUserWorkspaceAnnouncement(workspaceSummary);
        if (previousAnnouncementKeyRef.current === null) {
            previousAnnouncementKeyRef.current = announcement.key;
            return;
        }

        if (previousAnnouncementKeyRef.current === announcement.key) {
            return;
        }

        previousAnnouncementKeyRef.current = announcement.key;
        setLiveAnnouncement(announcement.message);
    }, [workspaceSummary]);

    useEffect(() => {
        currentWorkspaceRecordRef.current = activeWorkspaceState;
    }, [activeWorkspaceState]);

    useEffect(() => {
        hasSessionConflictRef.current = hasSessionConflict;
    }, [hasSessionConflict]);

    const saveIndicatorLabel = useMemo(
        () =>
            getDepartmentUserWorkspaceSaveIndicatorLabel({
                blockedMessage: blockedSyncMessage,
                indicatorState: saveState,
                lastSavedAt,
            }),
        [blockedSyncMessage, lastSavedAt, saveState],
    );

    useEffect(() => {
        if (saveIndicatorAnnouncementRef.current === saveIndicatorLabel) {
            return;
        }

        saveIndicatorAnnouncementRef.current = saveIndicatorLabel;
        setSaveAnnouncement(saveIndicatorLabel);
    }, [saveIndicatorLabel]);

    useEffect(() => {
        if (!catalogRequestData) {
            return;
        }

        const nextStatuses = new Map(
            catalogRequestData.requests.map((request) => [request.id, request.status] as const),
        );
        for (const request of catalogRequestData.requests) {
            const previousStatus = previousCatalogRequestStatusRef.current.get(request.id);
            if (!previousStatus || previousStatus === request.status) {
                continue;
            }

            const statusMeta = buildCatalogRequestStatusMeta(request.status);
            const message = `${request.name} is now ${statusMeta.label.toLowerCase()}.`;
            if (request.status === "approved") {
                toast.success(message);
            } else if (request.status === "denied" || request.status === "expired") {
                toast.warning(message);
            } else {
                toast(message);
            }
            setLiveAnnouncement(message);
        }

        previousCatalogRequestStatusRef.current = nextStatuses;
    }, [catalogRequestData]);

    const activeCategoryOptions = useMemo(
        () =>
            props.categories
                .filter((category) => category.isActive)
                .map((category) => ({
                    id: category.id,
                    name: category.name,
                })),
        [props.categories],
    );
    const selectedCatalogRequest = useMemo(
        () =>
            catalogRequestData?.requests.find((request) => request.id === editingCatalogRequestId) ??
            null,
        [catalogRequestData?.requests, editingCatalogRequestId],
    );
    const dialogItemDefaults = useMemo<CatalogItemRequestFormValues>(() => {
        if (!selectedCatalogRequest || selectedCatalogRequest.type !== "item") {
            return {
                categoryId: "",
                categoryMode: "existing",
                categoryRequest: {
                    description: "",
                    justification: "",
                    name: "",
                },
                description: "",
                estimatedUnitPrice: 0,
                justification: "",
                name: "",
            };
        }

        return {
            categoryId: selectedCatalogRequest.categoryId ?? "",
            categoryMode: selectedCatalogRequest.categoryReferenceMode ?? "existing",
            categoryRequest: selectedCatalogRequest.categoryRequest
                ? {
                      description: selectedCatalogRequest.categoryRequest.description,
                      justification: selectedCatalogRequest.categoryRequest.justification,
                      name: selectedCatalogRequest.categoryRequest.name,
                  }
                : {
                      description: "",
                      justification: "",
                      name: "",
                  },
            description: selectedCatalogRequest.description,
            estimatedUnitPrice: selectedCatalogRequest.estimatedUnitPrice ?? 0,
            justification: selectedCatalogRequest.justification,
            name: selectedCatalogRequest.name,
        };
    }, [selectedCatalogRequest]);
    const dialogCategoryDefaults = useMemo<CatalogCategoryRequestFormValues>(() => {
        if (selectedCatalogRequest?.type === "category") {
            return {
                description: selectedCatalogRequest.description,
                justification: selectedCatalogRequest.justification,
                name: selectedCatalogRequest.name,
            };
        }

        if (selectedCatalogRequest?.type === "item" && selectedCatalogRequest.categoryRequest) {
            return {
                description: selectedCatalogRequest.categoryRequest.description,
                justification: selectedCatalogRequest.categoryRequest.justification,
                name: selectedCatalogRequest.categoryRequest.name,
            };
        }

        return {
            description: "",
            justification: "",
            name: "",
        };
    }, [selectedCatalogRequest]);
    const lockedCategoryLabel =
        selectedCatalogRequest?.type === "item" && editingCatalogRequestId
            ? selectedCatalogRequest.categoryName ?? null
            : null;

    const shouldWarnBeforeLeave = shouldWarnDepartmentUserBeforeLeave({
        hasUnsyncedRisk,
        isSaveInFlight: isSaveInFlightRef.current,
        mode: props.mode,
    });

    function handleStorageFailure(error: DepartmentUserWorkspaceStorageFailure): void {
        const userFacingMessage =
            "Local workspace recovery is unavailable in this browser. Keep this tab open until you save the draft to cloud.";
        if (storageWarningMessageRef.current === userFacingMessage) {
            return;
        }

        storageWarningMessageRef.current = userFacingMessage;
        setStorageWarning(userFacingMessage);
        toast.warning(userFacingMessage);
        if (error.code === "STORAGE_CORRUPT") {
            toast.warning(error.message);
        }
    }
    handleStorageFailureRef.current = handleStorageFailure;

    async function persistRecoverySnapshot(snapshot: BlocklyWorkspaceRecord): Promise<void> {
        const storageResult = await upsertDepartmentUserWorkspaceRecoverySnapshot({
            planId: props.planId,
            snapshot,
            userId: props.currentUserId,
        });
        if (!storageResult.ok) {
            handleStorageFailure(storageResult.error);
        }
    }
    persistRecoverySnapshotRef.current = persistRecoverySnapshot;

    async function queueSnapshotLocally(snapshot: BlocklyWorkspaceRecord): Promise<boolean> {
        queuedWorkspaceRef.current = coalesceDepartmentUserWorkspaceSnapshot(
            queuedWorkspaceRef.current,
            snapshot,
        );

        const storageResult = await upsertDepartmentUserWorkspaceQueuedSnapshot({
            planId: props.planId,
            snapshot: queuedWorkspaceRef.current,
            userId: props.currentUserId,
        });
        if (!storageResult.ok) {
            handleStorageFailure(storageResult.error);
            setHasUnsyncedRisk(true);
            return false;
        }

        setHasUnsyncedRisk(true);
        return true;
    }

    async function clearLocalDraftState(): Promise<void> {
        const storageResult = await clearDepartmentUserWorkspaceDraftState({
            planId: props.planId,
            userId: props.currentUserId,
        });
        if (!storageResult.ok) {
            handleStorageFailure(storageResult.error);
        }
    }
    clearLocalDraftStateRef.current = clearLocalDraftState;

    async function flushWorkspaceDraft(
        snapshot: BlocklyWorkspaceRecord,
    ): Promise<void> {
        if (props.mode !== "edit") {
            return;
        }

        if (hasSessionConflict) {
            setBlockedSyncMessage(
                "Another tab is actively editing this plan. Refresh this page before saving from this tab.",
            );
            setSaveState("blocked");
            setHasUnsyncedRisk(true);
            return;
        }

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            const queuedLocally = await queueSnapshotLocally(snapshot);
            setSaveState(queuedLocally ? "queued" : "error");
            return;
        }

        if (isSaveInFlightRef.current) {
            const queuedLocally = await queueSnapshotLocally(snapshot);
            setSaveState(queuedLocally ? "queued" : "error");
            return;
        }

        isSaveInFlightRef.current = true;
        setBlockedSyncMessage(null);
        setSaveState("saving");
        setHasUnsyncedRisk(true);

        try {
            const result = await saveWorkspaceDraft(
                buildDepartmentUserWorkspaceDraftSaveInput({
                    categories: props.categories,
                    planId: props.planId,
                    selectedCategoryIds: toolbox.sanitizedCategoryIds,
                    summary:
                        resolveDepartmentUserDisplayedWorkspaceSummary({
                            persistedPlanSummary: null,
                            totalBudget: props.department.budgetAllocation,
                            workspaceState: snapshot,
                            workspaceSummary:
                                calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
                                    items: props.items,
                                    totalBudget: props.department.budgetAllocation,
                                    workspaceState: snapshot,
                                }),
                        }) ?? workspaceSummary,
                    workspaceState: snapshot,
                }),
            );
            setLastSavedAt(result.savedAt);
            latestLocalWorkspaceRevisionRef.current = Math.max(
                latestLocalWorkspaceRevisionRef.current,
                snapshot.editorMetadata.revision,
            );

            if (
                queuedWorkspaceRef.current &&
                queuedWorkspaceRef.current.editorMetadata.revision <=
                    snapshot.editorMetadata.revision
            ) {
                queuedWorkspaceRef.current = null;
            }

            const latestWorkspaceRecord = currentWorkspaceRecordRef.current;
            if (
                latestWorkspaceRecord &&
                latestWorkspaceRecord.editorMetadata.revision >
                    snapshot.editorMetadata.revision
            ) {
                const queuedLocally = await queueSnapshotLocally(latestWorkspaceRecord);
                setSaveState(queuedLocally ? "queued" : "error");
                return;
            }

            queuedWorkspaceRef.current = null;
            await clearLocalDraftState();
            setSaveState("saved");
            setHasUnsyncedRisk(false);
        } catch (error) {
            const failure = parseDepartmentUserWorkspaceSaveFailure(error);

            if (failure.stopRetry) {
                await clearLocalDraftState();
                queuedWorkspaceRef.current = null;
                setRecoverySnapshot(null);
                setBlockedSyncMessage(failure.message);
                setSaveState("blocked");
                setHasUnsyncedRisk(true);
                toast.error(failure.message);
                return;
            }

            const queuedLocally = await queueSnapshotLocally(snapshot);
            if (queuedLocally) {
                setSaveState("queued");
                return;
            }

            setSaveState("error");
            toast.error("Cloud save failed. Your local draft is still available in this browser.");
        } finally {
            isSaveInFlightRef.current = false;
        }
    }
    flushWorkspaceDraftRef.current = flushWorkspaceDraft;

    useEffect(() => {
        if (props.mode !== "edit") {
            setHasSessionConflict(false);
            hasSessionConflictRef.current = false;
            return;
        }

        const sessionId = sessionIdRef.current;

        function updateSessionLease(): void {
            const activeLease = readDepartmentUserWorkspaceSessionLease({
                planId: props.planId,
                userId: props.currentUserId,
            });
            const competingSession = hasCompetingDepartmentUserWorkspaceSession({
                lease: activeLease,
                sessionId,
            });

            if (competingSession) {
                hasSessionConflictRef.current = true;
                setHasSessionConflict(true);
                setBlockedSyncMessage(
                    "Another tab is actively editing this plan. Refresh this page before saving from this tab.",
                );
                return;
            }

            const previouslyConflicted = hasSessionConflictRef.current;
            hasSessionConflictRef.current = false;
            setHasSessionConflict(false);
            if (previouslyConflicted) {
                setBlockedSyncMessage(null);
            }
            const leaseResult = claimDepartmentUserWorkspaceSessionLease({
                planId: props.planId,
                sessionId,
                userId: props.currentUserId,
            });
            if (!leaseResult.ok) {
                handleStorageFailureRef.current(leaseResult.error);
            }
        }

        updateSessionLease();
        const heartbeatId = window.setInterval(updateSessionLease, 5_000);
        const handleStorage = (event: StorageEvent) => {
            if (
                event.key !==
                `procureline:blockly-session:${props.currentUserId}:${props.planId}`
            ) {
                return;
            }

            updateSessionLease();
        };

        window.addEventListener("storage", handleStorage);
        return () => {
            window.clearInterval(heartbeatId);
            window.removeEventListener("storage", handleStorage);
            releaseDepartmentUserWorkspaceSessionLease({
                planId: props.planId,
                sessionId,
                userId: props.currentUserId,
            });
        };
    }, [props.currentUserId, props.mode, props.planId]);

    useEffect(() => {
        if (props.mode !== "edit") {
            setRecoverySnapshot(null);
            setStorageWarning(null);
            return;
        }

        let isCancelled = false;

        async function bootstrapDraftRecovery(): Promise<void> {
            const localDraftState = await readDepartmentUserWorkspaceDraftState({
                planId: props.planId,
                userId: props.currentUserId,
            });

            if (isCancelled) {
                return;
            }

            if (!localDraftState.ok) {
                handleStorageFailureRef.current(localDraftState.error);
                return;
            }

            const draftState = localDraftState.value;
            const newestLocalSnapshot =
                draftState?.queuedSnapshot && draftState.recoverySnapshot
                    ? coalesceDepartmentUserWorkspaceSnapshot(
                          draftState.queuedSnapshot,
                          draftState.recoverySnapshot,
                      )
                    : draftState?.queuedSnapshot ??
                      draftState?.recoverySnapshot ??
                      null;
            const freshness = compareDepartmentUserWorkspaceRecoveryFreshness({
                localSnapshot: newestLocalSnapshot,
                serverSnapshot: props.workspaceState,
            });

            if (freshness === "local_newer" && newestLocalSnapshot) {
                queuedWorkspaceRef.current = draftState?.queuedSnapshot ?? null;
                setHasUnsyncedRisk(Boolean(draftState?.queuedSnapshot));
                setSaveState(
                    draftState?.queuedSnapshot
                        ? hasSessionConflictRef.current
                            ? "blocked"
                            : "queued"
                        : "idle",
                );
                setRecoverySnapshot(newestLocalSnapshot);
                return;
            }

            if (
                freshness === "server_authoritative" ||
                freshness === "equal"
            ) {
                await clearLocalDraftStateRef.current();
                queuedWorkspaceRef.current = null;
                setHasUnsyncedRisk(false);
                setSaveState("idle");
            }
        }

        void bootstrapDraftRecovery();
        return () => {
            isCancelled = true;
        };
    }, [
        props.currentUserId,
        props.mode,
        props.planId,
        props.workspaceState,
    ]);

    useEffect(() => {
        if (props.mode !== "edit") {
            return;
        }

        const handleVisibilityChange = () => {
            const currentSnapshot = currentWorkspaceRecordRef.current;
            if (document.visibilityState !== "hidden" || !currentSnapshot) {
                return;
            }

            void persistRecoverySnapshotRef.current(currentSnapshot);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [props.mode]);

    useEffect(() => {
        if (props.mode !== "edit") {
            return;
        }

        const handleWindowBlur = () => {
            const currentSnapshot = currentWorkspaceRecordRef.current;
            if (!currentSnapshot) {
                return;
            }

            void persistRecoverySnapshotRef.current(currentSnapshot);
        };

        window.addEventListener("blur", handleWindowBlur);
        return () => {
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [props.mode]);

    useEffect(() => {
        if (!shouldWarnBeforeLeave) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [shouldWarnBeforeLeave]);

    useEffect(() => {
        if (!shouldWarnBeforeLeave) {
            return;
        }

        const handleDocumentClick = (event: MouseEvent) => {
            if (
                navigationGuardBypassRef.current ||
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const eventTarget = event.target;
            if (!(eventTarget instanceof Element)) {
                return;
            }

            const anchor = eventTarget.closest("a[href]");
            if (!(anchor instanceof HTMLAnchorElement)) {
                return;
            }

            if (
                anchor.target &&
                anchor.target !== "_self" &&
                anchor.target.trim().length > 0
            ) {
                return;
            }

            if (anchor.hasAttribute("download")) {
                return;
            }

            if (
                !shouldInterceptDepartmentUserRouteNavigation({
                    currentUrl: window.location.href,
                    hasUnsyncedRisk,
                    isSaveInFlight: isSaveInFlightRef.current,
                    mode: props.mode,
                    nextUrl: anchor.href,
                })
            ) {
                return;
            }

            event.preventDefault();
            pendingNavigationTargetRef.current = {
                href: anchor.href,
                kind: "href",
            };
            setIsExitDialogOpen(true);
        };

        document.addEventListener("click", handleDocumentClick, true);
        return () => {
            document.removeEventListener("click", handleDocumentClick, true);
        };
    }, [hasUnsyncedRisk, props.mode, shouldWarnBeforeLeave]);

    useEffect(() => {
        const historyAction = getDepartmentUserWorkspaceLeaveGuardHistoryAction({
            historyState: window.history.state,
            isGuardArmed: historyGuardArmedRef.current,
            sessionId: sessionIdRef.current,
            shouldWarnBeforeLeave,
        });

        if (historyAction === "disarm") {
            historyGuardArmedRef.current = false;
            navigationGuardBypassRef.current = true;
            window.history.back();
            const resetBypassTimeoutId = window.setTimeout(() => {
                navigationGuardBypassRef.current = false;
            }, 100);
            return () => {
                window.clearTimeout(resetBypassTimeoutId);
            };
        }

        if (!shouldWarnBeforeLeave) {
            historyGuardArmedRef.current = false;
            return;
        }

        if (historyAction === "arm") {
            window.history.pushState(
                createDepartmentUserWorkspaceLeaveGuardHistoryState(
                    sessionIdRef.current,
                ),
                "",
                window.location.href,
            );
            historyGuardArmedRef.current = true;
        }

        const handlePopState = () => {
            if (navigationGuardBypassRef.current) {
                navigationGuardBypassRef.current = false;
                return;
            }

            window.history.pushState(
                createDepartmentUserWorkspaceLeaveGuardHistoryState(
                    sessionIdRef.current,
                ),
                "",
                window.location.href,
            );
            pendingNavigationTargetRef.current = {
                kind: "back",
            };
            setIsExitDialogOpen(true);
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [shouldWarnBeforeLeave]);

    async function handleWorkspaceChange(payload: BlocklyWorkspaceChangePayload): Promise<void> {
        currentWorkspaceRecordRef.current = payload.workspaceState;
        latestLocalWorkspaceRevisionRef.current = Math.max(
            latestLocalWorkspaceRevisionRef.current,
            payload.workspaceState.editorMetadata.revision,
        );
        allowEditModePersistedFallbackRef.current = false;
        const displayedSummary = resolveDepartmentUserDisplayedWorkspaceSummary({
            persistedPlanSummary: props.mode === "view" ? props.persistedPlanSummary : null,
            totalBudget: props.department.budgetAllocation,
            workspaceState: payload.workspaceState,
            workspaceSummary: payload.summary,
        });
        setWorkspaceSummary(displayedSummary);
        setBudgetState(
            displayedSummary?.budgetState ??
                mapDepartmentUserBudgetMeterState({
                    totalBudget: props.department.budgetAllocation,
                    usedAmount: 0,
                }),
        );
        if (props.mode !== "edit") {
            return;
        }

        await persistRecoverySnapshot(payload.workspaceState);
        const queuedLocally = await queueSnapshotLocally(payload.workspaceState);

        if (hasSessionConflict) {
            setSaveState(queuedLocally ? "blocked" : "error");
            setBlockedSyncMessage(
                "Another tab is actively editing this plan. Refresh this page before saving from this tab.",
            );
            return;
        }

        setSaveState(queuedLocally ? "queued" : "error");
    }

    function openCatalogRequestDialog(tab: "category" | "item"): void {
        setCatalogRequestDialogTab(tab);
        setEditingCatalogRequestId(null);
        setIsCatalogRequestDialogOpen(true);
    }

    async function handleSubmitCategoryRequest(
        values: CatalogCategoryRequestFormValues,
    ): Promise<void> {
        try {
            if (selectedCatalogRequest?.type === "category" && editingCatalogRequestId) {
                await updateCategoryRequest({
                    ...values,
                    planId: props.planId,
                    requestId: editingCatalogRequestId,
                    revision: selectedCatalogRequest.revision,
                });
                toast.success("Category request updated.");
            } else {
                await createCategoryRequest({
                    ...values,
                    planId: props.planId,
                });
                toast.success("Category request submitted.");
            }
            setIsCatalogRequestDialogOpen(false);
            setEditingCatalogRequestId(null);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "We could not submit that category request right now.",
            );
        }
    }

    async function handleSubmitItemRequest(
        values: CatalogItemRequestFormValues,
        categoryDraft: CatalogCategoryRequestFormValues,
    ): Promise<void> {
        try {
            if (selectedCatalogRequest?.type === "item" && editingCatalogRequestId) {
                await updateItemRequest({
                    description: values.description,
                    estimatedUnitPrice: values.estimatedUnitPrice,
                    justification: values.justification,
                    linkedCategoryRequest: selectedCatalogRequest.categoryRequest
                        ? {
                              description: categoryDraft.description,
                              justification: categoryDraft.justification,
                              name: categoryDraft.name,
                              revision: selectedCatalogRequest.categoryRequest.revision,
                          }
                        : undefined,
                    name: values.name,
                    planId: props.planId,
                    requestId: editingCatalogRequestId,
                    revision: selectedCatalogRequest.revision,
                });
                toast.success("Item request updated.");
            } else {
                await createItemRequest({
                    categoryId:
                        values.categoryMode === "existing" ? values.categoryId : undefined,
                    categoryRequest:
                        values.categoryMode === "request" ? categoryDraft : undefined,
                    description: values.description,
                    estimatedUnitPrice: values.estimatedUnitPrice,
                    justification: values.justification,
                    name: values.name,
                    planId: props.planId,
                });
                toast.success("Item request submitted.");
            }
            setIsCatalogRequestDialogOpen(false);
            setEditingCatalogRequestId(null);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "We could not submit that item request right now.",
            );
        }
    }

    function handlePlaceholderAction(message: string): void {
        toast(message);
    }

    function handleOpenSubmitReview(): void {
        setIsSubmitReviewOpen(true);
    }

    function handleValidationFixTarget(
        fixTarget: DepartmentUserPlanSubmissionFixTarget | null | undefined,
    ): void {
        function scrollAndHighlight(target: Element | null): boolean {
            if (!target) {
                return false;
            }

            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.classList.add("ring-4", "ring-amber-300");
            window.setTimeout(() => {
                target.classList.remove("ring-4", "ring-amber-300");
            }, 1800);
            return true;
        }

        if (!fixTarget) {
            toast("Target no longer available; refresh validation.");
            return;
        }

        if (fixTarget.type === "pending_requests") {
            setCatalogRequestDialogTab("item");
            setEditingCatalogRequestId(null);
            setIsCatalogRequestDialogOpen(true);
            return;
        }

        if (fixTarget.type === "budget_summary") {
            if (scrollAndHighlight(document.querySelector("[data-du-budget-summary]"))) {
                return;
            }
        }

        if (fixTarget.type === "deadline_summary") {
            if (scrollAndHighlight(document.querySelector("[data-du-deadline-summary]"))) {
                return;
            }
        }

        if (fixTarget.type === "workspace_block" || fixTarget.type === "workspace_category") {
            const workspaceBlockTarget = document.querySelector(
                `[data-block-id="${CSS.escape(fixTarget.id)}"]`,
            );
            if (scrollAndHighlight(workspaceBlockTarget)) {
                return;
            }

            if (fixTarget.type === "workspace_category") {
                const categorySummaryTarget = document.querySelector(
                    `[data-du-category-summary="${CSS.escape(fixTarget.id)}"]`,
                );
                if (scrollAndHighlight(categorySummaryTarget)) {
                    return;
                }
            }
        }

        toast("Target no longer available; refresh validation.");
    }

    async function handleConfirmSubmit(): Promise<void> {
        if (isSubmitPending) {
            return;
        }

        setIsSubmitPending(true);
        try {
            const result = await submitDepartmentUserPlan({
                expectedDecisionDecidedAt:
                    props.planMeta.status === "rejected"
                        ? props.planMeta.revisionContext?.activeDecision?.decidedAt ??
                          undefined
                        : undefined,
                expectedDecisionId:
                    props.planMeta.status === "rejected"
                        ? props.planMeta.revisionContext?.activeDecision?.id ??
                          undefined
                        : undefined,
                planId: props.planId,
            });
            setIsSubmitReviewOpen(false);
            if (result.emailStatus === "failed") {
                toast.warning(
                    result.emailErrorMessage?.trim() ||
                        `Plan submitted as ${result.submissionReference}, but the confirmation email could not be queued.`,
                );
            } else {
                toast.success(`Plan submitted as ${result.submissionReference}.`);
            }
            startTransition(() => {
                router.replace(`/du/plans/${props.planId}?mode=view`);
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "We could not submit this plan right now.",
            );
        } finally {
            setIsSubmitPending(false);
        }
    }

    async function handleWithdrawSubmission(): Promise<void> {
        if (isWithdrawPending) {
            return;
        }

        setIsWithdrawPending(true);
        try {
            await withdrawDepartmentUserPlanSubmission({
                planId: props.planId,
            });
            toast.success("Submission withdrawn. This draft is editable again.");
            startTransition(() => {
                router.replace(`/du/plans/${props.planId}?mode=edit`);
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "We could not withdraw this submission right now.",
            );
        } finally {
            setIsWithdrawPending(false);
        }
    }

    async function handleRecoverUnsavedChanges(): Promise<void> {
        if (!recoverySnapshot) {
            return;
        }

        const recoveredWorkspaceState = createRecoveredDepartmentUserWorkspaceRecord({
            currentUserId: props.currentUserId,
            localSnapshot: recoverySnapshot,
            serverSnapshot: props.workspaceState,
        });
        setActiveWorkspaceState(recoveredWorkspaceState);
        currentWorkspaceRecordRef.current = recoveredWorkspaceState;
        setWorkspaceMountKey((current) => current + 1);
        setRecoverySnapshot(null);
        setBlockedSyncMessage(null);
        setLastSavedAt(props.workspaceState?.editorMetadata.lastSavedAt ?? null);
        setHasUnsyncedRisk(true);
        const queuedLocally = await queueSnapshotLocally(recoveredWorkspaceState);
        setSaveState(
            queuedLocally ? (hasSessionConflict ? "blocked" : "queued") : "error",
        );
        toast.info(getDepartmentUserWorkspaceRecoveryMessage());
    }

    async function handleDiscardRecoveredChanges(): Promise<void> {
        setRecoverySnapshot(null);
        await clearLocalDraftState();
        queuedWorkspaceRef.current = null;
        setBlockedSyncMessage(null);
        setHasUnsyncedRisk(false);
        setSaveState("idle");
    }

    async function handleClearPlan(): Promise<void> {
        const clearedWorkspaceState = createClearedDepartmentUserWorkspaceRecord({
            currentUserId: props.currentUserId,
            previousSnapshot: currentWorkspaceRecordRef.current ?? activeWorkspaceState,
        });
        setActiveWorkspaceState(clearedWorkspaceState);
        currentWorkspaceRecordRef.current = clearedWorkspaceState;
        latestLocalWorkspaceRevisionRef.current = Math.max(
            latestLocalWorkspaceRevisionRef.current,
            clearedWorkspaceState.editorMetadata.revision,
        );
        setWorkspaceMountKey((current) => current + 1);
        setRecoverySnapshot(null);
        setBlockedSyncMessage(null);
        setLastSavedAt(null);
        setSourceUsage(
            collectDepartmentUserWorkspaceSourceUsage({
                categories: props.categories.map((category) => ({
                    id: category.id,
                    name: category.name,
                })),
                items: props.items,
                workspaceState: clearedWorkspaceState,
            }),
        );
        const clearedSummary = calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
            items: props.items,
            totalBudget: props.department.budgetAllocation,
            workspaceState: clearedWorkspaceState,
        });
        setWorkspaceSummary(clearedSummary);
        setBudgetState(
            clearedSummary?.budgetState ??
                mapDepartmentUserBudgetMeterState({
                    totalBudget: props.department.budgetAllocation,
                    usedAmount: 0,
                }),
        );

        const queuedLocally = await queueSnapshotLocally(clearedWorkspaceState);
        setSaveState(queuedLocally ? "queued" : "error");
        setHasUnsyncedRisk(true);
        toast.success("Planning canvas cleared locally. Click Save to sync it to cloud.");
    }

    async function handleSaveToCloud(): Promise<void> {
        if (props.mode !== "edit") {
            return;
        }

        const snapshot = currentWorkspaceRecordRef.current ?? activeWorkspaceState;
        if (!snapshot) {
            return;
        }

        const queuedLocally = await queueSnapshotLocally(snapshot);
        if (!queuedLocally) {
            setSaveState("error");
            return;
        }

        await flushWorkspaceDraftRef.current(snapshot);
    }

    function handleWorkspaceUndo(): void {
        if (props.mode !== "edit" || !workspaceHistoryState.canUndo) {
            return;
        }

        setHistoryActionRequest((current) => ({
            kind: "undo",
            nonce: (current?.nonce ?? 0) + 1,
        }));
    }

    function handleWorkspaceRedo(): void {
        if (props.mode !== "edit" || !workspaceHistoryState.canRedo) {
            return;
        }

        setHistoryActionRequest((current) => ({
            kind: "redo",
            nonce: (current?.nonce ?? 0) + 1,
        }));
    }

    function handleExitDialogOpenChange(nextOpen: boolean): void {
        if (!nextOpen) {
            pendingNavigationTargetRef.current = null;
        }

        setIsExitDialogOpen(nextOpen);
    }

    function handleConfirmedExit(): void {
        const pendingNavigationTarget = pendingNavigationTargetRef.current ?? {
            href: "/du",
            kind: "href" as const,
        };
        pendingNavigationTargetRef.current = null;
        setIsExitDialogOpen(false);
        navigationGuardBypassRef.current = true;

        if (pendingNavigationTarget.kind === "back") {
            window.history.back();
            window.setTimeout(() => {
                navigationGuardBypassRef.current = false;
            }, 100);
            return;
        }

        router.push(pendingNavigationTarget.href);
        window.setTimeout(() => {
            navigationGuardBypassRef.current = false;
        }, 100);
    }

    function handleExitIntent(): void {
        if (!shouldWarnBeforeLeave) {
            router.push("/du");
            return;
        }

        pendingNavigationTargetRef.current = {
            href: "/du",
            kind: "href",
        };
        setIsExitDialogOpen(true);
    }

    const pendingCatalogRequestIssue = useMemo<DepartmentUserPlanSubmissionIssue | null>(() => {
        const pendingCount = catalogRequestData?.summary.totalPendingCount ?? 0;
        if (pendingCount <= 0) {
            return null;
        }

        return {
            blocksSubmission: true,
            code: "pending_catalog_requests",
            fixTarget: {
                id: "catalog-requests",
                label: "Catalog requests",
                type: "pending_requests",
            },
            message: `You have ${pendingCount} pending requests. Cancel or wait for PO decision.`,
            severity: "error",
        };
    }, [catalogRequestData?.summary.totalPendingCount]);
    const revisionIssues = useMemo(
        () =>
            props.planMeta.revisionContext?.activeDecision
                ? mapDepartmentUserFlaggedTargetsToIssues({
                      flaggedTargets:
                          props.planMeta.revisionContext.activeDecision.flaggedTargets,
                      workspaceSummary,
                  })
                : [],
        [props.planMeta.revisionContext?.activeDecision, workspaceSummary],
    );
    const supplementalSubmissionIssues = useMemo(
        () => [
            ...(pendingCatalogRequestIssue ? [pendingCatalogRequestIssue] : []),
            ...revisionIssues,
        ],
        [pendingCatalogRequestIssue, revisionIssues],
    );
    const submissionReviewSummary = useMemo(
        () =>
            buildDepartmentUserPlanSubmissionReviewSummary(workspaceSummary, {
                supplementalBlockerMessages: supplementalSubmissionIssues.map(
                    (issue) => issue.message,
                ),
                supplementalIssues: supplementalSubmissionIssues,
            }),
        [supplementalSubmissionIssues, workspaceSummary],
    );
    const submitState = getDepartmentUserPlanSubmitState({
        budgetState,
        hasUnsyncedChanges: hasUnsyncedRisk,
        mode: props.mode,
        saveState,
        supplementalBlockerMessages: supplementalSubmissionIssues.map(
            (issue) => issue.message,
        ),
        totalItemCount: submissionReviewSummary.itemCount,
        validationState: workspaceSummary?.validationState ?? null,
    });
    const canOpenSubmitReview = canDepartmentUserOpenPlanSubmissionReview(
        props.planMeta.status,
    );
    const canWithdrawCurrentSubmission =
        props.planMeta.status === "submitted" && props.planMeta.canWithdraw;
    const isCloudSaveDisabled =
        props.mode !== "edit" ||
        saveState === "saving" ||
        hasSessionConflict ||
        !hasUnsyncedRisk;
    const isUndoDisabled = props.mode !== "edit" || !workspaceHistoryState.canUndo;
    const isRedoDisabled = props.mode !== "edit" || !workspaceHistoryState.canRedo;
    const workspaceTitle = props.mode === "view" ? "Procurement Plan" : "New Procurement Plan";
    const workspaceSubtitle =
        props.mode === "view"
            ? "Review the current procurement plan blocks and totals."
            : "Drag items from left to build your plan.";
    const submittedAtLabel = props.planMeta.submittedAt
        ? formatSubmittedAtLabel(props.planMeta.submittedAt)
        : null;
    const activeRevisionDecision = props.planMeta.revisionContext?.activeDecision ?? null;
    const activeRevisionDecisionLabel =
        activeRevisionDecision?.decisionType === "revision_requested"
            ? "Revision Requested"
            : activeRevisionDecision?.decisionType === "rejected"
              ? "Rejected"
              : null;
    const activeRevisionDecisionAtLabel =
        typeof activeRevisionDecision?.decidedAt === "number"
            ? formatSubmittedAtLabel(activeRevisionDecision.decidedAt)
            : null;
    const activeRevisionDeadlineLabel =
        typeof activeRevisionDecision?.effectiveRevisionDeadlineAt === "number"
            ? formatDeadlineDateTime(
                  activeRevisionDecision.effectiveRevisionDeadlineAt,
                  props.planMeta.timeZone,
              )
            : null;

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <div aria-live="polite" className="sr-only">
                {liveAnnouncement}
            </div>
            <div aria-live="polite" className="sr-only">
                {saveAnnouncement}
            </div>

            <div className={styles.workspaceShell}>
                <div className={styles.workspacePrototype}>
                    <div className={styles.workspacePrototypeHeader}>
                        <div className={styles.workspacePrototypeLead}>
                            <span className={styles.workspacePrototypeEyebrow}>
                                Fiscal year {props.fiscalYear}
                            </span>
                            <h1 className={styles.workspacePrototypeTitle}>{workspaceTitle}</h1>
                            <p
                                className={styles.workspacePrototypeSubtitle}
                                data-du-deadline-summary
                            >
                                {workspaceSubtitle}
                            </p>
                        </div>

                        <div className={styles.workspacePrototypeStats}>
                            <div
                                className={styles.prototypeBudgetMeter}
                                data-du-budget-summary
                            >
                                <div className={styles.prototypeBudgetLabel}>
                                    Department budget
                                </div>
                                <div className={styles.prototypeBudgetBar}>
                                    <div
                                        className={styles.prototypeBudgetFill}
                                        style={{
                                            width: `${Math.max(
                                                0,
                                                Math.min(100, budgetState.usedPercent ?? 0),
                                            )}%`,
                                        }}
                                    />
                                </div>
                                <div className={styles.prototypeBudgetText}>
                                    <span>{formatKenyanCurrency(budgetState.usedAmount)}</span>
                                    <span>
                                        {budgetState.totalBudget === null
                                            ? "Not allocated"
                                            : formatKenyanCurrency(budgetState.totalBudget)}
                                    </span>
                                    <span>{budgetState.usageLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.workspacePrototypeToolbar}>
                            <span className="mr-2 text-xs font-medium text-slate-500">
                                {saveIndicatorLabel}
                            </span>
                            <Button
                                className="border-slate-400 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                onClick={handleExitIntent}
                                type="button"
                                variant="outline"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Exit
                            </Button>
                            <Button
                                className="border-slate-400 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                disabled={props.mode !== "edit" || catalogRequestData?.meta.canCreate === false}
                                onClick={() => startTransition(() => openCatalogRequestDialog("item"))}
                                type="button"
                                variant="outline"
                            >
                                <PackagePlus className="mr-2 h-4 w-4" />
                                Request Item
                            </Button>
                            <Button
                                className="border-slate-400 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                onClick={() =>
                                    startTransition(() =>
                                        handlePlaceholderAction(
                                            "Export handoff stays reserved until the export stories land.",
                                        ),
                                    )
                                }
                                type="button"
                                variant="outline"
                            >
                                <FileDown className="mr-2 h-4 w-4" />
                                Export to Excel
                            </Button>
                            <Button
                                className="border-slate-400 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:border-slate-300 disabled:text-slate-400"
                                disabled={isUndoDisabled}
                                onClick={handleWorkspaceUndo}
                                type="button"
                                variant="outline"
                            >
                                <Undo2 className="mr-2 h-4 w-4" />
                                Undo
                            </Button>
                            <Button
                                className="border-slate-400 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:border-slate-300 disabled:text-slate-400"
                                disabled={isRedoDisabled}
                                onClick={handleWorkspaceRedo}
                                type="button"
                                variant="outline"
                            >
                                <Redo2 className="mr-2 h-4 w-4" />
                                Redo
                            </Button>
                            <Button
                                className="border-emerald-500 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:border-slate-300 disabled:text-slate-400"
                                disabled={isCloudSaveDisabled}
                                onClick={() => {
                                    void handleSaveToCloud();
                                }}
                                type="button"
                                variant="outline"
                            >
                                <Save className="mr-2 h-4 w-4" />
                                {saveState === "saving" ? "Saving..." : "Save"}
                            </Button>
                            {canOpenSubmitReview ? (
                                <Button
                                    className="bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-200 disabled:text-slate-600"
                                    disabled={submitState.disabled || isSubmitPending}
                                    onClick={() => {
                                        handleOpenSubmitReview();
                                    }}
                                    type="button"
                                    variant="default"
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    {isSubmitPending ? "Submitting..." : submitState.label}
                                </Button>
                            ) : canWithdrawCurrentSubmission ? (
                                <Button
                                    className="bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-200 disabled:text-slate-600"
                                    disabled={isWithdrawPending}
                                    onClick={() => {
                                        void handleWithdrawSubmission();
                                    }}
                                    type="button"
                                    variant="default"
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    {isWithdrawPending ? "Withdrawing..." : "Withdraw Submission"}
                                </Button>
                            ) : (
                                <Button
                                    className="bg-slate-300 text-slate-700 hover:bg-slate-300"
                                    disabled
                                    type="button"
                                    variant="default"
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    {props.planMeta.status === "submitted" ? "Submitted" : "View Only"}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className={styles.workspacePrototypeCanvas}>
                        <LazyBlocklyWorkspace
                            key={`${props.planId}:${workspaceMountKey}`}
                            budgetAllocation={props.department.budgetAllocation}
                            categories={props.categories}
                            currentUserId={props.currentUserId}
                            editorMode={props.mode}
                            historyActionRequest={historyActionRequest}
                            items={props.items}
                            onBudgetStateChange={(nextBudgetState) => {
                                if (props.mode !== "view") {
                                    setBudgetState(nextBudgetState);
                                    return;
                                }

                                setBudgetState(
                                    resolveDepartmentUserDisplayedWorkspaceSummary({
                                        persistedPlanSummary: props.persistedPlanSummary,
                                        totalBudget: props.department.budgetAllocation,
                                        workspaceState: activeWorkspaceState,
                                        workspaceSummary,
                                    })?.budgetState ?? nextBudgetState,
                                );
                            }}
                            onHistoryStateChange={setWorkspaceHistoryState}
                            onWorkspaceChange={(payload) => {
                                void handleWorkspaceChange(payload);
                            }}
                            onValidationNotice={(notice) => {
                                toast.warning(notice.message);
                            }}
                            onWorkspaceStructureChange={(nextSourceUsage) => {
                                setSourceUsage(nextSourceUsage);
                            }}
                            onWorkspaceSummaryChange={(nextSummary) => {
                                const persistedPlanSummary =
                                    getPersistedPlanSummaryForWorkspaceSummaryChange({
                                        allowEditModePersistedFallback:
                                            allowEditModePersistedFallbackRef.current,
                                        mode: props.mode,
                                        persistedPlanSummary: props.persistedPlanSummary,
                                    });
                                allowEditModePersistedFallbackRef.current = false;

                                setWorkspaceSummary(
                                    resolveDepartmentUserDisplayedWorkspaceSummary({
                                        persistedPlanSummary,
                                        totalBudget: props.department.budgetAllocation,
                                        workspaceState: activeWorkspaceState,
                                        workspaceSummary: nextSummary,
                                    }),
                                );
                            }}
                            planId={props.planId}
                            selectedCategoryIds={toolbox.sanitizedCategoryIds}
                            toolboxDefinition={toolbox.toolboxDefinition}
                            workspaceState={activeWorkspaceState}
                        />
                    </div>
                </div>
            </div>

            {recoverySnapshot ||
            isSubmitReviewOpen ||
            blockedSyncMessage ||
            storageWarning ||
            props.mode === "view" ||
            props.planMeta.submissionReference ||
            props.unavailableCategories.length > 0 ||
            ((props.planMeta.status === "draft" || props.planMeta.status === "rejected") &&
                submitState.disabled) ||
            (workspaceSummary?.validationState.submitBlockedReasons.length ?? 0) > 0 ||
            workspaceSummary?.validationState.validationUnavailableReason ? (
                <div className={styles.workspaceNoticeStack}>
                    {isSubmitReviewOpen ? (
                        <Alert
                            className="rounded-2xl border-emerald-300 bg-emerald-50 text-emerald-950 shadow-lg"
                            data-workspace-notice={
                                submissionReviewSummary.issues.length > 0
                                    ? "warning"
                                    : "success"
                            }
                            dismissible
                            dismissKey={`submit-review-${submissionReviewSummary.itemCount}-${submissionReviewSummary.estimatedBudgetUsed}-${submissionReviewSummary.categories.length}-${submissionReviewSummary.blockerMessages.join("|")}`}
                            onDismiss={() => {
                                setIsSubmitReviewOpen(false);
                            }}
                        >
                            <AlertTitle>Review before submission</AlertTitle>
                            <AlertDescription className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                            Items
                                        </div>
                                        <div className="mt-1 text-2xl font-bold">
                                            {submissionReviewSummary.itemCount}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                            Estimated Spend
                                        </div>
                                        <div className="mt-1 text-2xl font-bold">
                                            {formatKenyanCurrency(
                                                submissionReviewSummary.estimatedBudgetUsed,
                                            )}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                            Categories
                                        </div>
                                        <div className="mt-1 text-2xl font-bold">
                                            {submissionReviewSummary.categories.length}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-sm font-semibold text-emerald-900">
                                        Category breakdown
                                    </div>
                                    {submissionReviewSummary.categories.length > 0 ? (
                                        <div className="space-y-2">
                                            {submissionReviewSummary.categories.map((category) => (
                                                <div
                                                    key={category.categoryId}
                                                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3"
                                                    data-du-category-summary={category.categoryId}
                                                >
                                                    <div>
                                                        <div className="font-medium">{category.categoryName}</div>
                                                        <div className="text-sm text-emerald-800/80">
                                                            {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
                                                        </div>
                                                    </div>
                                                    <div className="font-semibold">
                                                        {formatKenyanCurrency(
                                                            category.estimatedBudgetUsed,
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 px-4 py-4 text-sm text-emerald-900/80">
                                            This draft does not contain any actionable items yet.
                                        </div>
                                    )}
                                </div>

                                {submissionReviewSummary.issues.length > 0 ? (
                                    <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                                        <div className="font-semibold">
                                            Validation issues
                                        </div>
                                        <div className="space-y-2">
                                            {submissionReviewSummary.issues.map((issue) => (
                                                <div
                                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
                                                    key={`${issue.code}-${issue.itemId ?? issue.itemName ?? issue.message}`}
                                                >
                                                    <span>{issue.message}</span>
                                                    {issue.fixTarget ? (
                                                        <Button
                                                            onClick={() => {
                                                                handleValidationFixTarget(issue.fixTarget);
                                                            }}
                                                            size="sm"
                                                            type="button"
                                                            variant="outline"
                                                        >
                                                            Fix
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : submissionReviewSummary.blockerMessages.length > 0 ? (
                                    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        {submissionReviewSummary.blockerMessages.join(" ")}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-emerald-200 bg-white/70 px-4 py-3 text-sm text-emerald-900">
                                        Submission will lock this workspace for editing and hand the plan to Procurement for review.
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        disabled={
                                            isSubmitPending ||
                                            submissionReviewSummary.issues.some(
                                                (issue) => issue.blocksSubmission,
                                            )
                                        }
                                        onClick={() => {
                                            void handleConfirmSubmit();
                                        }}
                                        type="button"
                                    >
                                        {isSubmitPending ? "Submitting..." : "Confirm submission"}
                                    </Button>
                                    <Button
                                        disabled={isSubmitPending}
                                        onClick={() => {
                                            setIsSubmitReviewOpen(false);
                                        }}
                                        type="button"
                                        variant="outline"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {recoverySnapshot ? (
                        <Alert
                            className="rounded-2xl border-emerald-300 bg-emerald-50 text-emerald-900 shadow-lg"
                            data-workspace-notice="warning"
                            dismissible
                            dismissKey={getDepartmentUserWorkspaceRecoveryMessage()}
                        >
                            <AlertTitle>Unsaved recovery available</AlertTitle>
                            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                                <span>{getDepartmentUserWorkspaceRecoveryMessage()}</span>
                                <span className="flex flex-wrap gap-2">
                                    <Button
                                        onClick={() => {
                                            void handleRecoverUnsavedChanges();
                                        }}
                                        type="button"
                                        variant="outline"
                                    >
                                        Recover changes
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            void handleDiscardRecoveredChanges();
                                        }}
                                        type="button"
                                        variant="ghost"
                                    >
                                        Dismiss local copy
                                    </Button>
                                </span>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {blockedSyncMessage ? (
                        <Alert
                            className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900 shadow-lg"
                            data-workspace-notice="warning"
                            dismissible
                            dismissKey={blockedSyncMessage}
                        >
                            <AlertTitle>Cloud save is paused</AlertTitle>
                            <AlertDescription>{blockedSyncMessage}</AlertDescription>
                        </Alert>
                    ) : null}

                    {storageWarning ? (
                        <Alert
                            className="rounded-2xl border-border/70 bg-muted/95 shadow-lg"
                            data-workspace-notice="warning"
                            dismissible
                            dismissKey={storageWarning}
                        >
                            <AlertTitle>Local recovery warning</AlertTitle>
                            <AlertDescription>{storageWarning}</AlertDescription>
                        </Alert>
                    ) : null}

                    {activeRevisionDecision ? (
                        <Alert
                            className="rounded-2xl border-amber-300 bg-amber-50 text-amber-950 shadow-lg"
                            data-workspace-notice="revision-feedback"
                            dismissible
                            dismissKey={`revision-feedback:${activeRevisionDecision.id}`}
                        >
                            <AlertTitle>
                                {activeRevisionDecisionLabel ?? "Revision feedback"}
                            </AlertTitle>
                            <AlertDescription className="space-y-3">
                                <div className="grid gap-2 md:grid-cols-2">
                                    <div>
                                        <span className="font-medium">Decision:</span>{" "}
                                        {activeRevisionDecisionLabel}
                                    </div>
                                    {activeRevisionDecisionAtLabel ? (
                                        <div>
                                            <span className="font-medium">Recorded:</span>{" "}
                                            {activeRevisionDecisionAtLabel}
                                        </div>
                                    ) : null}
                                    {activeRevisionDeadlineLabel ? (
                                        <div>
                                            <span className="font-medium">
                                                Effective revision deadline:
                                            </span>{" "}
                                            {activeRevisionDeadlineLabel}
                                        </div>
                                    ) : null}
                                    {activeRevisionDecision.submissionReference ? (
                                        <div>
                                            <span className="font-medium">
                                                Submission reference:
                                            </span>{" "}
                                            {activeRevisionDecision.submissionReference}
                                        </div>
                                    ) : props.planMeta.submissionReference ? (
                                        <div>
                                            <span className="font-medium">
                                                Submission reference:
                                            </span>{" "}
                                            {props.planMeta.submissionReference}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="rounded-xl border border-amber-200 bg-white/80 px-4 py-3 text-sm">
                                    {activeRevisionDecision.comment}
                                </div>
                                {props.planMeta.revisionContext?.effectiveDeadlineExpired ? (
                                    <div className="text-sm font-medium text-red-700">
                                        The effective revision deadline has passed. Resubmission stays blocked until Procurement provides a newer decision.
                                    </div>
                                ) : null}
                                {activeRevisionDecision.flaggedTargets.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="font-medium">
                                            Flagged targets to fix
                                        </div>
                                        <div className="grid gap-2">
                                            {activeRevisionDecision.flaggedTargets.map((target) => {
                                                const matchingIssue = revisionIssues.find(
                                                    (issue) => issue.itemId === target.itemId && issue.categoryId === target.categoryId,
                                                );
                                                return (
                                                    <div
                                                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-sm"
                                                        key={target.id}
                                                    >
                                                        <span>{matchingIssue?.message ?? target.label}</span>
                                                        {matchingIssue?.fixTarget ? (
                                                            <Button
                                                                onClick={() => {
                                                                    handleValidationFixTarget(
                                                                        matchingIssue.fixTarget,
                                                                    );
                                                                }}
                                                                size="sm"
                                                                type="button"
                                                                variant="outline"
                                                            >
                                                                Jump to fix
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                                {props.planMeta.revisionContext?.history.length ? (
                                    <div className="space-y-2" data-du-revision-history>
                                        <div className="font-medium">Submission and review history</div>
                                        <div className="grid gap-2">
                                            {props.planMeta.revisionContext.history.map((entry) => (
                                                <div
                                                    className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-sm"
                                                    key={entry.id}
                                                >
                                                    <div className="font-medium">{entry.title}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {entry.timestampLabel}
                                                    </div>
                                                    <div>{entry.detail}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {props.planMeta.submissionReference ? (
                        <Alert
                            autoDismissMs={5000}
                            className="rounded-2xl border-emerald-300 bg-emerald-50 text-emerald-950 shadow-lg"
                            data-workspace-notice="success"
                            dismissible
                            dismissKey={`${props.planMeta.status}-${props.planMeta.submissionReference}-${submittedAtLabel ?? "unknown"}`}
                        >
                            <AlertTitle>
                                {props.planMeta.status === "submitted"
                                    ? "Plan submitted to Procurement"
                                    : "Submission history on this plan"}
                            </AlertTitle>
                            <AlertDescription className="space-y-2">
                                <div>
                                    Reference: <span className="font-semibold">{props.planMeta.submissionReference}</span>
                                </div>
                                {submittedAtLabel ? <div>Submitted at: {submittedAtLabel}</div> : null}
                                {props.planMeta.status === "submitted" && canWithdrawCurrentSubmission ? (
                                    <div className="text-sm text-emerald-900/80">
                                        Withdrawal stays available until Procurement review starts.
                                    </div>
                                ) : null}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {props.planMeta.submissionEmailStatus === "failed" ? (
                        <Alert
                            className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900 shadow-lg"
                            data-workspace-notice="warning"
                            dismissible
                            dismissKey={
                                props.planMeta.submissionEmailErrorMessage?.trim() ||
                                "submission-email-failed"
                            }
                        >
                            <AlertTitle>Confirmation email needs attention</AlertTitle>
                            <AlertDescription>
                                {props.planMeta.submissionEmailErrorMessage?.trim() ||
                                    "The plan was submitted, but the confirmation email could not be queued."}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {props.mode === "view" ? (
                        <Alert
                            className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900 shadow-lg"
                            data-workspace-notice="info"
                            dismissible
                            dismissKey="read-only-planning-surface"
                        >
                            <AlertTitle>Read-only planning surface</AlertTitle>
                            <AlertDescription>
                                This plan is open in read-only mode, so editing stays unavailable here.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {props.unavailableCategories.length > 0 ? (
                        <Alert
                            className="rounded-2xl border-border/70 bg-muted/95 shadow-lg"
                            data-workspace-notice="warning"
                            dismissible
                            dismissKey={props.unavailableCategories
                                .map((category) => `${category.name}:${category.reason}`)
                                .join("|")}
                        >
                            <AlertTitle>Unavailable selected categories</AlertTitle>
                            <AlertDescription>
                                {props.unavailableCategories
                                    .map((category) => `${category.name}: ${category.reason}`)
                                    .join(" ")}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {canOpenSubmitReview && submitState.disabled ? (
                        <Alert
                            className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900 shadow-lg"
                            data-workspace-notice="warning"
                            dismissible
                            dismissKey={submitState.reason}
                        >
                            <AlertTitle>Submission not ready</AlertTitle>
                            <AlertDescription>{submitState.reason}</AlertDescription>
                        </Alert>
                    ) : null}

                    {(workspaceSummary?.validationState.submitBlockedReasons.length ?? 0) > 0 ? (
                        <Alert
                            className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900 shadow-lg"
                            data-workspace-notice="error"
                            dismissible
                            dismissKey={
                                workspaceSummary?.validationState.submitBlockedReasons.join("|") ??
                                "validation-issues"
                            }
                        >
                            <AlertTitle>Validation issues on the canvas</AlertTitle>
                            <AlertDescription>
                                {workspaceSummary?.validationState.submitBlockedReasons.join(" ")}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {workspaceSummary?.validationState.validationUnavailableReason ? (
                        <Alert
                            className="rounded-2xl border-border/70 bg-muted/95 shadow-lg"
                            data-workspace-notice="warning"
                            dismissible
                            dismissKey={
                                workspaceSummary.validationState.validationUnavailableReason
                            }
                        >
                            <AlertTitle>Validation details unavailable</AlertTitle>
                            <AlertDescription>
                                {workspaceSummary.validationState.validationUnavailableReason}
                            </AlertDescription>
                        </Alert>
                    ) : null}
                </div>
            ) : null}

            <CatalogRequestDialog
                activeTab={catalogRequestDialogTab}
                categories={activeCategoryOptions}
                categoryDefaults={dialogCategoryDefaults}
                categorySubmitLabel={
                    selectedCatalogRequest?.type === "category"
                        ? "Update category request"
                        : "Submit category request"
                }
                itemDefaults={dialogItemDefaults}
                itemSubmitLabel={
                    selectedCatalogRequest?.type === "item"
                        ? "Update item request"
                        : "Submit item request"
                }
                lockedCategoryLabel={lockedCategoryLabel}
                onOpenChange={(open) => {
                    setIsCatalogRequestDialogOpen(open);
                    if (!open) {
                        setEditingCatalogRequestId(null);
                    }
                }}
                onSubmitCategory={handleSubmitCategoryRequest}
                onSubmitItem={handleSubmitItemRequest}
                open={isCatalogRequestDialogOpen}
                readOnly={props.mode !== "edit" || catalogRequestData?.meta.canCreate === false}
                title={
                    selectedCatalogRequest
                        ? "Edit catalog request"
                        : "Request a missing item or category"
                }
            />

            <AlertDialog
                open={isExitDialogOpen}
                onOpenChange={handleExitDialogOpenChange}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave this draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Unsaved local changes may be lost. Stay here to keep the local draft and recovery copy active, or leave the editor now.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Stay</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmedExit}>
                            Leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Start over on this draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This clears the current Blockly canvas and replaces the local recovery snapshot for this plan. Use Save afterwards if you want the cleared version synced to cloud.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep current draft</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                setIsClearDialogOpen(false);
                                void handleClearPlan();
                            }}
                        >
                            Clear plan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function formatKenyanCurrency(amount: number): string {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}

function formatSubmittedAtLabel(timestamp: number): string {
    return new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(timestamp);
}

function isSameWorkspaceSnapshotIgnoringSavedAt(
    left: BlocklyWorkspaceRecord | null | undefined,
    right: BlocklyWorkspaceRecord | null | undefined,
): boolean {
    if (!left || !right) {
        return false;
    }

    return (
        left.editorMetadata.revision === right.editorMetadata.revision &&
        left.editorMetadata.lastSavedByUserId === right.editorMetadata.lastSavedByUserId &&
        left.editorMetadata.recoveredAt === right.editorMetadata.recoveredAt &&
        left.editorMetadata.saveSource === right.editorMetadata.saveSource &&
        areBlocklyWorkspaceJsonEquivalent(left.workspaceJson, right.workspaceJson)
    );
}
