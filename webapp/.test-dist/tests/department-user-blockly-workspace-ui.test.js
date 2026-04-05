"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserBlocklyWorkspaceUiTests = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const strict_1 = __importDefault(require("node:assert/strict"));
const server_1 = require("react-dom/server");
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
    return completedTests;
}
exports.runDepartmentUserBlocklyWorkspaceUiTests = runDepartmentUserBlocklyWorkspaceUiTests;
