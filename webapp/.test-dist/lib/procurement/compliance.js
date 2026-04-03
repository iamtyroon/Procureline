"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUnavailableProcurementComplianceSnapshot = exports.calculateProcurementComplianceSnapshot = exports.serializeProcurementComplianceFlags = exports.formatProcurementComplianceLabel = exports.PROCUREMENT_COMPLIANCE_TARGET_PERCENTAGES = void 0;
const items_1 = require("../procurement-officer/items");
exports.PROCUREMENT_COMPLIANCE_TARGET_PERCENTAGES = {
    agpo: 30,
    local_content: 40,
    pwd: 2,
};
const COMPLIANCE_LABELS = {
    agpo: "AGPO",
    local_content: "Local Content",
    pwd: "PWD",
};
const COMPLIANCE_ORDER = [
    "agpo",
    "pwd",
    "local_content",
];
function formatProcurementComplianceLabel(flag) {
    return COMPLIANCE_LABELS[flag];
}
exports.formatProcurementComplianceLabel = formatProcurementComplianceLabel;
function serializeProcurementComplianceFlags(flags) {
    return (0, items_1.normalizeComplianceFlags)(flags).join(",");
}
exports.serializeProcurementComplianceFlags = serializeProcurementComplianceFlags;
function calculateProcurementComplianceSnapshot(args) {
    const totalEligibleSpend = sanitizeFiniteCurrency(args.totalEligibleSpend);
    const amountsByFlag = COMPLIANCE_ORDER.reduce((accumulator, flag) => {
        accumulator[flag] = 0;
        return accumulator;
    }, {});
    for (const item of args.items) {
        const amount = sanitizeFiniteCurrency(item.amount);
        const normalizedFlags = (0, items_1.normalizeComplianceFlags)(item.complianceFlags);
        for (const flag of normalizedFlags) {
            amountsByFlag[flag] += amount;
        }
    }
    return {
        metrics: COMPLIANCE_ORDER.map((flag) => {
            const amount = roundCurrency(amountsByFlag[flag]);
            const targetPercent = exports.PROCUREMENT_COMPLIANCE_TARGET_PERCENTAGES[flag];
            if (totalEligibleSpend <= 0) {
                return {
                    amount,
                    announcementText: `${formatProcurementComplianceLabel(flag)} target is waiting for a plan total.`,
                    flag,
                    label: formatProcurementComplianceLabel(flag),
                    percent: null,
                    percentLabel: "No plan total yet",
                    status: "empty",
                    targetMet: false,
                    targetPercent,
                    targetPercentLabel: `${targetPercent}% target`,
                };
            }
            const percent = roundPercent((amount / totalEligibleSpend) * 100);
            const targetMet = percent >= targetPercent;
            return {
                amount,
                announcementText: targetMet
                    ? `${formatProcurementComplianceLabel(flag)} target met at ${formatPercent(percent)}.`
                    : `${formatProcurementComplianceLabel(flag)} target unmet at ${formatPercent(percent)}.`,
                flag,
                label: formatProcurementComplianceLabel(flag),
                percent,
                percentLabel: formatPercent(percent),
                status: targetMet ? "met" : "unmet",
                targetMet,
                targetPercent,
                targetPercentLabel: `${targetPercent}% target`,
            };
        }),
        multiFlagNotice: "Items can count toward more than one compliance target when their catalog flags overlap.",
        totalEligibleSpend,
    };
}
exports.calculateProcurementComplianceSnapshot = calculateProcurementComplianceSnapshot;
function createUnavailableProcurementComplianceSnapshot(args) {
    const totalEligibleSpend = sanitizeFiniteCurrency(args?.totalEligibleSpend);
    return {
        metrics: COMPLIANCE_ORDER.map((flag) => {
            const targetPercent = exports.PROCUREMENT_COMPLIANCE_TARGET_PERCENTAGES[flag];
            return {
                amount: 0,
                announcementText: `${formatProcurementComplianceLabel(flag)} details are unavailable for this saved plan snapshot.`,
                flag,
                label: formatProcurementComplianceLabel(flag),
                percent: null,
                percentLabel: "Unavailable",
                status: "unavailable",
                targetMet: false,
                targetPercent,
                targetPercentLabel: `${targetPercent}% target`,
            };
        }),
        multiFlagNotice: "Compliance details are unavailable for this saved plan snapshot, but persisted budget totals remain visible.",
        totalEligibleSpend,
    };
}
exports.createUnavailableProcurementComplianceSnapshot = createUnavailableProcurementComplianceSnapshot;
function sanitizeFiniteCurrency(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return value < 0 ? 0 : roundCurrency(value);
}
function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function roundPercent(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function formatPercent(value) {
    const formatted = value.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted}%`;
}
