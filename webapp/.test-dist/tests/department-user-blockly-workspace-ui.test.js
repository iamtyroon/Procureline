"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserBlocklyWorkspaceUiTests = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const server_1 = require("react-dom/server");
const CatalogRequestInbox_1 = require("../src/components/blockly/CatalogRequestInbox");
const BlocklyToolboxRail_1 = require("../src/components/blockly/BlocklyToolboxRail");
function runDepartmentUserBlocklyWorkspaceUiTests() {
    const completedTests = [];
    const readOnlyMarkup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(BlocklyToolboxRail_1.BlocklyToolboxRail, { categories: [
            {
                id: "cat-office",
                isUnavailable: false,
                isUsedOnWorkspace: false,
                itemCount: 3,
                matchingItemCount: 1,
                name: "Office Supplies",
                previewColor: "#B45309",
                previewIcon: "boxes",
                sourceBlockVisible: false,
                unavailableReason: null,
            },
        ], department: {
            budgetAllocation: 2500000,
            name: "Computer Science",
            voteNumber: "CS-2026",
        }, mode: "view", onSearchQueryChange: () => undefined, searchQuery: "paper" }));
    strict_1.default.match(readOnlyMarkup, /Toolbox search/);
    strict_1.default.match(readOnlyMarkup, /Read-only mode keeps search and category context visible/i);
    strict_1.default.match(readOnlyMarkup, /Office Supplies/);
    strict_1.default.match(readOnlyMarkup, /Read-only context/);
    strict_1.default.match(readOnlyMarkup, /1 matching item/);
    strict_1.default.match(readOnlyMarkup, /Computer Science/);
    strict_1.default.match(readOnlyMarkup, /CS-2026/);
    completedTests.push("Blockly toolbox rail renders read-only search and category context without implying edit actions");
    const emptySearchMarkup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(BlocklyToolboxRail_1.BlocklyToolboxRail, { categories: [
            {
                id: "cat-it",
                isUnavailable: false,
                isUsedOnWorkspace: true,
                itemCount: 2,
                matchingItemCount: 0,
                name: "ICT Equipment",
                previewColor: "#0B6E4F",
                previewIcon: "cpu",
                sourceBlockVisible: false,
                unavailableReason: null,
            },
        ], department: {
            budgetAllocation: null,
            name: "Computer Science",
            voteNumber: "CS-2026",
        }, mode: "edit", onSearchQueryChange: () => undefined, searchQuery: "no-match" }));
    strict_1.default.match(emptySearchMarkup, /No categories match this search/);
    strict_1.default.doesNotMatch(emptySearchMarkup, /Available to add/);
    completedTests.push("Blockly toolbox rail surfaces the no-match search empty state instead of implying stale toolbox availability");
    const editableInboxMarkup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(CatalogRequestInbox_1.CatalogRequestInbox, { mode: "edit", onCancelRequest: () => undefined, onEditRequest: () => undefined, requests: [
            {
                canCancel: true,
                canEdit: true,
                createdAtLabel: "12 Apr 2026",
                id: "item-request-1",
                reason: null,
                status: "pending",
                statusLabel: "Pending",
                submittedAtLabel: "12 Apr 2026",
                summary: "Laptop docking station",
                type: "item",
                typeLabel: "Item request",
                updatedAtLabel: "12 Apr 2026",
            },
            {
                canCancel: false,
                canEdit: false,
                createdAtLabel: "11 Apr 2026",
                id: "category-request-1",
                reason: "Denied: Existing archived category covers this request.",
                status: "denied",
                statusLabel: "Denied",
                submittedAtLabel: "11 Apr 2026",
                summary: "Laboratory Equipment",
                type: "category",
                typeLabel: "Category request",
                updatedAtLabel: "11 Apr 2026",
            },
        ], summary: {
            pendingCategoryCount: 0,
            pendingItemCount: 1,
            totalCount: 2,
            totalPendingCount: 1,
        } }));
    strict_1.default.match(editableInboxMarkup, /Request inbox/i);
    strict_1.default.match(editableInboxMarkup, /Item request/i);
    strict_1.default.match(editableInboxMarkup, /Category request/i);
    strict_1.default.match(editableInboxMarkup, /Pending/i);
    strict_1.default.match(editableInboxMarkup, /Denied/i);
    strict_1.default.match(editableInboxMarkup, /Edit/i);
    strict_1.default.match(editableInboxMarkup, /Cancel/i);
    strict_1.default.match(editableInboxMarkup, /Existing archived category covers this request/i);
    completedTests.push("catalog request inbox renders mixed item and category statuses with truthful edit and cancel affordances only for pending DU-owned requests");
    const readOnlyInboxMarkup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(CatalogRequestInbox_1.CatalogRequestInbox, { mode: "view", onCancelRequest: () => undefined, onEditRequest: () => undefined, requests: [
            {
                canCancel: false,
                canEdit: false,
                createdAtLabel: "10 Apr 2026",
                id: "expired-request-1",
                reason: "Expired: Submission window ended before review.",
                status: "expired",
                statusLabel: "Expired",
                submittedAtLabel: "10 Apr 2026",
                summary: "Science Consumables",
                type: "category",
                typeLabel: "Category request",
                updatedAtLabel: "12 Apr 2026",
            },
        ], summary: {
            pendingCategoryCount: 0,
            pendingItemCount: 0,
            totalCount: 1,
            totalPendingCount: 0,
        } }));
    strict_1.default.match(readOnlyInboxMarkup, /Statuses stay visible in read-only mode/i);
    strict_1.default.doesNotMatch(readOnlyInboxMarkup, />Edit</);
    strict_1.default.doesNotMatch(readOnlyInboxMarkup, />Cancel</);
    strict_1.default.match(readOnlyInboxMarkup, /Expired: Submission window ended before review/i);
    completedTests.push("catalog request inbox keeps historical DU request outcomes visible in read-only mode without implying pending write access");
    const blocklyEditorSource = node_fs_1.default.readFileSync(node_path_1.default.join(process.cwd(), "src", "components", "blockly", "BlocklyEditor.tsx"), "utf8");
    strict_1.default.match(blocklyEditorSource, /fixTarget\.type === "deadline_summary"/);
    strict_1.default.match(blocklyEditorSource, /fixTarget\.type === "workspace_category"/);
    strict_1.default.match(blocklyEditorSource, /data-du-deadline-summary/);
    strict_1.default.match(blocklyEditorSource, /data-du-category-summary/);
    strict_1.default.match(blocklyEditorSource, /Effective revision deadline:/);
    strict_1.default.match(blocklyEditorSource, /Jump to fix/);
    strict_1.default.match(blocklyEditorSource, /data-du-revision-history/);
    strict_1.default.match(blocklyEditorSource, /props\.planMeta\.timeZone/);
    completedTests.push("submit-review fix targets now include deadline and category anchors instead of falling through to stale-target messaging");
    const dashboardSource = node_fs_1.default.readFileSync(node_path_1.default.join(process.cwd(), "src", "components", "department-user", "DepartmentUserDashboard.tsx"), "utf8");
    strict_1.default.match(dashboardSource, /Request approved plan reopen/);
    strict_1.default.match(dashboardSource, /Request reopen approval/);
    strict_1.default.doesNotMatch(dashboardSource, />\s*Request redraft\s*</);
    completedTests.push("approved-plan reopen affordances now use explicit PO-approval reopen copy instead of the old redraft wording");
    return completedTests;
}
exports.runDepartmentUserBlocklyWorkspaceUiTests = runDepartmentUserBlocklyWorkspaceUiTests;
