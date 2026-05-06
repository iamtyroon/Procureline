"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeDepartmentUserWorkspaceUiState = exports.readDepartmentUserWorkspaceUiState = exports.restoreDepartmentUserWorkspaceUiState = exports.parseDepartmentUserWorkspaceUiState = exports.serializeDepartmentUserWorkspaceUiState = exports.normalizeDepartmentUserWorkspaceUiState = exports.createDepartmentUserWorkspaceUiStateStorageKey = void 0;
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function createDepartmentUserWorkspaceUiStateStorageKey(args) {
    return `procureline:blockly-ui:${args.userId}:${args.planId}`;
}
exports.createDepartmentUserWorkspaceUiStateStorageKey = createDepartmentUserWorkspaceUiStateStorageKey;
function normalizeDepartmentUserWorkspaceUiState(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const candidate = value;
    if (!isFiniteNumber(candidate.scale) ||
        !isFiniteNumber(candidate.viewLeft) ||
        !isFiniteNumber(candidate.viewTop)) {
        return null;
    }
    return {
        scale: candidate.scale,
        viewLeft: candidate.viewLeft,
        viewTop: candidate.viewTop,
    };
}
exports.normalizeDepartmentUserWorkspaceUiState = normalizeDepartmentUserWorkspaceUiState;
function serializeDepartmentUserWorkspaceUiState(value) {
    return JSON.stringify(value);
}
exports.serializeDepartmentUserWorkspaceUiState = serializeDepartmentUserWorkspaceUiState;
function parseDepartmentUserWorkspaceUiState(raw) {
    if (!raw) {
        return null;
    }
    try {
        return normalizeDepartmentUserWorkspaceUiState(JSON.parse(raw));
    }
    catch {
        return null;
    }
}
exports.parseDepartmentUserWorkspaceUiState = parseDepartmentUserWorkspaceUiState;
function restoreDepartmentUserWorkspaceUiState(args) {
    if (!args.state) {
        return false;
    }
    args.workspace.setScale(args.state.scale);
    args.workspace.scroll(-args.state.viewLeft, -args.state.viewTop);
    return true;
}
exports.restoreDepartmentUserWorkspaceUiState = restoreDepartmentUserWorkspaceUiState;
function readDepartmentUserWorkspaceUiState(args) {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        return parseDepartmentUserWorkspaceUiState(window.localStorage.getItem(createDepartmentUserWorkspaceUiStateStorageKey(args)));
    }
    catch {
        return null;
    }
}
exports.readDepartmentUserWorkspaceUiState = readDepartmentUserWorkspaceUiState;
function writeDepartmentUserWorkspaceUiState(args) {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(createDepartmentUserWorkspaceUiStateStorageKey(args), serializeDepartmentUserWorkspaceUiState(args.state));
    }
    catch {
        // Local UI persistence must fail closed without breaking the editor.
    }
}
exports.writeDepartmentUserWorkspaceUiState = writeDepartmentUserWorkspaceUiState;
