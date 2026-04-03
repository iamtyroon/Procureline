"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersistedPlanSummaryForWorkspaceSummaryChange = void 0;
function getPersistedPlanSummaryForWorkspaceSummaryChange(args) {
    return args.mode === "view" || args.allowEditModePersistedFallback
        ? args.persistedPlanSummary
        : null;
}
exports.getPersistedPlanSummaryForWorkspaceSummaryChange = getPersistedPlanSummaryForWorkspaceSummaryChange;
