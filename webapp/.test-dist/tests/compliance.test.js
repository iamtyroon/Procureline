"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runComplianceTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const compliance_1 = require("../lib/procurement/compliance");
function runComplianceTests() {
    const completedTests = [];
    const snapshot = (0, compliance_1.calculateProcurementComplianceSnapshot)({
        items: [
            { amount: 300_000, complianceFlags: ["agpo", "agpo", "unsupported"] },
            { amount: 40_000, complianceFlags: ["local_content"] },
            { amount: 20_000, complianceFlags: ["pwd", "local_content"] },
        ],
        totalEligibleSpend: 400_000,
    });
    strict_1.default.equal(snapshot.metrics.find((metric) => metric.flag === "agpo")?.status, "met");
    strict_1.default.equal(snapshot.metrics.find((metric) => metric.flag === "pwd")?.status, "met");
    strict_1.default.equal(snapshot.metrics.find((metric) => metric.flag === "local_content")?.status, "unmet");
    completedTests.push("compliance targets now use one shared threshold table for AGPO, PWD, and Local Content");
    const emptySnapshot = (0, compliance_1.calculateProcurementComplianceSnapshot)({
        items: [],
        totalEligibleSpend: 0,
    });
    strict_1.default.equal(emptySnapshot.metrics.every((metric) => metric.status === "empty"), true);
    completedTests.push("compliance calculations now resolve zero-total plans to a truthful empty-state contract");
    strict_1.default.equal((0, compliance_1.serializeProcurementComplianceFlags)(["agpo", "unsupported", "agpo", "pwd"]), "agpo,pwd");
    completedTests.push("compliance flag serialization now normalizes duplicates and unsupported values deterministically");
    return completedTests;
}
exports.runComplianceTests = runComplianceTests;
