import assert from "node:assert/strict";
import {
    buildCategoryTierLimitState,
    buildCategoryToolboxStyle,
    buildCategoryWorkspaceSummary,
    getCategoryImportRowFailure,
    getCategoryIconOption,
    hasStoredCategoryDraft,
    hasMeaningfulCategoryDraftValues,
    normalizeCategoryColor,
    normalizeCategoryIcon,
    normalizeCategoryName,
} from "../lib/procurement-officer/categories";

export function runProcurementOfficerCategoryTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(normalizeCategoryName("  ICT   Equipment "), "ict equipment");
    assert.equal(normalizeCategoryColor("4a90d9"), "#4A90D9");
    assert.equal(normalizeCategoryColor("#bad"), undefined);
    assert.equal(normalizeCategoryIcon(" cpu "), "cpu");
    assert.equal(normalizeCategoryIcon("unsafe"), undefined);
    assert.equal(getCategoryIconOption("cpu")?.label, "Technology");
    completedTests.push(
        "category normalization helpers collapse whitespace, canonicalize safe hex colors, and reject unsupported icon values before they reach storage or Blockly",
    );

    assert.equal(
        hasMeaningfulCategoryDraftValues({
            color: "",
            description: "  ",
            icon: null,
            name: "",
        }),
        false,
    );
    assert.equal(
        hasMeaningfulCategoryDraftValues({
            color: "",
            description: "",
            icon: "cpu",
            name: "",
        }),
        true,
    );
    assert.equal(
        hasStoredCategoryDraft(
            JSON.stringify({
                color: "#4A90D9",
                description: "",
                icon: "cpu",
                id: "",
                name: "ICT Equipment",
                revision: 0,
            }),
        ),
        true,
    );
    assert.equal(
        hasStoredCategoryDraft(
            JSON.stringify({
                color: "",
                description: "   ",
                icon: "",
                id: "",
                name: "",
                revision: 0,
            }),
        ),
        false,
    );
    completedTests.push(
        "category draft helpers distinguish empty close states from restored or in-progress drafts so both the editor dialog and outer workspace modal can confirm before discarding real work",
    );

    assert.deepEqual(
        buildCategoryTierLimitState({
            activeCategoryCount: 20,
            tier: "free",
        }),
        {
            atLimit: true,
            limit: 20,
            remainingSlots: 0,
            tier: "free",
            tierLabel: "Free",
            upgradeHref: "/pricing",
        },
    );
    assert.equal(
        buildCategoryTierLimitState({
            activeCategoryCount: 199,
            tier: "professional",
        }).remainingSlots,
        1,
    );
    assert.equal(
        buildCategoryTierLimitState({
            activeCategoryCount: 500,
            tier: "enterprise",
        }).limit,
        null,
    );
    completedTests.push(
        "category tier helpers enforce the live Free, Starter, Professional, and Enterprise caps without treating archived replacements as billable new slots",
    );

    const workspaceSummary = buildCategoryWorkspaceSummary({
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
    assert.deepEqual(
        workspaceSummary.rows.map((row) => row.id),
        ["cat-1", "cat-2", "cat-3"],
    );
    assert.equal(workspaceSummary.rows[0]?.planningStateLabel, "Referenced by draft plan");
    assert.equal(workspaceSummary.rows[1]?.deleteBlockers.canDelete, true);
    assert.equal(workspaceSummary.rows[2]?.deleteBlockers.canDelete, false);
    assert.equal(workspaceSummary.rows[2]?.itemCount, 0);
    assert.equal(workspaceSummary.rows[2]?.archivedLabel, "Archived");
    completedTests.push(
        "category workspace shaping keeps explicit order, active-first visibility, live item counts, truthful delete blockers, and archived labeling aligned for the PO modal list",
    );

    const toolboxStyle = buildCategoryToolboxStyle({
        color: "4a90d9",
        icon: "cpu",
    });
    assert.equal(toolboxStyle.colour, "#4A90D9");
    assert.equal(toolboxStyle.cssConfig.container, "pl-toolbox-category pl-toolbox-category--cpu");
    assert.equal(toolboxStyle.cssConfig.icon, "pl-toolbox-category__icon");
    completedTests.push(
        "category toolbox styling derives normalized Blockly colour and stable cssConfig hooks from stored category metadata instead of hard-coded fallback colours",
    );

    assert.equal(
        getCategoryImportRowFailure({
            activeCategoryCount: 3,
            activeNameSet: new Set<string>(),
            colorInput: "",
            createdCount: 0,
            description: "",
            limit: 20,
            name: "",
            normalizedName: "",
            seenInFile: new Set<string>(),
        }),
        "Name is required",
    );
    assert.equal(
        getCategoryImportRowFailure({
            activeCategoryCount: 3,
            activeNameSet: new Set<string>(["ict equipment"]),
            colorInput: "",
            createdCount: 0,
            description: "",
            limit: 20,
            name: "ICT Equipment",
            normalizedName: "ict equipment",
            seenInFile: new Set<string>(),
        }),
        "Category name already exists",
    );
    assert.equal(
        getCategoryImportRowFailure({
            activeCategoryCount: 3,
            activeNameSet: new Set<string>(),
            colorInput: "#bad",
            createdCount: 0,
            description: "",
            limit: 20,
            name: "New Category",
            normalizedName: "new category",
            seenInFile: new Set<string>(),
        }),
        "Category color must be a valid hex color",
    );
    assert.equal(
        getCategoryImportRowFailure({
            activeCategoryCount: 20,
            activeNameSet: new Set<string>(),
            colorInput: "",
            createdCount: 0,
            description: "",
            limit: 20,
            name: "Overflow",
            normalizedName: "overflow",
            seenInFile: new Set<string>(),
        }),
        "Category limit reached for this plan tier.",
    );
    assert.equal(
        getCategoryImportRowFailure({
            activeCategoryCount: 3,
            activeNameSet: new Set<string>(),
            colorInput: "#4A90D9",
            createdCount: 0,
            description: "",
            limit: 20,
            name: "Repeated",
            normalizedName: "repeated",
            seenInFile: new Set<string>(["repeated"]),
        }),
        "This category name appears more than once in the workbook.",
    );
    assert.equal(
        getCategoryImportRowFailure({
            activeCategoryCount: 3,
            activeNameSet: new Set<string>(),
            colorInput: "#4A90D9",
            createdCount: 0,
            description: "x".repeat(501),
            limit: 20,
            name: "Verbose Category",
            normalizedName: "verbose category",
            seenInFile: new Set<string>(),
        }),
        "Description must be 500 characters or less",
    );
    completedTests.push(
        "category import validation helpers now cover blank names, tenant duplicates, invalid colors, overlong descriptions, tier-cap overflow, and duplicate workbook rows before the mutation writes anything",
    );

    return completedTests;
}
