# Lib Migration Map

## Already Migrated

- `tenant-admin/onboarding-backend.ts` -> `backend/tenant-admin/onboarding.ts`
- `tenant-admin/onboarding.ts` -> `shared/tenant-admin/onboarding.ts`
- `tenant-admin/invitations.ts` -> `shared/tenant-admin/invitations.ts`
- `tenant-admin/institutional-visibility.ts` -> `shared/tenant-admin/institutional-visibility.ts`
- `tenant-admin/dashboard.ts` -> `shared/tenant-admin/dashboard.ts`
- `tenant-admin/dashboard-snapshot.ts` -> `shared/tenant-admin/dashboard-snapshot.ts`
- `tenant-admin/dashboard-cache.ts` -> `frontend/tenant-admin/dashboard-cache.ts`
- `platform-admin/auth.ts` -> `shared/platform-admin/auth.ts`
- `platform-admin/risk.ts` -> `backend/platform-admin/risk.ts`
- `platform-admin/request-context.ts` -> `backend/platform-admin/request-context.ts`
- `platform-admin/request-context-token.ts` -> `backend/platform-admin/request-context-token.ts`
- `platform-admin/dashboard-access-token.ts` -> `backend/platform-admin/dashboard-access-token.ts`
- `platform-admin/dashboard.ts` -> `shared/platform-admin/dashboard.ts`
- `platform-admin/dashboard-snapshot.ts` -> `shared/platform-admin/dashboard-snapshot.ts`
- `marketing/pricing.ts` -> `shared/marketing/pricing.ts`

### Notes

- `tenant-admin/dashboard-cache.ts` moved to `frontend/tenant-admin/dashboard-cache.ts` because it is a browser storage helper consumed by client UI.

## Deferred

- None for the admin lib boundary split.
