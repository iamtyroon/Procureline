"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBlocklyWorkspaceValidationTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const workspace_validation_1 = require("../lib/blockly/workspace-validation");
function runBlocklyWorkspaceValidationTests() {
    const completedTests = [];
    const negativeQuantity = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
        unitOfMeasurement: "each",
        value: -4,
    });
    strict_1.default.equal(negativeQuantity.normalizedValue, 0);
    strict_1.default.equal(negativeQuantity.message, "Quantity cannot be negative");
    completedTests.push("quantity normalization clamps negative Blockly values to zero with truthful feedback");
    const malformedQuantity = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
        unitOfMeasurement: "each",
        value: "abc",
    });
    strict_1.default.equal(malformedQuantity.normalizedValue, 0);
    strict_1.default.equal(malformedQuantity.message, "Quantity must be a valid number");
    completedTests.push("quantity normalization fails closed for malformed Blockly payloads");
    const discreteQuantity = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
        unitOfMeasurement: "box",
        value: "2.75",
    });
    strict_1.default.equal(discreteQuantity.normalizedValue, 2);
    strict_1.default.equal(discreteQuantity.message, "Whole numbers only for this unit");
    strict_1.default.equal((0, workspace_validation_1.getDepartmentUserQuantityFieldPrecision)("box"), 1);
    completedTests.push("discrete units stay whole-number only across live entry and hydration");
    const decimalQuantity = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
        unitOfMeasurement: "kg",
        value: "2.75",
    });
    strict_1.default.equal(decimalQuantity.normalizedValue, 2.75);
    strict_1.default.equal(decimalQuantity.message, null);
    strict_1.default.equal((0, workspace_validation_1.getDepartmentUserQuantityFieldPrecision)("kg"), 0.01);
    completedTests.push("decimal-safe units preserve fractional quantities through the shared validator");
    const cappedQuantity = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
        maxQuantity: 6,
        unitOfMeasurement: "liter",
        value: 9,
    });
    strict_1.default.equal(cappedQuantity.normalizedValue, 6);
    strict_1.default.equal(cappedQuantity.message, "Maximum quantity is 6");
    completedTests.push("quantity normalization enforces catalog max limits with truthful feedback");
    const cappedDiscreteQuantity = (0, workspace_validation_1.normalizeDepartmentUserQuantityValue)({
        maxQuantity: 2,
        unitOfMeasurement: "each",
        value: "3.2",
    });
    strict_1.default.equal(cappedDiscreteQuantity.normalizedValue, 2);
    strict_1.default.equal(cappedDiscreteQuantity.message, "Whole numbers only for this unit. Maximum quantity is 2");
    completedTests.push("quantity normalization preserves both integer-only and max-limit feedback when both rules trigger");
    strict_1.default.equal((0, workspace_validation_1.summarizeDepartmentUserBlockValidationIssues)([
        {
            blockId: "item-a",
            blocksSubmission: false,
            categoryId: "cat-it",
            code: "whole_number_required",
            itemId: "item-a",
            itemName: "Laptop",
            message: "Whole numbers only for this unit.",
            quantityKey: "q1",
            severity: "warning",
        },
        {
            blockId: "item-a",
            blocksSubmission: false,
            categoryId: "cat-it",
            code: "maximum_quantity",
            itemId: "item-a",
            itemName: "Laptop",
            message: "Maximum quantity is 2!",
            quantityKey: "q1",
            severity: "warning",
        },
    ]), "Whole numbers only for this unit. Maximum quantity is 2");
    completedTests.push("validation warning summaries trim trailing punctuation before joining messages");
    const validationState = (0, workspace_validation_1.evaluateDepartmentUserWorkspaceValidation)({
        budgetState: {
            canSubmitByBudget: false,
            reason: "Budget exceeded. Remove items or reduce quantities before submission can unlock.",
        },
        categories: [
            {
                categoryId: "cat-it",
                categoryName: "ICT Equipment",
                items: [
                    {
                        blockId: "item-a",
                        categoryId: "cat-it",
                        itemDescription: "Laptops",
                        itemId: "item-laptop",
                        itemName: "Laptops",
                        isActive: true,
                        maxQuantity: 10,
                        minQuantity: 3,
                        quantities: { q1: 2, q2: 0, q3: 0, q4: 0 },
                        unitOfMeasurement: "each",
                    },
                    {
                        blockId: "item-b",
                        categoryId: "cat-it",
                        itemDescription: "Laptops Duplicate",
                        itemId: "item-laptop",
                        itemName: "Laptops",
                        isActive: true,
                        maxQuantity: 10,
                        minQuantity: 0,
                        quantities: { q1: 1, q2: 0, q3: 0, q4: 0 },
                        unitOfMeasurement: "each",
                    },
                ],
            },
            {
                categoryId: "cat-office",
                categoryName: "Office Supplies",
                items: [
                    {
                        blockId: "item-c",
                        categoryId: "cat-office",
                        itemDescription: "Legacy paper",
                        itemId: "item-paper",
                        itemName: "Printer Paper",
                        isActive: false,
                        maxQuantity: null,
                        minQuantity: null,
                        quantities: { q1: 4, q2: 0, q3: 0, q4: 0 },
                        unitOfMeasurement: "ream",
                    },
                    {
                        blockId: "item-d",
                        categoryId: "cat-office",
                        itemDescription: "Shared visible name",
                        itemId: "item-shared-office",
                        itemName: "Shared Name",
                        isActive: true,
                        maxQuantity: null,
                        minQuantity: null,
                        quantities: { q1: 1, q2: 0, q3: 0, q4: 0 },
                        unitOfMeasurement: "ream",
                    },
                ],
            },
            {
                categoryId: "cat-fleet",
                categoryName: "Fleet",
                items: [
                    {
                        blockId: "item-e",
                        categoryId: "cat-fleet",
                        itemDescription: "Shared visible name",
                        itemId: "item-shared-fleet",
                        itemName: "Shared Name",
                        isActive: true,
                        maxQuantity: null,
                        minQuantity: null,
                        quantities: { q1: 1, q2: 0, q3: 0, q4: 0 },
                        unitOfMeasurement: "each",
                    },
                ],
            },
        ],
    });
    strict_1.default.equal(validationState.hasBlockingIssues, true);
    strict_1.default.equal(validationState.submitBlockedReasons.length, 3);
    strict_1.default.equal(validationState.submitBlockedReasons[0], "Budget exceeded. Remove items or reduce quantities before submission can unlock.");
    strict_1.default.equal(validationState.issues.some((issue) => issue.code === "duplicate_item" &&
        issue.blockId === "item-b" &&
        issue.message === "Item already in this category"), true);
    strict_1.default.equal(validationState.issues.some((issue) => issue.code === "inactive_item" &&
        issue.blockId === "item-c" &&
        issue.message === "This item is no longer available in the live catalog."), true);
    strict_1.default.equal(validationState.issues.some((issue) => issue.code === "minimum_quantity_reference" &&
        issue.blockId === "item-a" &&
        issue.message === "Minimum catalog quantity is 3"), true);
    strict_1.default.equal(validationState.issues.some((issue) => issue.code === "duplicate_item" &&
        issue.blockId === "item-e"), false);
    completedTests.push("workspace validation blocks submit for duplicate, inactive, and over-budget states without false cross-category collisions");
    return completedTests;
}
exports.runBlocklyWorkspaceValidationTests = runBlocklyWorkspaceValidationTests;
