"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeStringForSearch = exports.emptyPage = exports.slugify = void 0;
function slugify(string) {
    return string.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
exports.slugify = slugify;
function emptyPage() {
    return {
        page: [],
        isDone: false,
        continueCursor: "",
        // This is a little hack around usePaginatedQuery,
        // which will lead to permanent loading state,
        // until a different result is returned
        pageStatus: "SplitRequired",
    };
}
exports.emptyPage = emptyPage;
function normalizeStringForSearch(string) {
    return string.normalize("NFKD").replace(/[\u0300-\u036F]/g, "");
}
exports.normalizeStringForSearch = normalizeStringForSearch;
