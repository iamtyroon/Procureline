import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
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

    return completedTests;
}
