"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tenant_isolation_1 = require("../lib/auth/tenant-isolation");
// @ts-expect-error Raw document IDs are not verified tenant-scoped IDs.
const _invalidScopedId = rawTenantUserId;
// @ts-expect-error Verified IDs for different tables are not interchangeable.
const _wrongTableId = verifiedTenantUserId;
// Verified IDs assigned to the matching table type must compile cleanly.
const _validScopedId = verifiedTenantUserId;
const _validTenantId = verifiedTenantId;
// Verified IDs are assignable to plain string (read-only widening is allowed).
const _stringWidening = verifiedTenantUserId;
const _accessibleCount = (0, tenant_isolation_1.countAccessibleTenantOwnedRecords)(accessibleTenantUsers);
const _accessibleExists = (0, tenant_isolation_1.hasAccessibleTenantOwnedRecord)(accessibleTenantUsers, rawTenantUserId);
// @ts-expect-error Accessibility helpers must only accept sanitized tenant-owned records.
const _invalidAccessibleCount = (0, tenant_isolation_1.countAccessibleTenantOwnedRecords)(rawTenantUsers);
const _invalidAccessibleExists = 
// @ts-expect-error Accessibility helpers must only accept sanitized tenant-owned records.
(0, tenant_isolation_1.hasAccessibleTenantOwnedRecord)(rawTenantUsers, rawTenantUserId);
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
