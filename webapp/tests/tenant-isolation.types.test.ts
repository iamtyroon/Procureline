import {
    countAccessibleTenantOwnedRecords,
    hasAccessibleTenantOwnedRecord,
    type AccessibleTenantOwnedRecord,
    type VerifiedTenantRecordId,
} from "../lib/auth/tenant-isolation";

declare const rawTenantUserId: string;
declare const verifiedTenantUserId: VerifiedTenantRecordId<"tenantUsers">;
declare const verifiedTenantId: VerifiedTenantRecordId<"tenants">;
declare const accessibleTenantUsers: ReadonlyArray<
    AccessibleTenantOwnedRecord<"tenantUsers">
>;
declare const rawTenantUsers: ReadonlyArray<{ _id: string; tenantId: string }>;

// @ts-expect-error Raw document IDs are not verified tenant-scoped IDs.
const _invalidScopedId: VerifiedTenantRecordId<"tenantUsers"> = rawTenantUserId;

// @ts-expect-error Verified IDs for different tables are not interchangeable.
const _wrongTableId: VerifiedTenantRecordId<"tenants"> = verifiedTenantUserId;

// Verified IDs assigned to the matching table type must compile cleanly.
const _validScopedId: VerifiedTenantRecordId<"tenantUsers"> = verifiedTenantUserId;
const _validTenantId: VerifiedTenantRecordId<"tenants"> = verifiedTenantId;

// Verified IDs are assignable to plain string (read-only widening is allowed).
const _stringWidening: string = verifiedTenantUserId;

const _accessibleCount = countAccessibleTenantOwnedRecords(accessibleTenantUsers);
const _accessibleExists = hasAccessibleTenantOwnedRecord(
    accessibleTenantUsers,
    rawTenantUserId,
);

// @ts-expect-error Accessibility helpers must only accept sanitized tenant-owned records.
const _invalidAccessibleCount = countAccessibleTenantOwnedRecords(rawTenantUsers);

const _invalidAccessibleExists =
    // @ts-expect-error Accessibility helpers must only accept sanitized tenant-owned records.
    hasAccessibleTenantOwnedRecord(rawTenantUsers, rawTenantUserId);

void [
    _invalidScopedId,
    _wrongTableId,
    _validScopedId,
    _validTenantId,
    _stringWidening,
    _accessibleCount,
    _accessibleExists,
    _invalidAccessibleCount,
    _invalidAccessibleExists,
];

export {};
