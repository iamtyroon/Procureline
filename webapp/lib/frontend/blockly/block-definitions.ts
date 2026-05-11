import {
    getDepartmentUserQuantityFieldPrecision,
    normalizeDepartmentUserQuantityValue,
} from "@/lib/shared/blockly/workspace-validation";

type BlocklyModule = typeof import("blockly");
type BlocklyAny = BlocklyModule & {
    Blocks: Record<string, any>;
};

const RIGHT_ARROW_ICON =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M6 4l4 4-4 4' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const DOWN_ARROW_ICON =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

let blocksRegistered = false;

// Aggregate summary spacing lives here. Tune each row and quarter independently.
// Example: increase AGGREGATE_SUMMARY_SPACING.AGPO.q3 to push only AGPO Q3 right.
const AGGREGATE_SUMMARY_SPACING = {
    AGG: { q1: 11, q2: 5, q3: 5, q4: 5 },
    AGPO: { q1: 19, q2: 5, q3: 5, q4: 5 },
    LOCAL: { q1: 11, q2: 5, q3: 5, q4: 5 },
    PWD: { q1: 28, q2: 21.7, q3: 21.4, q4: 21 },
} as const;
// Main amount spacing controls the gap between each row's KES label and its
// first calculated value field. Tune these to align the main KES value column.
const AGGREGATE_MAIN_AMOUNT_SPACING = {
    AGG: 1,
    AGPO: 1,
    LOCAL: 1,
    PWD: 1,
} as const;
// KES label spacing controls the gap between each row name and the "KES" label.
// Tune these to align the KES labels into one vertical column.
const AGGREGATE_KES_LABEL_SPACING = {
    AGG: 1,
    AGPO: 18,
    LOCAL: 13,
    PWD: 34,
} as const;
// Category width is mostly driven by the width of the item rows nested inside it.
// To thin the blue empty area inside categories, reduce item row content width
// or move category total fields left; do not add category header spacers.
// Item row spacing controls optional gaps inside orange item rows. Lower values
// keep category blocks thinner because category width follows item row width.
const ITEM_ROW_SPACING = {
    beforeQty: 1,
    beforeTotal: 1,
} as const;

const TIMING_FIELD_LABELS = [
    "Time process days:",
    "Invite/Advertisement:",
    "Bid Opening:",
    "Bid Evaluation:",
    "Tender Award:",
    "Notification of Award:",
    "Contract Signing:",
    "Total Time for Contract:",
    "Date of Completion:",
] as const;

function createAggregateReadonlyAmountField(
    Blockly: BlocklyAny,
    value = "0.00",
): any {
    const field = new Blockly.FieldTextInput(value);
    field.setEnabled(false);
    field.SERIALIZABLE = true;
    return field;
}

function createReadonlyTextField(Blockly: BlocklyAny, value: string): any {
    const field = new Blockly.FieldTextInput(value);
    field.setEnabled(false);
    field.SERIALIZABLE = true;
    return field;
}

function createReadonlyLabelField(Blockly: BlocklyAny, value: string): any {
    return new Blockly.FieldLabelSerializable(value);
}

function createAggregateSpacerField(Blockly: BlocklyAny, width: number): any {
    // Blockly has no simple flex/grid layout for fields, so transparent 1px images
    // are used as fixed-width spacers between calculated summary fields.
    return new Blockly.FieldImage(
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        width,
        1,
        "",
    );
}

