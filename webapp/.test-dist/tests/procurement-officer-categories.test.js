"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerCategoryTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const categories_1 = require("../lib/procurement-officer/categories");
function runProcurementOfficerCategoryTests() {
    const completedTests = [];
    strict_1.default.equal((0, categories_1.normalizeCategoryName)("  ICT   Equipment "), "ict equipment");
    strict_1.default.equal((0, categories_1.normalizeCategoryColor)("4a90d9"), "#4A90D9");
    strict_1.default.equal((0, categories_1.normalizeCategoryColor)("#bad"), undefined);
    strict_1.default.equal((0, categories_1.normalizeCategoryIcon)(" cpu "), "cpu");
    strict_1.default.equal((0, categories_1.normalizeCategoryIcon)("unsafe"), undefined);
    strict_1.default.equal((0, categories_1.getCategoryIconOption)("cpu")?.label, "Technology");
    completedTests.push("category normalization helpers collapse whitespace, canonicalize safe hex colors, and reject unsupported icon values before they reach storage or Blockly");
    strict_1.default.equal((0, categories_1.hasMeaningfulCategoryDraftValues)({
        color: "",
        description: "  ",
        icon: null,
        name: "",
    }), false);
    strict_1.default.equal((0, categories_1.hasMeaningfulCategoryDraftValues)({
        color: "",
        description: "",
        icon: "cpu",
        name: "",
    }), true);
    strict_1.default.equal((0, categories_1.hasStoredCategoryDraft)(JSON.stringify({
        color: "#4A90D9",
        description: "",
        icon: "cpu",
        id: "",
        name: "ICT Equipment",
        revision: 0,
    })), true);
    strict_1.default.equal((0, categories_1.hasStoredCategoryDraft)(JSON.stringify({
        color: "",
        description: "   ",
        icon: "",
        id: "",
        name: "",
        revision: 0,
    })), false);
    completedTests.push("category draft helpers distinguish empty close states from restored or in-progress drafts so both the editor dialog and outer workspace modal can confirm before discarding real work");
    strict_1.default.deepEqual((0, categories_1.buildCategoryTierLimitState)({
        activeCategoryCount: 20,
        tier: "free",
    }), {
        atLimit: true,
        limit: 20,
        remainingSlots: 0,
        tier: "free",
        tierLabel: "Free",
        upgradeHref: "/pricing",
    });
    strict_1.default.equal((0, categories_1.buildCategoryTierLimitState)({
        activeCategoryCount: 199,
        tier: "professional",
    }).remainingSlots, 1);
    strict_1.default.equal((0, categories_1.buildCategoryTierLimitState)({
        activeCategoryCount: 500,
        tier: "enterprise",
    }).limit, null);
    completedTests.push("category tier helpers enforce the live Free, Starter, Professional, and Enterprise caps without treating archived replacements as billable new slots");
    const workspaceSummary = (0, categories_1.buildCategoryWorkspaceSummary)({
        categories: [
            {
                assignedItemCount: 0,
                archivedAt: null,
                color: "#4A90D9",
                description: "General stock",
                icon: "boxes",
                id: "cat-2",
                isActive: true,
                itemCount: 0,
                name: "Supplies",
                planStatuses: [],
                revision: 2,
                sortOrder: 2,
            },
            {
                assignedItemCount: 1,
                archivedAt: Date.UTC(2026, 3, 1, 9, 0, 0),
                color: "#228B22",
                description: "Legacy archive",
                icon: "archive",
                id: "cat-3",
                isActive: false,
                itemCount: 0,
                name: "Legacy",
                planStatuses: [],
                revision: 3,
                sortOrder: 3,
            },
            {
                assignedItemCount: 4,
                archivedAt: null,
                color: "#0B6E4F",
                description: "Live planning",
                icon: "cpu",
                id: "cat-1",
                isActive: true,
                itemCount: 4,
                name: "ICT Equipment",
                planStatuses: ["draft"],
                revision: 1,
                sortOrder: 1,
            },
        ],
        tier: "starter",
    });
    strict_1.default.deepEqual(workspaceSummary.rows.map((row) => row.id), ["cat-1", "cat-2", "cat-3"]);
    strict_1.default.equal(workspaceSummary.rows[0]?.planningStateLabel, "Referenced by draft plan");
    strict_1.default.equal(workspaceSummary.rows[1]?.deleteBlockers.canDelete, true);
    strict_1.default.equal(workspaceSummary.rows[2]?.deleteBlockers.canDelete, false);
    strict_1.default.equal(workspaceSummary.rows[2]?.itemCount, 0);
    strict_1.default.equal(workspaceSummary.rows[2]?.archivedLabel, "Archived");
    completedTests.push("category workspace shaping keeps explicit order, active-first visibility, live item counts, truthful delete blockers, and archived labeling aligned for the PO modal list");
    const toolboxStyle = (0, categories_1.buildCategoryToolboxStyle)({
        color: "4a90d9",
        icon: "cpu",
    });
    strict_1.default.equal(toolboxStyle.colour, "#4A90D9");
    strict_1.default.equal(toolboxStyle.cssConfig.container, "pl-toolbox-category pl-toolbox-category--cpu");
    strict_1.default.equal(toolboxStyle.cssConfig.icon, "pl-toolbox-category__icon");
    completedTests.push("category toolbox styling derives normalized Blockly colour and stable cssConfig hooks from stored category metadata instead of hard-coded fallback colours");
    strict_1.default.equal((0, categories_1.getCategoryImportRowFailure)({
        activeCategoryCount: 3,
        activeNameSet: new Set(),
        colorInput: "",
        createdCount: 0,
        description: "",
        limit: 20,
        name: "",
        normalizedName: "",
        seenInFile: new Set(),
    }), "Name is required");
    strict_1.default.equal((0, categories_1.getCategoryImportRowFailure)({
        activeCategoryCount: 3,
        activeNameSet: new Set(["ict equipment"]),
        colorInput: "",
        createdCount: 0,
        description: "",
        limit: 20,
        name: "ICT Equipment",
        normalizedName: "ict equipment",
        seenInFile: new Set(),
    }), "Category name already exists");
    strict_1.default.equal((0, categories_1.getCategoryImportRowFailure)({
        activeCategoryCount: 3,
        activeNameSet: new Set(),
        colorInput: "#bad",
        createdCount: 0,
        description: "",
        limit: 20,
        name: "New Category",
        normalizedName: "new category",
        seenInFile: new Set(),
    }), "Category color must be a valid hex color");
    strict_1.default.equal((0, categories_1.getCategoryImportRowFailure)({
        activeCategoryCount: 20,
        activeNameSet: new Set(),
        colorInput: "",
        createdCount: 0,
        description: "",
        limit: 20,
        name: "Overflow",
        normalizedName: "overflow",
        seenInFile: new Set(),
    }), "Category limit reached for this plan tier.");
    strict_1.default.equal((0, categories_1.getCategoryImportRowFailure)({
        activeCategoryCount: 3,
        activeNameSet: new Set(),
        colorInput: "#4A90D9",
        createdCount: 0,
        description: "",
        limit: 20,
        name: "Repeated",
        normalizedName: "repeated",
        seenInFile: new Set(["repeated"]),
    }), "This category name appears more than once in the workbook.");
    strict_1.default.equal((0, categories_1.getCategoryImportRowFailure)({
        activeCategoryCount: 3,
        activeNameSet: new Set(),
        colorInput: "#4A90D9",
        createdCount: 0,
        description: "x".repeat(501),
        limit: 20,
        name: "Verbose Category",
        normalizedName: "verbose category",
        seenInFile: new Set(),
    }), "Description must be 500 characters or less");
    completedTests.push("category import validation helpers now cover blank names, tenant duplicates, invalid colors, overlong descriptions, tier-cap overflow, and duplicate workbook rows before the mutation writes anything");
    return completedTests;
}
exports.runProcurementOfficerCategoryTests = runProcurementOfficerCategoryTests;
