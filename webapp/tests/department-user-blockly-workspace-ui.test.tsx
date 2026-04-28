import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogRequestInbox } from "../src/components/blockly/CatalogRequestInbox";
import { BlocklyToolboxRail } from "../src/components/blockly/BlocklyToolboxRail";

export function runDepartmentUserBlocklyWorkspaceUiTests(): string[] {
    const completedTests: string[] = [];

    const readOnlyMarkup = renderToStaticMarkup(
        <BlocklyToolboxRail
            categories={[
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
            ]}
            department={{
                budgetAllocation: 2500000,
                name: "Computer Science",
                voteNumber: "CS-2026",
            }}
            mode="view"
            onSearchQueryChange={() => undefined}
            searchQuery="paper"
        />,
    );
    assert.match(readOnlyMarkup, /Toolbox search/);
    assert.match(readOnlyMarkup, /Read-only mode keeps search and category context visible/i);
    assert.match(readOnlyMarkup, /Office Supplies/);
    assert.match(readOnlyMarkup, /Read-only context/);
    assert.match(readOnlyMarkup, /1 matching item/);
    assert.match(readOnlyMarkup, /Computer Science/);
    assert.match(readOnlyMarkup, /CS-2026/);
    completedTests.push("Blockly toolbox rail renders read-only search and category context without implying edit actions");

    const emptySearchMarkup = renderToStaticMarkup(
        <BlocklyToolboxRail
            categories={[
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
            ]}
            department={{
                budgetAllocation: null,
                name: "Computer Science",
                voteNumber: "CS-2026",
            }}
            mode="edit"
            onSearchQueryChange={() => undefined}
            searchQuery="no-match"
        />,
    );
    assert.match(emptySearchMarkup, /No categories match this search/);
    assert.doesNotMatch(emptySearchMarkup, /Available to add/);
    completedTests.push("Blockly toolbox rail surfaces the no-match search empty state instead of implying stale toolbox availability");

    const editableInboxMarkup = renderToStaticMarkup(
        <CatalogRequestInbox
            mode="edit"
            onCancelRequest={() => undefined}
            onEditRequest={() => undefined}
            requests={[
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
            ]}
            summary={{
                pendingCategoryCount: 0,
                pendingItemCount: 1,
                totalCount: 2,
                totalPendingCount: 1,
            }}
        />,
    );
    assert.match(editableInboxMarkup, /Request inbox/i);
    assert.match(editableInboxMarkup, /Item request/i);
    assert.match(editableInboxMarkup, /Category request/i);
    assert.match(editableInboxMarkup, /Pending/i);
    assert.match(editableInboxMarkup, /Denied/i);
    assert.match(editableInboxMarkup, /Edit/i);
    assert.match(editableInboxMarkup, /Cancel/i);
    assert.match(editableInboxMarkup, /Existing archived category covers this request/i);
    completedTests.push("catalog request inbox renders mixed item and category statuses with truthful edit and cancel affordances only for pending DU-owned requests");

    const readOnlyInboxMarkup = renderToStaticMarkup(
        <CatalogRequestInbox
            mode="view"
            onCancelRequest={() => undefined}
            onEditRequest={() => undefined}
            requests={[
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
            ]}
            summary={{
                pendingCategoryCount: 0,
                pendingItemCount: 0,
                totalCount: 1,
                totalPendingCount: 0,
            }}
        />,
    );
    assert.match(readOnlyInboxMarkup, /Statuses stay visible in read-only mode/i);
    assert.doesNotMatch(readOnlyInboxMarkup, />Edit</);
    assert.doesNotMatch(readOnlyInboxMarkup, />Cancel</);
    assert.match(readOnlyInboxMarkup, /Expired: Submission window ended before review/i);
    completedTests.push("catalog request inbox keeps historical DU request outcomes visible in read-only mode without implying pending write access");

    const blocklyEditorSource = fs.readFileSync(
        path.join(process.cwd(), "src", "components", "blockly", "BlocklyEditor.tsx"),
        "utf8",
    );
    assert.match(blocklyEditorSource, /fixTarget\.type === "deadline_summary"/);
    assert.match(blocklyEditorSource, /fixTarget\.type === "workspace_category"/);
    assert.match(blocklyEditorSource, /data-du-deadline-summary/);
    assert.match(blocklyEditorSource, /data-du-category-summary/);
    completedTests.push("submit-review fix targets now include deadline and category anchors instead of falling through to stale-target messaging");

    return completedTests;
}