function appendAggregateQuarterFields(
    input: any,
    Blockly: BlocklyAny,
    fieldPrefix: "AGG" | "AGPO" | "LOCAL" | "PWD",
): void {
    const spacing = AGGREGATE_SUMMARY_SPACING[fieldPrefix];
    // This controls the Q1-Q4 layout for GRAND TOTAL, AGPO, PWD, and LOCAL rows.
    // The calculated values are disabled text inputs, so users cannot edit them,
    // but auto-calculation can still update them with setFieldValue().
    input.appendField(createAggregateSpacerField(Blockly, spacing.q1))
        .appendField("Q1")
        .appendField(createAggregateReadonlyAmountField(Blockly), `${fieldPrefix}_Q1_TOTAL`)
        .appendField(createAggregateSpacerField(Blockly, spacing.q2))
        .appendField("Q2")
        .appendField(createAggregateReadonlyAmountField(Blockly), `${fieldPrefix}_Q2_TOTAL`)
        .appendField(createAggregateSpacerField(Blockly, spacing.q3))
        .appendField("Q3")
        .appendField(createAggregateReadonlyAmountField(Blockly), `${fieldPrefix}_Q3_TOTAL`)
        .appendField(createAggregateSpacerField(Blockly, spacing.q4))
        .appendField("Q4")
        .appendField(createAggregateReadonlyAmountField(Blockly), `${fieldPrefix}_Q4_TOTAL`);
}

function appendAggregateMainAmountField(
    input: any,
    Blockly: BlocklyAny,
    fieldPrefix: "AGG" | "AGPO" | "LOCAL" | "PWD",
    fieldName: string,
): void {
    input.appendField(
        createAggregateSpacerField(
            Blockly,
            AGGREGATE_MAIN_AMOUNT_SPACING[fieldPrefix],
        ),
    ).appendField(createAggregateReadonlyAmountField(Blockly), fieldName);
}

function appendAggregateKesLabel(
    input: any,
    Blockly: BlocklyAny,
    fieldPrefix: "AGG" | "AGPO" | "LOCAL" | "PWD",
): void {
    input.appendField(
        createAggregateSpacerField(
            Blockly,
            AGGREGATE_KES_LABEL_SPACING[fieldPrefix],
        ),
    ).appendField("KES");
}

function createQuarterQuantityField(
    Blockly: BlocklyAny,
    fieldName: "Q1_QTY" | "Q2_QTY" | "Q3_QTY" | "Q4_QTY",
): any {
    const field = new Blockly.FieldNumber(0, 0, undefined, 0.01);
    field.setValidator(function quantityValidator(this: {
        getSourceBlock?: () => {
            getFieldValue(name: string): string;
            __duQuantityFeedback?: Partial<Record<string, string>>;
        } | null;
    }, newValue: string | number | null | undefined) {
        const sourceBlock = this.getSourceBlock?.() ?? null;
        const maxQuantityRaw = sourceBlock?.getFieldValue("MAX_QUANTITY");
        const normalizedValue = normalizeDepartmentUserQuantityValue({
            maxQuantity:
                (maxQuantityRaw ?? "").trim().length > 0
                    ? Number(maxQuantityRaw)
                    : null,
            unitOfMeasurement: sourceBlock?.getFieldValue("UNIT_OF_MEASUREMENT"),
            value: newValue,
        });
        const nextQuantityFeedback = {
            ...(sourceBlock?.__duQuantityFeedback ?? {}),
        };

        if (normalizedValue.message) {
            nextQuantityFeedback[fieldName] = normalizedValue.message;
        } else {
            delete nextQuantityFeedback[fieldName];
        }

        if (sourceBlock) {
            if (Object.keys(nextQuantityFeedback).length > 0) {
                sourceBlock.__duQuantityFeedback = nextQuantityFeedback;
            } else {
                delete sourceBlock.__duQuantityFeedback;
            }
        }

        return String(
            getDepartmentUserQuantityFieldPrecision(
                sourceBlock?.getFieldValue("UNIT_OF_MEASUREMENT"),
            ) === 1
                ? Math.trunc(normalizedValue.normalizedValue)
                : normalizedValue.normalizedValue,
        );
    });

    return field;
}

function updateDepartmentVisualState(block: any): void {
    if (!block.svgGroup_) {
        return;
    }

    block.svgGroup_.classList.toggle("dept-block-collapsed", block.isCollapsed_);
    block.svgGroup_.classList.toggle("dept-block-expanded", !block.isCollapsed_);
}

