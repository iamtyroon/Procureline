import { ArrowLeft, PackagePlus, Redo2, Save, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DepartmentUserBudgetMeterState } from "@/lib/shared/blockly/du-workspace-calculations";
import { formatKenyanCurrency } from "./formatters";
import styles from "../BlocklyWorkspace.module.css";

export function BlocklyEditorHeader(props: {
    budgetState: DepartmentUserBudgetMeterState;
    canCreateCatalogRequest: boolean;
    canOpenSubmitReview: boolean;
    canWithdrawCurrentSubmission: boolean;
    fiscalYear: string;
    isCloudSaveDisabled: boolean;
    isRedoDisabled: boolean;
    isSubmitPending: boolean;
    isUndoDisabled: boolean;
    isWithdrawPending: boolean;
    mode: "edit" | "view";
    onExit: () => void;
    onOpenCatalogRequest: () => void;
    onRedo: () => void;
    onSave: () => void;
    onSubmit: () => void;
    onUndo: () => void;
    onWithdraw: () => void;
    planStatus: "approved" | "draft" | "rejected" | "submitted";
    saveIndicatorLabel: string;
    saveState: string;
    submitDisabled: boolean;
    submitLabel: string;
    subtitle: string;
    title: string;
}) {
    return (
        <div className={styles.workspacePrototypeHeader}>
            <div className={styles.workspacePrototypeLead}>
                <span className={styles.workspacePrototypeEyebrow}>Fiscal year {props.fiscalYear}</span>
                <h1 className={styles.workspacePrototypeTitle}>{props.title}</h1>
                <p className={styles.workspacePrototypeSubtitle} data-du-deadline-summary>
                    {props.subtitle}
                </p>
            </div>

            <div className={styles.workspacePrototypeStats}>
                <div className={styles.prototypeBudgetMeter} data-du-budget-summary>
                    <div className={styles.prototypeBudgetLabel}>Department budget</div>
                    <div className={styles.prototypeBudgetBar}>
                        <div
                            className={styles.prototypeBudgetFill}
                            style={{
                                width: `${Math.max(0, Math.min(100, props.budgetState.usedPercent ?? 0))}%`,
                            }}
                        />
                    </div>
                    <div className={styles.prototypeBudgetText}>
                        <span>{formatKenyanCurrency(props.budgetState.usedAmount)}</span>
                        <span>
                            {props.budgetState.totalBudget === null
                                ? "Not allocated"
                                : formatKenyanCurrency(props.budgetState.totalBudget)}
                        </span>
                        <span>{props.budgetState.usageLabel}</span>
                    </div>
                </div>
            </div>

            <div className={styles.workspacePrototypeToolbar}>
                <span className={styles.workspacePrototypeStatus}>{props.saveIndicatorLabel}</span>
                <ToolbarButton icon={ArrowLeft} label="Exit" onClick={props.onExit} />
                <ToolbarButton
                    disabled={props.mode !== "edit" || !props.canCreateCatalogRequest}
                    icon={PackagePlus}
                    label="Request Item"
                    onClick={props.onOpenCatalogRequest}
                />
                <ToolbarButton disabled={props.isUndoDisabled} icon={Undo2} label="Undo" onClick={props.onUndo} />
                <ToolbarButton disabled={props.isRedoDisabled} icon={Redo2} label="Redo" onClick={props.onRedo} />
                <Button
                    className={styles.workspacePrototypeSaveButton}
                    disabled={props.isCloudSaveDisabled}
                    onClick={props.onSave}
                    type="button"
                    variant="outline"
                >
                    <Save className="mr-2 h-4 w-4" />
                    {props.saveState === "saving" ? "Saving..." : "Save"}
                </Button>
                {props.canOpenSubmitReview ? (
                    <Button
                        className={styles.workspacePrototypeSubmitButton}
                        disabled={props.submitDisabled || props.isSubmitPending}
                        onClick={props.onSubmit}
                        type="button"
                    >
                        <Send className="mr-2 h-4 w-4" />
                        {props.isSubmitPending ? "Submitting..." : props.submitLabel}
                    </Button>
                ) : props.canWithdrawCurrentSubmission ? (
                    <Button
                        className={styles.workspacePrototypeWithdrawButton}
                        disabled={props.isWithdrawPending}
                        onClick={props.onWithdraw}
                        type="button"
                    >
                        <Send className="mr-2 h-4 w-4" />
                        {props.isWithdrawPending ? "Withdrawing..." : "Withdraw Submission"}
                    </Button>
                ) : (
                    <Button className={styles.workspacePrototypeDisabledButton} disabled type="button">
                        <Send className="mr-2 h-4 w-4" />
                        {props.planStatus === "submitted" ? "Submitted" : "View Only"}
                    </Button>
                )}
            </div>
        </div>
    );
}

function ToolbarButton(props: {
    disabled?: boolean;
    icon: typeof ArrowLeft;
    label: string;
    onClick: () => void;
}) {
    const Icon = props.icon;
    return (
        <Button
            className={styles.workspacePrototypeActionButton}
            disabled={props.disabled}
            onClick={props.onClick}
            type="button"
            variant="outline"
        >
            <Icon className="mr-2 h-4 w-4" />
            {props.label}
        </Button>
    );
}
