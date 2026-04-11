"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, FileDown, PackagePlus, RotateCcw, Send } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlocklyBudgetHeader } from "@/src/components/blockly/BlocklyBudgetHeader";
import { BlocklyComplianceSummary } from "@/src/components/blockly/BlocklyComplianceSummary";
import { BlocklyLoadingSkeleton } from "@/src/components/blockly/BlocklyLoadingSkeleton";
import { BlocklyToolboxRail } from "@/src/components/blockly/BlocklyToolboxRail";
import type { BlocklyWorkspaceChangePayload } from "@/src/components/blockly/BlocklyWorkspace";
import { buildPlanningWorkspacePresentation } from "@/lib/blockly/editor-contract";
import type { BlocklyWorkspaceRecord } from "@/lib/blockly/blockly-serialization";
import { getPersistedPlanSummaryForWorkspaceSummaryChange } from "@/lib/blockly/du-editor-fallback";
import { buildDepartmentUserToolbox } from "@/lib/blockly/du-toolbox";
import {
    calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord,
    getDepartmentUserReservedSubmitState,
    getDepartmentUserWorkspaceAnnouncement,
    mapDepartmentUserBudgetMeterState,
    resolveDepartmentUserDisplayedWorkspaceSummary,
    type DepartmentUserBudgetMeterState,
    type DepartmentUserPersistedPlanSummary,
    type DepartmentUserWorkspaceSummary,
} from "@/lib/blockly/du-workspace-calculations";
import { buildDepartmentUserWorkspaceDraftSaveInput } from "@/lib/blockly/workspace-save";
import {
    collectDepartmentUserWorkspaceSourceUsage,
    type DepartmentUserWorkspaceSourceUsage,
} from "@/lib/blockly/workspace-catalog-identity";
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
} from "@/lib/blockly/workspace-draft-queue";
import { calculateProcurementComplianceSnapshot } from "@/lib/procurement/compliance";
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
    const [searchQuery, setSearchQuery] = useState("");
    const [activeWorkspaceState, setActiveWorkspaceState] = useState<BlocklyWorkspaceRecord | null>(
        props.workspaceState,
    );
    const [workspaceMountKey, setWorkspaceMountKey] = useState(0);
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
    const flushRetryTimerRef = useRef<number | null>(null);
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
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const presentation = useMemo(
        () =>
            buildPlanningWorkspacePresentation({
                actor: props.actor,
                actorLabel: props.actorLabel,
                mode: props.mode,
        }),
        [props.actor, props.actorLabel, props.mode],
    );
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

    useEffect(() => {
        setActiveWorkspaceState(props.workspaceState);
        currentWorkspaceRecordRef.current = props.workspaceState;
        queuedWorkspaceRef.current = null;
        setWorkspaceMountKey((current) => current + 1);
    }, [
        props.planId,
        props.workspaceState,
        props.workspaceState?.editorMetadata.lastSavedAt,
        props.workspaceState?.editorMetadata.revision,
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

    const shouldWarnBeforeLeave = shouldWarnDepartmentUserBeforeLeave({
        hasUnsyncedRisk,
        isSaveInFlight: isSaveInFlightRef.current,
        mode: props.mode,
    });

    function handleStorageFailure(error: DepartmentUserWorkspaceStorageFailure): void {
        const userFacingMessage =
            "Local workspace recovery is unavailable in this browser. Keep this tab open until your draft shows as saved.";
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

    function clearQueuedFlushTimer(): void {
        if (flushRetryTimerRef.current === null) {
            return;
        }

        window.clearTimeout(flushRetryTimerRef.current);
        flushRetryTimerRef.current = null;
    }

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

    function scheduleQueuedFlush(delayMs = 1500): void {
        if (props.mode !== "edit" || hasSessionConflict) {
            return;
        }

        clearQueuedFlushTimer();
        flushRetryTimerRef.current = window.setTimeout(() => {
            flushRetryTimerRef.current = null;
            if (!queuedWorkspaceRef.current) {
                return;
            }

            void flushWorkspaceDraft(queuedWorkspaceRef.current);
        }, delayMs);
    }

    async function flushWorkspaceDraft(
        snapshot: BlocklyWorkspaceRecord,
    ): Promise<void> {
        if (props.mode !== "edit") {
            return;
        }

        if (hasSessionConflict) {
            setBlockedSyncMessage(
                "Another tab is actively editing this plan. Refresh this page before replaying its queued changes.",
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
        clearQueuedFlushTimer();
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
                if (queuedLocally) {
                    scheduleQueuedFlush(250);
                }
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
                scheduleQueuedFlush(4000);
                return;
            }

            setSaveState("error");
            toast.error("Draft workspace sync failed. Your current session is still open.");
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
                    "Another tab is actively editing this plan. Refresh this page before replaying its queued changes.",
                );
                return;
            }

            const previouslyConflicted = hasSessionConflictRef.current;
            hasSessionConflictRef.current = false;
            setHasSessionConflict(false);
            if (previouslyConflicted) {
                setBlockedSyncMessage(null);
                if (queuedWorkspaceRef.current) {
                    if (flushRetryTimerRef.current !== null) {
                        window.clearTimeout(flushRetryTimerRef.current);
                    }
                    flushRetryTimerRef.current = window.setTimeout(() => {
                        flushRetryTimerRef.current = null;
                        if (!queuedWorkspaceRef.current) {
                            return;
                        }

                        void flushWorkspaceDraftRef.current(
                            queuedWorkspaceRef.current,
                        );
                    }, 250);
                }
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

        const handleOnline = () => {
            if (queuedWorkspaceRef.current) {
                void flushWorkspaceDraftRef.current(queuedWorkspaceRef.current);
            }
        };

        window.addEventListener("online", handleOnline);
        return () => {
            window.removeEventListener("online", handleOnline);
        };
    }, [props.mode]);

    useEffect(() => {
        if (props.mode !== "edit") {
            return;
        }

        const handleVisibilityChange = () => {
            if (
                document.visibilityState !== "hidden" ||
                !currentWorkspaceRecordRef.current
            ) {
                return;
            }

            void persistRecoverySnapshotRef.current(
                currentWorkspaceRecordRef.current,
            );
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
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

        if (hasSessionConflict) {
            const queuedLocally = await queueSnapshotLocally(payload.workspaceState);
            setSaveState(queuedLocally ? "blocked" : "error");
            setBlockedSyncMessage(
                "Another tab is actively editing this plan. Refresh this page before replaying its queued changes.",
            );
            return;
        }

        await flushWorkspaceDraft(payload.workspaceState);
    }

    function handleReservedAction(message: string): void {
        toast(message);
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
        if (queuedLocally && !hasSessionConflict) {
            scheduleQueuedFlush(250);
        }
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
        if (queuedLocally && !hasSessionConflict) {
            scheduleQueuedFlush(150);
        }
        toast.success("Planning canvas cleared. Sync will continue automatically.");
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

    const complianceState =
        workspaceSummary?.complianceState ??
        calculateProcurementComplianceSnapshot({
            items: [],
            totalEligibleSpend: 0,
        });
    const submitState = getDepartmentUserReservedSubmitState({
        budgetState,
        mode: props.mode,
        validationState: workspaceSummary?.validationState ?? null,
    });

    return (
        <div className="space-y-4">
            <div aria-live="polite" className="sr-only">
                {liveAnnouncement}
            </div>
            <div aria-live="polite" className="sr-only">
                {saveAnnouncement}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card className="rounded-[28px] border-border/70 shadow-sm">
                    <CardHeader className="gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">
                                        {presentation.badgeLabel}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-full">
                                        {presentation.actorBadgeLabel}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full">
                                        FY {props.fiscalYear}
                                    </Badge>
                                    {props.modeIndicatorLabel ?? presentation.modeIndicatorLabel ? (
                                        <Badge variant="outline" className="rounded-full">
                                            {props.modeIndicatorLabel ?? presentation.modeIndicatorLabel}
                                        </Badge>
                                    ) : null}
                                    {props.mode === "view" ? (
                                        <Badge
                                            variant="outline"
                                            className="rounded-full border-amber-300 bg-amber-50 text-amber-800"
                                        >
                                            Read-only
                                        </Badge>
                                    ) : null}
                                </div>
                                <div>
                                    <CardTitle className="text-3xl tracking-[-0.05em] text-foreground">
                                        {props.department.name}
                                    </CardTitle>
                                    <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                                        {props.subtitle}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Badge variant="outline" className="rounded-full">
                                        {saveIndicatorLabel}
                                    </Badge>
                                    <Button onClick={handleExitIntent} type="button" variant="outline">
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Exit
                                    </Button>
                                    {props.mode === "edit" ? (
                                        <Button
                                            onClick={() => setIsClearDialogOpen(true)}
                                            type="button"
                                            variant="outline"
                                        >
                                            <RotateCcw className="mr-2 h-4 w-4" />
                                            Start Over
                                        </Button>
                                    ) : null}
                                    <Button
                                        onClick={() =>
                                            startTransition(() =>
                                                handleReservedAction(
                                                    "Item request handoff stays reserved until Story 5.5 lands.",
                                                ),
                                            )
                                        }
                                        type="button"
                                        variant="outline"
                                    >
                                        <PackagePlus className="mr-2 h-4 w-4" />
                                        Request Item
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            startTransition(() =>
                                                handleReservedAction(
                                                    "Export handoff stays reserved until the export stories land.",
                                                ),
                                            )
                                        }
                                        type="button"
                                        variant="outline"
                                    >
                                        <FileDown className="mr-2 h-4 w-4" />
                                        Export
                                    </Button>
                                    <Button
                                        disabled={submitState.disabled}
                                        type="button"
                                        variant={
                                            submitState.label === "Submit Reserved"
                                                ? "default"
                                                : "outline"
                                        }
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        {submitState.label}
                                    </Button>
                                </div>
                                <p className="max-w-md text-right text-xs text-muted-foreground">
                                    {submitState.reason}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="space-y-4">
                    <BlocklyBudgetHeader budgetState={budgetState} />
                    <BlocklyComplianceSummary complianceState={complianceState} />
                </div>
            </div>

            {recoverySnapshot ? (
                <Alert className="rounded-2xl border-emerald-300 bg-emerald-50 text-emerald-900">
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
                <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900">
                    <AlertTitle>Draft sync is paused</AlertTitle>
                    <AlertDescription>{blockedSyncMessage}</AlertDescription>
                </Alert>
            ) : null}

            {storageWarning ? (
                <Alert className="rounded-2xl border-border/70 bg-muted/30">
                    <AlertTitle>Local recovery warning</AlertTitle>
                    <AlertDescription>{storageWarning}</AlertDescription>
                </Alert>
            ) : null}

            {props.mode === "view" ? (
                <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900">
                    <AlertTitle>Read-only planning surface</AlertTitle>
                    <AlertDescription>
                        {presentation.readOnlyMessage}
                    </AlertDescription>
                </Alert>
            ) : null}

            {props.unavailableCategories.length > 0 ? (
                <Alert className="rounded-2xl border-border/70 bg-muted/30">
                    <AlertTitle>Unavailable selected categories</AlertTitle>
                    <AlertDescription>
                        {props.unavailableCategories
                            .map((category) => `${category.name}: ${category.reason}`)
                            .join(" ")}
                    </AlertDescription>
                </Alert>
            ) : null}

            {(workspaceSummary?.validationState.submitBlockedReasons.length ?? 0) > 0 ? (
                <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900">
                    <AlertTitle>Validation issues on the canvas</AlertTitle>
                    <AlertDescription>
                        {workspaceSummary?.validationState.submitBlockedReasons.join(" ")}
                    </AlertDescription>
                </Alert>
            ) : null}

            {workspaceSummary?.validationState.validationUnavailableReason ? (
                <Alert className="rounded-2xl border-border/70 bg-muted/30">
                    <AlertTitle>Validation details unavailable</AlertTitle>
                    <AlertDescription>
                        {workspaceSummary.validationState.validationUnavailableReason}
                    </AlertDescription>
                </Alert>
            ) : null}

            <div className={styles.editorGrid}>
                <Card className={styles.toolboxRail}>
                    <CardHeader className="space-y-3">
                        <Badge variant="outline" className="w-fit rounded-full">
                            Toolbox contract
                        </Badge>
                        <CardTitle className="text-xl tracking-[-0.04em]">
                            Selected categories
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <BlocklyToolboxRail
                            categories={toolbox.categoryStates}
                            department={{
                                budgetAllocation: props.department.budgetAllocation,
                                name: props.department.name,
                                voteNumber: props.department.voteNumber,
                            }}
                            mode={props.mode}
                            onSearchQueryChange={setSearchQuery}
                            searchQuery={searchQuery}
                        />
                    </CardContent>
                </Card>

                <LazyBlocklyWorkspace
                    key={`${props.planId}:${workspaceMountKey}`}
                    budgetAllocation={props.department.budgetAllocation}
                    categories={props.categories}
                    currentUserId={props.currentUserId}
                    editorMode={props.mode}
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

            <AlertDialog
                open={isExitDialogOpen}
                onOpenChange={handleExitDialogOpenChange}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave this draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Unsynced changes may be lost. Stay here to keep the local queue and recovery copy active, or leave the editor now.
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
                            This clears the current Blockly canvas, replaces any queued local recovery snapshots for this plan, and syncs the emptied draft back through the normal save path.
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
