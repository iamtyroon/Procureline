"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSignedDepartmentUserRequestContext = exports.readDepartmentUserRequestContext = void 0;
const headers_1 = require("next/headers");
const department_user_request_context_token_1 = require("./department-user-request-context-token");
function readHeaderValue(headerValue) {
    const normalizedValue = headerValue?.trim();
    return normalizedValue ? normalizedValue : null;
}
function readForwardedIp(headerValue) {
    const firstHop = headerValue?.split(",")[0]?.trim();
    return firstHop ? firstHop : null;
}
async function readDepartmentUserRequestContext() {
    const requestHeaders = await (0, headers_1.headers)();
    return {
        city: readHeaderValue(requestHeaders.get("x-vercel-ip-city")),
        country: readHeaderValue(requestHeaders.get("x-vercel-ip-country")),
        ipAddress: readForwardedIp(requestHeaders.get("x-forwarded-for")) ??
            readHeaderValue(requestHeaders.get("x-real-ip")),
        isPIIAllowed: true,
        region: readHeaderValue(requestHeaders.get("x-vercel-ip-country-region")),
        userAgent: readHeaderValue(requestHeaders.get("user-agent")),
    };
}
exports.readDepartmentUserRequestContext = readDepartmentUserRequestContext;
async function readSignedDepartmentUserRequestContext() {
    const requestContext = await readDepartmentUserRequestContext();
    return await (0, department_user_request_context_token_1.createSignedDepartmentUserRequestContextToken)({
        context: requestContext,
    });
}
exports.readSignedDepartmentUserRequestContext = readSignedDepartmentUserRequestContext;
