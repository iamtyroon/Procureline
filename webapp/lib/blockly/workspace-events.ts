import type { DepartmentUserWorkspaceUiState } from "./workspace-ui-state";

interface SerializedBlocklyBlock {
    fields?: Record<string, unknown>;
    inputs?: Record<
        string,
        {
            block?: SerializedBlocklyBlock | null;
        }
    >;
    next?: {
        block?: SerializedBlocklyBlock | null;
    };
    type?: unknown;
}

export interface DepartmentUserBlocklyEventLike {
    blockId?: string | null;
    oldJson?: SerializedBlocklyBlock | null;
    type?: string | null;
}

export interface DepartmentUserCategoryDeletionConfirmation {
    blockId: string;
    categoryId: string | null;
    categoryName: string;
    itemCount: number;
    message: string;
}

export interface DepartmentUserWorkspaceEventResolution {
    categoryDeletionConfirmation: DepartmentUserCategoryDeletionConfirmation | null;
    shouldPersistSnapshot: boolean;
    shouldQueueStructureRefresh: boolean;
    shouldRecalculate: boolean;
    shouldUndoDelete: boolean;
    viewportState: DepartmentUserWorkspaceUiState | null;
}

function getSerializedFieldValue(
    block: SerializedBlocklyBlock,
    fieldName: string,
): string {
    const value = block.fields?.[fieldName];

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }

    return "";
}

function getSerializedInputBlock(
    block: SerializedBlocklyBlock,
    inputName: string,
): SerializedBlocklyBlock | null {
    const input = block.inputs?.[inputName];
    const childBlock = input?.block;

    return childBlock && typeof childBlock === "object" ? childBlock : null;
}

function getSerializedNextBlock(
    block: SerializedBlocklyBlock,
): SerializedBlocklyBlock | null {
    const nextBlock = block.next?.block;
    return nextBlock && typeof nextBlock === "object" ? nextBlock : null;
}

function countSerializedItemBlocks(block: SerializedBlocklyBlock | null): number {
    if (!block) {
        return 0;
    }

    let count = 0;
    let itemBlock = getSerializedInputBlock(block, "ITEMS");
    while (itemBlock && itemBlock.type === "item_block") {
        count += 1;
        itemBlock = getSerializedNextBlock(itemBlock);
    }

    return count;
}

export function shouldRefreshDepartmentUserToolboxForEvent(
    event: DepartmentUserBlocklyEventLike,
): boolean {
    return (
        event.type === "create" ||
        event.type === "delete" ||
        event.type === "move" ||
        event.type === "finished_loading"
    );
}

export function resolveDepartmentUserWorkspaceEvent(args: {
    approvedCategoryDeletionIds?: ReadonlySet<string>;
    editorMode: "edit" | "view";
    event: DepartmentUserBlocklyEventLike & {
        run?: ((forward: boolean) => void) | null;
        scale?: number | null;
        viewLeft?: number | null;
        viewTop?: number | null;
    };
}): DepartmentUserWorkspaceEventResolution {
    const viewportState =
        args.event.type === "viewport_change" &&
        typeof args.event.scale === "number" &&
        Number.isFinite(args.event.scale) &&
        typeof args.event.viewLeft === "number" &&
        Number.isFinite(args.event.viewLeft) &&
        typeof args.event.viewTop === "number" &&
        Number.isFinite(args.event.viewTop)
            ? {
                  scale: args.event.scale,
                  viewLeft: args.event.viewLeft,
                  viewTop: args.event.viewTop,
              }
            : null;

    if (viewportState) {
        return {
            categoryDeletionConfirmation: null,
            shouldPersistSnapshot: false,
            shouldQueueStructureRefresh: false,
            shouldRecalculate: false,
            shouldUndoDelete: false,
            viewportState,
        };
    }

    const pendingDeletionConfirmation =
        args.editorMode === "edit"
            ? getDepartmentUserCategoryDeletionConfirmation(args.event)
            : null;
    const shouldUndoDelete =
        pendingDeletionConfirmation !== null &&
        typeof args.event.run === "function" &&
        !args.approvedCategoryDeletionIds?.has(pendingDeletionConfirmation.blockId);
    const shouldRecalculate =
        !shouldUndoDelete &&
        (args.event.type === "change" ||
            args.event.type === "create" ||
            args.event.type === "delete" ||
            args.event.type === "move" ||
            args.event.type === "finished_loading");
    const shouldPersistSnapshot =
        shouldRecalculate &&
        args.event.type !== "finished_loading";

    return {
        categoryDeletionConfirmation: shouldUndoDelete ? pendingDeletionConfirmation : null,
        shouldPersistSnapshot,
        shouldQueueStructureRefresh:
            shouldRecalculate && shouldRefreshDepartmentUserToolboxForEvent(args.event),
        shouldRecalculate,
        shouldUndoDelete,
        viewportState: null,
    };
}

export function getDepartmentUserCategoryDeletionConfirmation(
    event: DepartmentUserBlocklyEventLike,
): DepartmentUserCategoryDeletionConfirmation | null {
    if (event.type !== "delete" || !event.blockId || !event.oldJson) {
        return null;
    }

    if (event.oldJson.type !== "category_block") {
        return null;
    }

    const itemCount = countSerializedItemBlocks(event.oldJson);
    if (itemCount === 0) {
        return null;
    }

    const categoryName =
        getSerializedFieldValue(event.oldJson, "CATEGORY_NAME") || "this category";

    return {
        blockId: event.blockId,
        categoryId: getSerializedFieldValue(event.oldJson, "CATEGORY_ID") || null,
        categoryName,
        itemCount,
        message: `Remove ${categoryName} and all its items?`,
    };
}
