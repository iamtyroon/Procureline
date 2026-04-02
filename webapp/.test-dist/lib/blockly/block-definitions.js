"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDepartmentUserBlocklyBlocks = void 0;
const RIGHT_ARROW_ICON = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M6 4l4 4-4 4' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const DOWN_ARROW_ICON = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4' fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
let blocksRegistered = false;
function updateDepartmentVisualState(block) {
    if (!block.svgGroup_) {
        return;
    }
    block.svgGroup_.classList.toggle("dept-block-collapsed", block.isCollapsed_);
    block.svgGroup_.classList.toggle("dept-block-expanded", !block.isCollapsed_);
}
function updateItemVisualState(block) {
    if (!block.svgGroup_) {
        return;
    }
    block.svgGroup_.classList.toggle("item-block-collapsed", block.isCollapsed_);
    block.svgGroup_.classList.toggle("item-block-expanded", !block.isCollapsed_);
}
function registerDepartmentUserBlocklyBlocks(BlocklyBase) {
    if (blocksRegistered) {
        return;
    }
    const Blockly = BlocklyBase;
    Blockly.Blocks.department_block = {
        init() {
            this.appendDummyInput("HEADER")
                .appendField(new Blockly.FieldImage(RIGHT_ARROW_ICON, 16, 16, "Expand", this.toggleCollapse.bind(this)), "DEPT_TOGGLE_ICON")
                .appendField("Dept:")
                .appendField(new Blockly.FieldLabelSerializable("Department Name"), "DEPT_NAME");
            this.appendDummyInput("VOTE_INPUT")
                .appendField("Vote #:")
                .appendField(new Blockly.FieldLabelSerializable("Vote not set"), "VOTE_NUMBER")
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
        loadExtraState(state) {
            this.isCollapsed_ = state.isCollapsed ?? true;
            this.updateCollapsedInputs();
        },
        saveExtraState() {
            return {
                isCollapsed: this.isCollapsed_,
            };
        },
        toggleCollapse() {
            this.isCollapsed_ = !this.isCollapsed_;
            this.updateCollapsedInputs();
            this.render();
        },
        updateCollapsedInputs() {
            const toggleField = this.getField("DEPT_TOGGLE_ICON");
            toggleField?.setValue(this.isCollapsed_ ? RIGHT_ARROW_ICON : DOWN_ARROW_ICON);
            this.getInput("VOTE_INPUT")?.setVisible(!this.isCollapsed_);
            this.getInput("BUDGET_INPUT")?.setVisible(!this.isCollapsed_);
            this.updateVisualState();
        },
        updateVisualState() {
            updateDepartmentVisualState(this);
        },
    };
    Blockly.defineBlocksWithJsonArray([
        {
            type: "category_block",
            message0: "Category: %1",
            args0: [
                {
                    type: "field_label_serializable",
                    name: "CATEGORY_NAME",
                    text: "Category Name",
                },
            ],
            message1: "%1",
            args1: [
                {
                    type: "input_statement",
                    name: "ITEMS",
                    check: "category_item_statement",
                },
            ],
            message2: "Q1 %1  Q2 %2  Q3 %3  Q4 %4  Total %5",
            args2: [
                {
                    type: "field_label_serializable",
                    name: "CAT_Q1_TOTAL",
                    text: "0.00",
                },
                {
                    type: "field_label_serializable",
                    name: "CAT_Q2_TOTAL",
                    text: "0.00",
                },
                {
                    type: "field_label_serializable",
                    name: "CAT_Q3_TOTAL",
                    text: "0.00",
                },
                {
                    type: "field_label_serializable",
                    name: "CAT_Q4_TOTAL",
                    text: "0.00",
                },
                {
                    type: "field_label_serializable",
                    name: "CATEGORY_GRAND_TOTAL",
                    text: "0.00",
                },
            ],
            previousStatement: "department_category_statement",
            nextStatement: "department_category_statement",
            colour: "#4a90d9",
            tooltip: "Category block with quarterly and grand totals.",
        },
    ]);
    Blockly.Blocks.item_block = {
        init() {
            this.appendDummyInput("HEADER")
                .appendField(new Blockly.FieldImage(RIGHT_ARROW_ICON, 16, 16, "Expand", this.toggleCollapse.bind(this)), "TOGGLE_ICON")
                .appendField("Item:")
                .appendField(new Blockly.FieldLabelSerializable("Item Name"), "ITEM_DESC");
            this.appendDummyInput("DESCRIPTION_INPUT")
                .appendField("Description:")
                .appendField(new Blockly.FieldLabelSerializable("Not set"), "ITEM_DESCRIPTION")
                .setVisible(false);
            this.appendDummyInput("UNIT")
                .appendField("Unit:")
                .appendField(new Blockly.FieldLabelSerializable("Not set"), "UNIT_OF_MEASUREMENT")
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
                .appendField(new Blockly.FieldLabelSerializable("Not set"), "SOURCE_OF_FUNDS")
                .setVisible(false);
            this.appendDummyInput("QUANTITIES")
                .appendField("Q1")
                .appendField(new Blockly.FieldNumber(0, 0), "Q1_QTY")
                .appendField("Q2")
                .appendField(new Blockly.FieldNumber(0, 0), "Q2_QTY")
                .appendField("Q3")
                .appendField(new Blockly.FieldNumber(0, 0), "Q3_QTY")
                .appendField("Q4")
                .appendField(new Blockly.FieldNumber(0, 0), "Q4_QTY");
            this.appendDummyInput("TOTALS")
                .appendField("Qty:")
                .appendField(new Blockly.FieldLabelSerializable("0"), "ITEM_TOTAL_QTY")
                .appendField("Total: KES")
                .appendField(new Blockly.FieldLabelSerializable("0.00"), "ITEM_TOTAL_COST");
            this.setPreviousStatement(true, "category_item_statement");
            this.setNextStatement(true, "category_item_statement");
            this.setColour("#f5a623");
            this.setTooltip("Item block with editable quarterly quantities and live totals.");
            this.setInputsInline(true);
            this.isCollapsed_ = true;
            this.updateVisualState();
        },
        loadExtraState(state) {
            this.isCollapsed_ = state.isCollapsed ?? true;
            this.updateCollapsedInputs();
        },
        saveExtraState() {
            return {
                isCollapsed: this.isCollapsed_,
            };
        },
        toggleCollapse() {
            this.isCollapsed_ = !this.isCollapsed_;
            this.updateCollapsedInputs();
            this.render();
        },
        updateCollapsedInputs() {
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
        updateVisualState() {
            updateItemVisualState(this);
        },
    };
    blocksRegistered = true;
}
exports.registerDepartmentUserBlocklyBlocks = registerDepartmentUserBlocklyBlocks;
