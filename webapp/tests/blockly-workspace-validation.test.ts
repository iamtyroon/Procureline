import assert from "node:assert/strict";
import {
    evaluateDepartmentUserWorkspaceValidation,
    getDepartmentUserQuantityFieldPrecision,
    normalizeDepartmentUserQuantityValue,
    summarizeDepartmentUserBlockValidationIssues,
} from "../lib/blockly/workspace-validation";

export function runBlocklyWorkspaceValidationTests(): string[] {
    const completedTests: string[] = [];

    const negativeQuantity = normalizeDepartmentUserQuantityValue({
        unitOfMeasurement: "each",
        value: -4,
    });
    assert.equal(negativeQuantity.normalizedValue, 0);
    assert.equal(negativeQuantity.message, "Quantity cannot be negative");
    completedTests.push("quantity normalization clamps negative Blockly values to zero with truthful feedback");

    const malformedQuantity = normalizeDepartmentUserQuantityValue({
        unitOfMeasurement: "each",
        value: "abc",
    });
    assert.equal(malformedQuantity.normalizedValue, 0);
    assert.equal(malformedQuantity.message, "Quantity must be a valid number");
    completedTests.push("quantity normalization fails closed for malformed Blockly payloads");

    const discreteQuantity = normalizeDepartmentUserQuantityValue({
        unitOfMeasurement: "box",
        value: "2.75",
    });
    assert.equal(discreteQuantity.normalizedValue, 2);
    assert.equal(discreteQuantity.message, "Whole numbers only for this unit");
    assert.equal(getDepartmentUserQuantityFieldPrecision("box"), 1);
    completedTests.push("discrete units stay whole-number only across live entry and hydration");

    const decimalQuantity = normalizeDepartmentUserQuantityValue({
        unitOfMeasurement: "kg",
        value: "2.75",
    });
    assert.equal(decimalQuantity.normalizedValue, 2.75);
    assert.equal(decimalQuantity.message, null);
    assert.equal(getDepartmentUserQuantityFieldPrecision("kg"), 0.01);
    completedTests.push("decimal-safe units preserve fractional quantities through the shared validator");

    const cappedQuantity = normalizeDepartmentUserQuantityValue({
        maxQuantity: 6,
        unitOfMeasurement: "liter",
        value: 9,
    });
    assert.equal(cappedQuantity.normalizedValue, 6);
    assert.equal(cappedQuantity.message, "Maximum quantity is 6");
    completedTests.push("quantity normalization enforces catalog max limits with truthful feedback");

    const cappedDiscreteQuantity = normalizeDepartmentUserQuantityValue({
        maxQuantity: 2,
        unitOfMeasurement: "each",
        value: "3.2",
    });
    assert.equal(cappedDiscreteQuantity.normalizedValue, 2);
    assert.equal(
        cappedDiscreteQuantity.message,
        "Whole numbers only for this unit. Maximum quantity is 2",
    );
    completedTests.push("quantity normalization preserves both integer-only and max-limit feedback when both rules trigger");

    assert.equal(
        summarizeDepartmentUserBlockValidationIssues([
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
        ]),
        "Whole numbers only for this unit. Maximum quantity is 2",
    );
    completedTests.push("validation warning summaries trim trailing punctuation before joining messages");

    const validationState = evaluateDepartmentUserWorkspaceValidation({
        budgetState: {
            canSubmitByBudget: false,
            reason:
                "Budget exceeded. Remove items or reduce quantities before submission can unlock.",
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

    assert.equal(validationState.hasBlockingIssues, true);
    assert.equal(validationState.submitBlockedReasons.length, 3);
    assert.equal(
        validationState.submitBlockedReasons[0],
        "Budget exceeded. Remove items or reduce quantities before submission can unlock.",
    );
    assert.equal(
        validationState.issues.some(
            (issue) =>
                issue.code === "duplicate_item" &&
                issue.blockId === "item-b" &&
                issue.message === "Item already in this category",
        ),
        true,
    );
    assert.equal(
        validationState.issues.some(
            (issue) =>
                issue.code === "inactive_item" &&
                issue.blockId === "item-c" &&
                issue.message === "This item is no longer available in the live catalog.",
        ),
        true,
    );
    assert.equal(
        validationState.issues.some(
            (issue) =>
                issue.code === "minimum_quantity_reference" &&
                issue.blockId === "item-a" &&
                issue.message === "Minimum catalog quantity is 3",
        ),
        true,
    );
    assert.equal(
        validationState.issues.some(
            (issue) =>
                issue.code === "duplicate_item" &&
                issue.blockId === "item-e",
        ),
        false,
    );
    completedTests.push("workspace validation blocks submit for duplicate, inactive, and over-budget states without false cross-category collisions");

    const zeroQuantityState = evaluateDepartmentUserWorkspaceValidation({
        categories: [
            {
                categoryId: "cat-services",
                categoryName: "Services",
                items: [
                    {
                        blockId: "block-training",
                        categoryId: "cat-services",
                        isActive: true,
                        itemDescription: "Training",
                        itemId: "item-training",
                        itemName: "Training",
                        quantities: { q1: 0, q2: 0, q3: 0, q4: 0 },
                        unitOfMeasurement: "each",
                    },
                ],
            },
        ],
    });
    assert.equal(zeroQuantityState.hasBlockingIssues, true);
    assert.equal(
        zeroQuantityState.submitBlockedReasons[0],
        "Training has zero quantity. Enter quantity or remove item.",
    );
    assert.equal(zeroQuantityState.issues[0]?.code, "zero_quantity");
    assert.equal(zeroQuantityState.issues[0]?.fixTarget?.type, "workspace_block");
    completedTests.push(
        "workspace validation blocks zero-total items and preserves a usable fix target for itemized submit review",
    );

    return completedTests;
}
