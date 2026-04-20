"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractProcurementOfficerDashboardSearchParams = exports.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS = void 0;
exports.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS = {
    fiscalYear: "poFiscalYear",
};
function extractProcurementOfficerDashboardSearchParams(searchParams) {
    const nextSearchParams = new URLSearchParams();
    const fiscalYear = searchParams
        .get(exports.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear)
        ?.trim() ?? "";
    if (fiscalYear.length > 0) {
        nextSearchParams.set(exports.PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear, fiscalYear);
    }
    return nextSearchParams;
}
exports.extractProcurementOfficerDashboardSearchParams = extractProcurementOfficerDashboardSearchParams;
