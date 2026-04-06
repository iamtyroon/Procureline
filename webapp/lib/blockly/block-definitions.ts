import {
    getDepartmentUserQuantityFieldPrecision,
    normalizeDepartmentUserQuantityValue,
} from "./workspace-validation";

type BlocklyModule = typeof import("blockly");
type BlocklyAny = BlocklyModule & {
    Blocks: Record<string, any>;
};

const RIGHT_ARROW_ICON =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M6 4l4 4-4 4' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const DOWN_ARROW_ICON =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

let blocksRegistered = false;

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
                    new Blockly.FieldLabelSerializable("Department Name"),
                    "DEPT_NAME",
                );

            this.appendDummyInput("VOTE_INPUT")
                .appendField("Vote #:")
                .appendField(
                    new Blockly.FieldLabelSerializable("Vote not set"),
                    "VOTE_NUMBER",
                )
                .setVisible(false);

            this.appendDummyInput("BUDGET_INPUT")
                .appendField("Budget: KES")
                .appendField(new Blockly.FieldLabelSerializable("0"), "BUDGET")
                .setVisible(false);

            this.appendStatementInput("CATEGORIES").setCheck("department_category_statement");

            this.appendDummyInput("TOTAL")
                .setAlign(Blockly.inputs.Align.RIGHT)
                .appendField("Total: KES")
                .appendField(new Blockly.FieldLabelSerializable("0.00"), "DEPT_TOTAL");

            this.setColour("#18b969");
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
                    new Blockly.FieldLabelSerializable("unknown-category"),
                    "CATEGORY_ID",
                )
                .setVisible(false);

            this.appendDummyInput("HEADER")
                .appendField("Category:")
                .appendField(
                    new Blockly.FieldLabelSerializable("Category Name"),
                    "CATEGORY_NAME",
                );

            this.appendStatementInput("ITEMS").setCheck("category_item_statement");

            this.appendDummyInput("EMPTY_STATE")
                .appendField(
                    new Blockly.FieldLabelSerializable("Drag items here"),
                    "CATEGORY_EMPTY_STATE",
                );

            this.appendDummyInput("TOTALS")
                .appendField("Q1")
                .appendField(
                    new Blockly.FieldLabelSerializable("0.00"),
                    "CAT_Q1_TOTAL",
                )
                .appendField("Q2")
                .appendField(
                    new Blockly.FieldLabelSerializable("0.00"),
                    "CAT_Q2_TOTAL",
                )
                .appendField("Q3")
                .appendField(
                    new Blockly.FieldLabelSerializable("0.00"),
                    "CAT_Q3_TOTAL",
                )
                .appendField("Q4")
                .appendField(
                    new Blockly.FieldLabelSerializable("0.00"),
                    "CAT_Q4_TOTAL",
                )
                .appendField("Total")
                .appendField(
                    new Blockly.FieldLabelSerializable("0.00"),
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
                    new Blockly.FieldLabelSerializable("unknown-item"),
                    "ITEM_ID",
                )
                .setVisible(false);

            this.appendDummyInput("COMPLIANCE_FLAGS_INPUT")
                .appendField(
                    new Blockly.FieldLabelSerializable(""),
                    "COMPLIANCE_FLAGS",
                )
                .setVisible(false);

            this.appendDummyInput("ITEM_ACTIVE_INPUT")
                .appendField(
                    new Blockly.FieldLabelSerializable("true"),
                    "ITEM_IS_ACTIVE",
                )
                .setVisible(false);

            this.appendDummyInput("MAX_QUANTITY_INPUT")
                .appendField(
                    new Blockly.FieldLabelSerializable(""),
                    "MAX_QUANTITY",
                )
                .setVisible(false);

            this.appendDummyInput("MIN_QUANTITY_INPUT")
                .appendField(
                    new Blockly.FieldLabelSerializable(""),
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
                    new Blockly.FieldLabelSerializable("Item Name"),
                    "ITEM_DESC",
                );

            this.appendDummyInput("DESCRIPTION_INPUT")
                .appendField("Description:")
                .appendField(
                    new Blockly.FieldLabelSerializable("Not set"),
                    "ITEM_DESCRIPTION",
                )
                .setVisible(false);

            this.appendDummyInput("UNIT")
                .appendField("Unit:")
                .appendField(
                    new Blockly.FieldLabelSerializable("Not set"),
                    "UNIT_OF_MEASUREMENT",
                )
                .setVisible(false);

            this.appendDummyInput("PRICE")
                .appendField("Unit Price: KES")
                .appendField(new Blockly.FieldLabelSerializable("0"), "UNIT_PRICE")
                .setVisible(false);

            this.appendDummyInput("PROC_METHOD_INPUT")
                .appendField("Method:")
                .appendField(new Blockly.FieldLabelSerializable("Not set"), "PROC_METHOD")
                .setVisible(false);

            this.appendDummyInput("FUNDS_SOURCE")
                .appendField("Funds:")
                .appendField(
                    new Blockly.FieldLabelSerializable("Not set"),
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
                    new Blockly.FieldLabelSerializable("0"),
                    "ITEM_TOTAL_QTY",
                )
                .appendField("Total: KES")
                .appendField(
                    new Blockly.FieldLabelSerializable("0.00"),
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

    blocksRegistered = true;
}