function updateItemVisualState(block: any): void {
    if (!block.svgGroup_) {
        return;
    }

    block.svgGroup_.classList.toggle("item-block-collapsed", block.isCollapsed_);
    block.svgGroup_.classList.toggle("item-block-expanded", !block.isCollapsed_);
}

function updateTimingVisualState(block: any): void {
    if (!block.svgGroup_) {
        return;
    }

    block.svgGroup_.classList.toggle("timing-block-collapsed", block.isCollapsed_);
    block.svgGroup_.classList.toggle("timing-block-expanded", !block.isCollapsed_);
}

export function registerDepartmentUserBlocklyBlocks(BlocklyBase: BlocklyModule): void {
    if (blocksRegistered) {
        return;
    }

    const Blockly = BlocklyBase as BlocklyAny;

    Blockly.Blocks.department_block = {
        init(this: any) {
            this.appendDummyInput("HEADER")
                .appendField(
                    new Blockly.FieldImage(
                        RIGHT_ARROW_ICON,
                        16,
                        16,
                        "Expand",
                        this.toggleCollapse.bind(this),
                    ),
                    "DEPT_TOGGLE_ICON",
                )
                .appendField("Dept:")
                .appendField(
                    createReadonlyLabelField(Blockly, "Department Name"),
                    "DEPT_NAME",
                );

            this.appendDummyInput("VOTE_INPUT")
                .appendField("Vote #:")
                .appendField(
                    createReadonlyLabelField(Blockly, "Vote not set"),
                    "VOTE_NUMBER",
                )
                .setVisible(false);

            this.appendDummyInput("DEPARTMENT_ID_INPUT")
                .appendField(
                    createReadonlyLabelField(Blockly, ""),
                    "DEPARTMENT_ID",
                )
                .setVisible(false);

            this.appendDummyInput("BUDGET_INPUT")
                .appendField("Budget: KES")
                .appendField(createReadonlyTextField(Blockly, "0"), "BUDGET")
                .setVisible(false);

            this.appendStatementInput("CATEGORIES").setCheck("department_category_statement");

            this.appendDummyInput("TOTAL")
                .setAlign(Blockly.inputs.Align.RIGHT)
                .appendField("Total: KES")
                .appendField(createReadonlyTextField(Blockly, "0.00"), "DEPT_TOTAL");

            this.setColour("#18b969");
            this.setPreviousStatement(true, "department_block");
            this.setNextStatement(true, "department_block");
            this.setTooltip("Department source block with live vote number, budget, and totals.");
            this.setInputsInline(false);
            this.isCollapsed_ = true;
            this.updateVisualState();
        },

        loadExtraState(this: any, state: { isCollapsed?: boolean }) {
            this.isCollapsed_ = state.isCollapsed ?? true;
            this.updateCollapsedInputs();
        },

        saveExtraState(this: any) {
            return {
                isCollapsed: this.isCollapsed_,
            };
        },

        toggleCollapse(this: any) {
            this.isCollapsed_ = !this.isCollapsed_;
            this.updateCollapsedInputs();
            this.render();
        },

        updateCollapsedInputs(this: any) {
            const toggleField = this.getField("DEPT_TOGGLE_ICON");
            toggleField?.setValue(this.isCollapsed_ ? RIGHT_ARROW_ICON : DOWN_ARROW_ICON);
            this.getInput("VOTE_INPUT")?.setVisible(!this.isCollapsed_);
            this.getInput("BUDGET_INPUT")?.setVisible(!this.isCollapsed_);
            this.updateVisualState();
        },

        updateVisualState(this: any) {
            updateDepartmentVisualState(this);
        },
    };

    Blockly.Blocks.category_block = {
        init(this: any) {
            this.appendDummyInput("CATEGORY_ID_INPUT")
                .appendField(
                    createReadonlyLabelField(Blockly, "unknown-category"),
                    "CATEGORY_ID",
                )
                .setVisible(false);

            this.appendDummyInput("HEADER")
                .appendField("Category:")
                .appendField(
                    createReadonlyLabelField(Blockly, "Category Name"),
                    "CATEGORY_NAME",
                );

            this.appendStatementInput("ITEMS").setCheck("category_item_statement");

            this.appendDummyInput("EMPTY_STATE")
                .appendField(
                    createReadonlyLabelField(Blockly, ""),
                    "CATEGORY_EMPTY_STATE",
                )
                .setVisible(false);

            this.appendDummyInput("TOTALS")
                .appendField("Q1")
                .appendField(
                    createReadonlyTextField(Blockly, "0.00"),
                    "CAT_Q1_TOTAL",
                )
                .appendField("Q2")
                .appendField(
                    createReadonlyTextField(Blockly, "0.00"),
                    "CAT_Q2_TOTAL",
                )
                .appendField("Q3")
                .appendField(
                    createReadonlyTextField(Blockly, "0.00"),
                    "CAT_Q3_TOTAL",
                )
                .appendField("Q4")
                .appendField(
                    createReadonlyTextField(Blockly, "0.00"),
                    "CAT_Q4_TOTAL",
                )
                .appendField("Total")
                .appendField(
                    createReadonlyTextField(Blockly, "0.00"),
                    "CATEGORY_GRAND_TOTAL",
                );

            this.setPreviousStatement(true, "department_category_statement");
            this.setNextStatement(true, "department_category_statement");
            this.setColour("#4a90d9");
            this.setTooltip("Category block with quarterly and grand totals.");
        },
    };

    Blockly.Blocks.item_block = {
        init(this: any) {
            this.appendDummyInput("ITEM_ID_INPUT")
                .appendField(
                    createReadonlyLabelField(Blockly, "unknown-item"),
                    "ITEM_ID",
                )
                .setVisible(false);

            this.appendDummyInput("COMPLIANCE_FLAGS_INPUT")
                .appendField(
                    createReadonlyLabelField(Blockly, ""),
                    "COMPLIANCE_FLAGS",
                )
                .setVisible(false);

            this.appendDummyInput("ITEM_ACTIVE_INPUT")
                .appendField(
                    createReadonlyLabelField(Blockly, "true"),
                    "ITEM_IS_ACTIVE",
                )
                .setVisible(false);

            this.appendDummyInput("MAX_QUANTITY_INPUT")
                .appendField(
                    createReadonlyLabelField(Blockly, ""),
                    "MAX_QUANTITY",
                )
                .setVisible(false);

            this.appendDummyInput("MIN_QUANTITY_INPUT")
                .appendField(
                    createReadonlyLabelField(Blockly, ""),
                    "MIN_QUANTITY",
                )
                .setVisible(false);

            this.appendDummyInput("HEADER")
                .appendField(
                    new Blockly.FieldImage(
                        RIGHT_ARROW_ICON,
                        16,
                        16,
                        "Expand",
                        this.toggleCollapse.bind(this),
                    ),
                    "TOGGLE_ICON",
                )
                .appendField("Item:")
                .appendField(
                    createReadonlyLabelField(Blockly, "Item Name"),
                    "ITEM_DESC",
                );

            this.appendDummyInput("DESCRIPTION_INPUT")
                .appendField("Description:")
                .appendField(
                    createReadonlyLabelField(Blockly, "Not set"),
                    "ITEM_DESCRIPTION",
                )
                .setVisible(false);

            this.appendDummyInput("UNIT")
                .appendField("Unit:")
                .appendField(
                    createReadonlyLabelField(Blockly, "Not set"),
                    "UNIT_OF_MEASUREMENT",
                )
                .setVisible(false);

            this.appendDummyInput("PRICE")
                .appendField("Unit Price: KES")
                .appendField(createReadonlyLabelField(Blockly, "0"), "UNIT_PRICE")
                .setVisible(false);

            this.appendDummyInput("PROC_METHOD_INPUT")
                .appendField("Method:")
                .appendField(createReadonlyLabelField(Blockly, "Not set"), "PROC_METHOD")
                .setVisible(false);

            this.appendDummyInput("FUNDS_SOURCE")
                .appendField("Funds:")
                .appendField(
                    createReadonlyLabelField(Blockly, "Not set"),
                    "SOURCE_OF_FUNDS",
                )
                .setVisible(false);

            this.appendDummyInput("QUANTITIES")
                .appendField("Q1")
                .appendField(createQuarterQuantityField(Blockly, "Q1_QTY"), "Q1_QTY")
                .appendField("Q2")
                .appendField(createQuarterQuantityField(Blockly, "Q2_QTY"), "Q2_QTY")
                .appendField("Q3")
                .appendField(createQuarterQuantityField(Blockly, "Q3_QTY"), "Q3_QTY")
                .appendField("Q4")
                .appendField(createQuarterQuantityField(Blockly, "Q4_QTY"), "Q4_QTY");

            this.appendDummyInput("TOTALS")
                .appendField("Qty:")
                .appendField(
                    createReadonlyTextField(Blockly, "0"),
                    "ITEM_TOTAL_QTY",
                )
                .appendField("Total: KES")
                .appendField(
                    createReadonlyTextField(Blockly, "0.00"),
                    "ITEM_TOTAL_COST",
                );

            this.setPreviousStatement(true, "category_item_statement");
            this.setNextStatement(true, "category_item_statement");
            this.setColour("#f5a623");
            this.setTooltip("Item block with editable quarterly quantities and live totals.");
            this.setInputsInline(true);
            this.isCollapsed_ = true;
            this.updateVisualState();
        },

        loadExtraState(this: any, state: { isCollapsed?: boolean }) {
            this.isCollapsed_ = state.isCollapsed ?? true;
            this.updateCollapsedInputs();
        },

        saveExtraState(this: any) {
            return {
                isCollapsed: this.isCollapsed_,
            };
        },

        toggleCollapse(this: any) {
            this.isCollapsed_ = !this.isCollapsed_;
            this.updateCollapsedInputs();
            this.render();
        },

        updateCollapsedInputs(this: any) {
            const toggleField = this.getField("TOGGLE_ICON");
            toggleField?.setValue(this.isCollapsed_ ? RIGHT_ARROW_ICON : DOWN_ARROW_ICON);
            this.getInput("DESCRIPTION_INPUT")?.setVisible(!this.isCollapsed_);
            this.getInput("UNIT")?.setVisible(!this.isCollapsed_);
            this.getInput("PRICE")?.setVisible(!this.isCollapsed_);
            this.getInput("PROC_METHOD_INPUT")?.setVisible(!this.isCollapsed_);
            this.getInput("FUNDS_SOURCE")?.setVisible(!this.isCollapsed_);
            this.setInputsInline(this.isCollapsed_);
            this.updateVisualState();
        },

        updateVisualState(this: any) {
            updateItemVisualState(this);
        },
    };

    Blockly.Blocks.aggregate_plan_block = {
        init(this: any) {
            this.appendDummyInput("HEADER")
                .appendField("ANNUAL PROCUREMENT PLAN F/Y")
                .appendField(new Blockly.FieldTextInput("2026-2027"), "FINANCIAL_YEAR");

            this.appendStatementInput("DEPARTMENTS").setCheck("department_block");

            const grandTotalInput = this.appendDummyInput("GRAND_TOTAL_INPUT")
                .appendField("GRAND TOTAL:");
            appendAggregateKesLabel(grandTotalInput, Blockly, "AGG");
            appendAggregateMainAmountField(grandTotalInput, Blockly, "AGG", "GRAND_TOTAL");
            appendAggregateQuarterFields(grandTotalInput, Blockly, "AGG");

            const agpoInput = this.appendDummyInput("AGPO_INPUT")
                .appendField("AGPO (30%):");
            appendAggregateKesLabel(agpoInput, Blockly, "AGPO");
            appendAggregateMainAmountField(agpoInput, Blockly, "AGPO", "AGPO_CALCULATED");
            appendAggregateQuarterFields(agpoInput, Blockly, "AGPO");

            const pwdInput = this.appendDummyInput("PWD_INPUT")
                .appendField("PWD (2%):");
            appendAggregateKesLabel(pwdInput, Blockly, "PWD");
            appendAggregateMainAmountField(pwdInput, Blockly, "PWD", "PWD_CALCULATED");
            appendAggregateQuarterFields(pwdInput, Blockly, "PWD");

            const localInput = this.appendDummyInput("LOCAL_INPUT")
                .appendField("LOCAL (40%):");
            appendAggregateKesLabel(localInput, Blockly, "LOCAL");
            appendAggregateMainAmountField(
                localInput,
                Blockly,
                "LOCAL",
                "LOCAL_CONTENT_CALCULATED",
            );
            appendAggregateQuarterFields(localInput, Blockly, "LOCAL");

            this.setColour(50);
            this.setTooltip("Master consolidation plan containing approved departments.");
        },
    };

    const createTimingBlock = (label: string, colour: number) => ({
        init(this: any) {
            this.appendDummyInput("HEADER")
                .appendField(
                    new Blockly.FieldImage(
                        RIGHT_ARROW_ICON,
                        16,
                        16,
                        "Expand",
                        this.toggleCollapse.bind(this),
                    ),
                    "TIMING_TOGGLE_ICON",
                )
                .appendField(label);

            TIMING_FIELD_LABELS.forEach((fieldLabel, index) => {
                this.appendDummyInput(`FIELD${index + 1}_INPUT`)
                    .appendField(fieldLabel)
                    .appendField(new Blockly.FieldTextInput("_"), `FIELD${index + 1}`)
                    .setVisible(false);
            });

            this.setPreviousStatement(true, [
                "department_block",
                "planned_timing_block",
                "actual_timing_block",
                "variance_timing_block",
            ]);
            this.setNextStatement(true, [
                "department_block",
                "planned_timing_block",
                "actual_timing_block",
                "variance_timing_block",
            ]);
            this.setColour(colour);
            this.setTooltip("Click > to expand timing details.");
            this.setInputsInline(false);
            this.isCollapsed_ = true;
            this.updateVisualState();
        },

        loadExtraState(this: any, state: { isCollapsed?: boolean }) {
            this.isCollapsed_ = state.isCollapsed ?? true;
            this.updateCollapsedInputs();
        },

        saveExtraState(this: any) {
            return {
                isCollapsed: this.isCollapsed_,
            };
        },

        toggleCollapse(this: any) {
            this.isCollapsed_ = !this.isCollapsed_;
            this.updateCollapsedInputs();
            this.render();
        },

        updateCollapsedInputs(this: any) {
            const toggleField = this.getField("TIMING_TOGGLE_ICON");
            toggleField?.setValue(this.isCollapsed_ ? RIGHT_ARROW_ICON : DOWN_ARROW_ICON);
            for (let index = 1; index <= TIMING_FIELD_LABELS.length; index += 1) {
                this.getInput(`FIELD${index}_INPUT`)?.setVisible(!this.isCollapsed_);
            }
            this.updateVisualState();
        },

        updateVisualState(this: any) {
            updateTimingVisualState(this);
        },
    });

    Blockly.Blocks.planned_timing_block = createTimingBlock("PLANNED TIMING", 210);
    Blockly.Blocks.actual_timing_block = createTimingBlock("ACTUAL TIMING", 120);
    Blockly.Blocks.variance_timing_block = createTimingBlock("VARIANCE TIMING", 45);

    blocksRegistered = true;
}
