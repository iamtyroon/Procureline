"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEmailTransportTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const transport_1 = require("../lib/email/transport");
function runEmailTransportTests() {
    const completedTests = [];
    strict_1.default.equal((0, transport_1.resolveEmailTransportMode)(undefined), "resend");
    strict_1.default.equal((0, transport_1.resolveEmailTransportMode)("resend"), "resend");
    strict_1.default.equal((0, transport_1.resolveEmailTransportMode)(" dev_inbox "), "dev_inbox");
    strict_1.default.equal((0, transport_1.resolveEmailTransportMode)("DEV_INBOX"), "dev_inbox");
    completedTests.push("email transport mode resolution defaults safely to resend and only enables the dev inbox when explicitly requested");
    strict_1.default.equal((0, transport_1.resolveConvexSiteUrl)("https://example.convex.site/", undefined), "https://example.convex.site");
    strict_1.default.equal((0, transport_1.resolveDevInboxCaptureUrl)(undefined, "https://fallback.convex.site/"), "https://fallback.convex.site/api/dev-email/capture");
    strict_1.default.throws(() => (0, transport_1.resolveConvexSiteUrl)(undefined, undefined), /CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL must be configured/);
    completedTests.push("dev inbox capture URLs normalize Convex site URLs and fail clearly when no site URL is configured");
    return completedTests;
}
exports.runEmailTransportTests = runEmailTransportTests;
