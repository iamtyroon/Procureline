import assert from "node:assert/strict";
import {
    calculateProcurementComplianceSnapshot,
    serializeProcurementComplianceFlags,
} from "../lib/procurement/compliance";

export function runComplianceTests(): string[] {
    const completedTests: string[] = [];

    const snapshot = calculateProcurementComplianceSnapshot({
        items: [
            { amount: 300_000, complianceFlags: ["agpo", "agpo", "unsupported"] },
            { amount: 40_000, complianceFlags: ["local_content"] },
            { amount: 20_000, complianceFlags: ["pwd", "local_content"] },
        ],
        totalEligibleSpend: 400_000,
    });
    assert.equal(snapshot.metrics.find((metric) => metric.flag === "agpo")?.status, "met");
    assert.equal(snapshot.metrics.find((metric) => metric.flag === "pwd")?.status, "met");
    assert.equal(
        snapshot.metrics.find((metric) => metric.flag === "local_content")?.status,
        "unmet",
    );
    completedTests.push("compliance targets now use one shared threshold table for AGPO, PWD, and Local Content");

    const emptySnapshot = calculateProcurementComplianceSnapshot({
        items: [],
        totalEligibleSpend: 0,
    });
    assert.equal(emptySnapshot.metrics.every((metric) => metric.status === "empty"), true);
    completedTests.push("compliance calculations now resolve zero-total plans to a truthful empty-state contract");

    assert.equal(
        serializeProcurementComplianceFlags(["agpo", "unsupported", "agpo", "pwd"]),
        "agpo,pwd",
    );
    completedTests.push("compliance flag serialization now normalizes duplicates and unsupported values deterministically");

    return completedTests;
}
