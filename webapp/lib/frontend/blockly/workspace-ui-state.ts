export interface DepartmentUserWorkspaceUiState {
    scale: number;
    viewLeft: number;
    viewTop: number;
}

export interface DepartmentUserWorkspaceViewportLike {
    scroll(left: number, top: number): void;
    setScale(scale: number): void;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function createDepartmentUserWorkspaceUiStateStorageKey(args: {
    planId: string;
    userId: string;
}): string {
    return `procureline:blockly-ui:${args.userId}:${args.planId}`;
}

export function normalizeDepartmentUserWorkspaceUiState(
    value: unknown,
): DepartmentUserWorkspaceUiState | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const candidate = value as Record<string, unknown>;
    if (
        !isFiniteNumber(candidate.scale) ||
        !isFiniteNumber(candidate.viewLeft) ||
        !isFiniteNumber(candidate.viewTop)
    ) {
        return null;
    }

    return {
        scale: candidate.scale,
        viewLeft: candidate.viewLeft,
        viewTop: candidate.viewTop,
    };
}

export function serializeDepartmentUserWorkspaceUiState(
    value: DepartmentUserWorkspaceUiState,
): string {
    return JSON.stringify(value);
}

export function parseDepartmentUserWorkspaceUiState(
    raw: string | null | undefined,
): DepartmentUserWorkspaceUiState | null {
    if (!raw) {
        return null;
    }

    try {
        return normalizeDepartmentUserWorkspaceUiState(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function restoreDepartmentUserWorkspaceUiState(args: {
    state: DepartmentUserWorkspaceUiState | null;
    workspace: DepartmentUserWorkspaceViewportLike;
}): boolean {
    if (!args.state) {
        return false;
    }

    args.workspace.setScale(args.state.scale);
    args.workspace.scroll(-args.state.viewLeft, -args.state.viewTop);
    return true;
}

export function readDepartmentUserWorkspaceUiState(args: {
    planId: string;
    userId: string;
}): DepartmentUserWorkspaceUiState | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        return parseDepartmentUserWorkspaceUiState(
            window.localStorage.getItem(
                createDepartmentUserWorkspaceUiStateStorageKey(args),
            ),
        );
    } catch {
        return null;
    }
}

export function writeDepartmentUserWorkspaceUiState(args: {
    planId: string;
    state: DepartmentUserWorkspaceUiState;
    userId: string;
}): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(
            createDepartmentUserWorkspaceUiStateStorageKey(args),
            serializeDepartmentUserWorkspaceUiState(args.state),
        );
    } catch {
        // Local UI persistence must fail closed without breaking the editor.
    }
}
