import {
    normalizeComplianceFlags,
    type ProcurementItemComplianceFlag,
} from "../procurement-officer/items";

export const PROCUREMENT_COMPLIANCE_TARGET_PERCENTAGES = {
    agpo: 30,
    local_content: 40,
    pwd: 2,
} as const satisfies Record<ProcurementItemComplianceFlag, number>;

export type ProcurementComplianceMetricStatus =
    | "empty"
    | "met"
    | "unavailable"
    | "unmet";

export interface ProcurementComplianceMetric {
    amount: number;
    announcementText: string;
    flag: ProcurementItemComplianceFlag;
    label: string;
    percent: number | null;
    percentLabel: string;
    status: ProcurementComplianceMetricStatus;
    targetMet: boolean;
    targetPercent: number;
    targetPercentLabel: string;
}

export interface ProcurementComplianceSnapshot {
    metrics: ProcurementComplianceMetric[];
    multiFlagNotice: string;
    totalEligibleSpend: number;
}

export interface ProcurementComplianceItemInput {
    amount: number;
    complianceFlags?: readonly string[] | null;
}

const COMPLIANCE_LABELS: Record<ProcurementItemComplianceFlag, string> = {
    agpo: "AGPO",
    local_content: "Local Content",
    pwd: "PWD",
};

const COMPLIANCE_ORDER: ProcurementItemComplianceFlag[] = [
    "agpo",
    "pwd",
    "local_content",
];

export function formatProcurementComplianceLabel(
    flag: ProcurementItemComplianceFlag,
): string {
    return COMPLIANCE_LABELS[flag];
}

export function serializeProcurementComplianceFlags(
    flags: readonly string[] | null | undefined,
): string {
    return normalizeComplianceFlags(flags).join(",");
}

export function calculateProcurementComplianceSnapshot(args: {
    items: readonly ProcurementComplianceItemInput[];
    totalEligibleSpend: number;
}): ProcurementComplianceSnapshot {
    const totalEligibleSpend = sanitizeFiniteCurrency(args.totalEligibleSpend);

    const amountsByFlag = COMPLIANCE_ORDER.reduce(
        (accumulator, flag) => {
            accumulator[flag] = 0;
            return accumulator;
        },
        {} as Record<ProcurementItemComplianceFlag, number>,
    );

    for (const item of args.items) {
        const amount = sanitizeFiniteCurrency(item.amount);
        const normalizedFlags = normalizeComplianceFlags(item.complianceFlags);

        for (const flag of normalizedFlags) {
            amountsByFlag[flag] += amount;
        }
    }

    return {
        metrics: COMPLIANCE_ORDER.map((flag) => {
            const amount = roundCurrency(amountsByFlag[flag]);
            const targetPercent = PROCUREMENT_COMPLIANCE_TARGET_PERCENTAGES[flag];

            if (totalEligibleSpend <= 0) {
                return {
                    amount,
                    announcementText: `${formatProcurementComplianceLabel(flag)} target is waiting for a plan total.`,
                    flag,
                    label: formatProcurementComplianceLabel(flag),
                    percent: null,
                    percentLabel: "No plan total yet",
                    status: "empty" as const,
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
                status: targetMet ? ("met" as const) : ("unmet" as const),
                targetMet,
                targetPercent,
                targetPercentLabel: `${targetPercent}% target`,
            };
        }),
        multiFlagNotice:
            "Items can count toward more than one compliance target when their catalog flags overlap.",
        totalEligibleSpend,
    };
}

export function createUnavailableProcurementComplianceSnapshot(args?: {
    totalEligibleSpend?: number;
}): ProcurementComplianceSnapshot {
    const totalEligibleSpend = sanitizeFiniteCurrency(args?.totalEligibleSpend);

    return {
        metrics: COMPLIANCE_ORDER.map((flag) => {
            const targetPercent = PROCUREMENT_COMPLIANCE_TARGET_PERCENTAGES[flag];

            return {
                amount: 0,
                announcementText: `${formatProcurementComplianceLabel(flag)} details are unavailable for this saved plan snapshot.`,
                flag,
                label: formatProcurementComplianceLabel(flag),
                percent: null,
                percentLabel: "Unavailable",
                status: "unavailable" as const,
                targetMet: false,
                targetPercent,
                targetPercentLabel: `${targetPercent}% target`,
            };
        }),
        multiFlagNotice:
            "Compliance details are unavailable for this saved plan snapshot, but persisted budget totals remain visible.",
        totalEligibleSpend,
    };
}

function sanitizeFiniteCurrency(value: number | null | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }

    return value < 0 ? 0 : roundCurrency(value);
}

function roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatPercent(value: number): string {
    const formatted = value.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted}%`;
}
