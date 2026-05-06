"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcurementCatalogExportGuardState = exports.isProcurementCatalogQueryParam = exports.hasActiveProcurementCatalogFilters = exports.areProcurementCatalogBrowseStatesEqual = exports.extractProcurementCatalogBrowseSearchParams = exports.applyProcurementCatalogBrowseStateToSearchParams = exports.stripProcurementCatalogBrowseParams = exports.readProcurementCatalogBrowseState = exports.normalizeProcurementCatalogBrowseState = exports.normalizeProcurementCatalogSearchText = exports.createDefaultProcurementCatalogBrowseState = exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS = exports.PROCUREMENT_CATALOG_PROFESSIONAL_EXPORT_LIMIT = exports.PROCUREMENT_CATALOG_SEARCH_DEBOUNCE_MS = exports.PROCUREMENT_CATALOG_PAGE_SIZE = void 0;
const items_1 = require("./items");
const input_1 = require("../shared/security/input");
exports.PROCUREMENT_CATALOG_PAGE_SIZE = 50;
exports.PROCUREMENT_CATALOG_SEARCH_DEBOUNCE_MS = 300;
exports.PROCUREMENT_CATALOG_PROFESSIONAL_EXPORT_LIMIT = 10_000;
exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS = {
    categoryId: "itemCategory",
    complianceFlag: "itemCompliance",
    maxPrice: "itemMaxPrice",
    minPrice: "itemMinPrice",
    page: "itemPage",
    searchText: "itemSearch",
};
const PROCUREMENT_CATALOG_QUERY_PARAM_NAMES = new Set(Object.values(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS));
function createDefaultProcurementCatalogBrowseState() {
    return {
        categoryIds: [],
        complianceFlags: [],
        maxPrice: null,
        minPrice: null,
        page: 1,
        searchText: "",
    };
}
exports.createDefaultProcurementCatalogBrowseState = createDefaultProcurementCatalogBrowseState;
function normalizeProcurementCatalogSearchText(value) {
    return (0, input_1.normalizePlainText)(value ?? "");
}
exports.normalizeProcurementCatalogSearchText = normalizeProcurementCatalogSearchText;
function normalizeProcurementCatalogBrowseState(args) {
    const availableCategoryIds = args.availableCategoryIds
        ? new Set(args.availableCategoryIds)
        : null;
    const categoryIds = dedupeStringValues(args.state.categoryIds).filter((value) => (availableCategoryIds ? availableCategoryIds.has(value) : true));
    const complianceFlags = (0, items_1.normalizeComplianceFlags)(args.state.complianceFlags ?? []);
    const minPrice = normalizeNonNegativeNumber(args.state.minPrice);
    const maxPrice = normalizeNonNegativeNumber(args.state.maxPrice);
    return {
        categoryIds,
        complianceFlags,
        maxPrice: minPrice !== null && maxPrice !== null && minPrice > maxPrice
            ? null
            : maxPrice,
        minPrice: minPrice !== null && maxPrice !== null && minPrice > maxPrice
            ? null
            : minPrice,
        page: normalizePageValue(args.state.page),
        searchText: normalizeProcurementCatalogSearchText(args.state.searchText),
    };
}
exports.normalizeProcurementCatalogBrowseState = normalizeProcurementCatalogBrowseState;
function readProcurementCatalogBrowseState(searchParams, args) {
    return normalizeProcurementCatalogBrowseState({
        availableCategoryIds: args?.availableCategoryIds,
        state: {
            categoryIds: searchParams.getAll(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.categoryId),
            complianceFlags: searchParams.getAll(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.complianceFlag),
            maxPrice: searchParams.get(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.maxPrice),
            minPrice: searchParams.get(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.minPrice),
            page: searchParams.get(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.page),
            searchText: searchParams.get(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.searchText),
        },
    });
}
exports.readProcurementCatalogBrowseState = readProcurementCatalogBrowseState;
function stripProcurementCatalogBrowseParams(searchParams) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    PROCUREMENT_CATALOG_QUERY_PARAM_NAMES.forEach((key) => {
        nextSearchParams.delete(key);
    });
    return nextSearchParams;
}
exports.stripProcurementCatalogBrowseParams = stripProcurementCatalogBrowseParams;
function applyProcurementCatalogBrowseStateToSearchParams(args) {
    const normalizedState = normalizeProcurementCatalogBrowseState({
        state: args.state,
    });
    const nextSearchParams = stripProcurementCatalogBrowseParams(args.searchParams);
    if (normalizedState.searchText.length > 0) {
        nextSearchParams.set(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.searchText, normalizedState.searchText);
    }
    if (normalizedState.page > 1) {
        nextSearchParams.set(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.page, String(normalizedState.page));
    }
    if (normalizedState.minPrice !== null) {
        nextSearchParams.set(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.minPrice, String(normalizedState.minPrice));
    }
    if (normalizedState.maxPrice !== null) {
        nextSearchParams.set(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.maxPrice, String(normalizedState.maxPrice));
    }
    for (const categoryId of normalizedState.categoryIds) {
        nextSearchParams.append(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.categoryId, categoryId);
    }
    for (const complianceFlag of normalizedState.complianceFlags) {
        nextSearchParams.append(exports.PROCUREMENT_CATALOG_QUERY_PARAM_KEYS.complianceFlag, complianceFlag);
    }
    return nextSearchParams;
}
exports.applyProcurementCatalogBrowseStateToSearchParams = applyProcurementCatalogBrowseStateToSearchParams;
function extractProcurementCatalogBrowseSearchParams(searchParams, args) {
    return applyProcurementCatalogBrowseStateToSearchParams({
        searchParams: new URLSearchParams(),
        state: readProcurementCatalogBrowseState(searchParams, args),
    });
}
exports.extractProcurementCatalogBrowseSearchParams = extractProcurementCatalogBrowseSearchParams;
function areProcurementCatalogBrowseStatesEqual(left, right) {
    return (left.searchText === right.searchText &&
        left.page === right.page &&
        left.minPrice === right.minPrice &&
        left.maxPrice === right.maxPrice &&
        joinComparableValues(left.categoryIds) ===
            joinComparableValues(right.categoryIds) &&
        joinComparableValues(left.complianceFlags) ===
            joinComparableValues(right.complianceFlags));
}
exports.areProcurementCatalogBrowseStatesEqual = areProcurementCatalogBrowseStatesEqual;
function hasActiveProcurementCatalogFilters(state) {
    return (state.searchText.length > 0 ||
        state.categoryIds.length > 0 ||
        state.complianceFlags.length > 0 ||
        state.minPrice !== null ||
        state.maxPrice !== null);
}
exports.hasActiveProcurementCatalogFilters = hasActiveProcurementCatalogFilters;
function isProcurementCatalogQueryParam(name) {
    return PROCUREMENT_CATALOG_QUERY_PARAM_NAMES.has(name);
}
exports.isProcurementCatalogQueryParam = isProcurementCatalogQueryParam;
function getProcurementCatalogExportGuardState(args) {
    if (args.filteredCount <= 0) {
        return {
            description: "No rows match the current filters. Clear or refine filters before exporting.",
            kind: "empty",
            title: "No rows to export",
        };
    }
    if (args.tier === "free" || args.tier === "starter") {
        return {
            description: "Catalog export is available on the Professional and Enterprise plans. Upgrade to generate the filtered workbook.",
            kind: "tier_gate",
            title: `${capitalize(args.tier)} plan required for catalog export`,
        };
    }
    if (args.tier === "professional" &&
        args.filteredCount > exports.PROCUREMENT_CATALOG_PROFESSIONAL_EXPORT_LIMIT) {
        return {
            description: `This filtered result contains ${args.filteredCount.toLocaleString("en-US")} rows. Refine the filters or upgrade to Enterprise before exporting.`,
            kind: "row_limit",
            title: "Professional export limit exceeded",
        };
    }
    return {
        description: "The current filtered catalog can be exported safely.",
        kind: "allowed",
        title: "Export available",
    };
}
exports.getProcurementCatalogExportGuardState = getProcurementCatalogExportGuardState;
function dedupeStringValues(values) {
    const seen = new Set();
    const deduped = [];
    for (const value of values ?? []) {
        const normalizedValue = (0, input_1.normalizePlainText)(value);
        if (normalizedValue.length === 0 || seen.has(normalizedValue)) {
            continue;
        }
        seen.add(normalizedValue);
        deduped.push(normalizedValue);
    }
    return deduped;
}
function normalizeNonNegativeNumber(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }
    }
    return null;
}
function normalizePageValue(value) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed >= 1) {
            return parsed;
        }
    }
    return 1;
}
function joinComparableValues(values) {
    return values.join("::");
}
function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
