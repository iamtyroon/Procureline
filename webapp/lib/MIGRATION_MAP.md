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
- `auth/department-user-access.ts` -> `shared/auth/department-user-access.ts`
- `auth/department-user-request-context.ts` -> `backend/auth/department-user-request-context.ts`
- `auth/department-user-request-context-token.ts` -> `backend/auth/department-user-request-context-token.ts`
- `auth/password-reset.ts` -> `shared/auth/password-reset.ts`
- `auth/proxy.ts` -> `backend/auth/proxy.ts`
- `auth/public-entry.ts` -> `shared/auth/public-entry.ts`
- `auth/public-routes.ts` -> `shared/auth/public-routes.ts`
- `auth/roles.ts` -> `shared/auth/roles.ts`
- `auth/session.ts` -> `shared/auth/session.ts` and `frontend/auth/session.ts`
- `auth/signup-flow.ts` -> `shared/auth/signup-flow.ts`
- `auth/tenant-isolation.ts` -> `backend/auth/tenant-isolation.ts`
- `security/audit.ts` -> `shared/security/audit.ts`
- `security/bridge.ts` -> `backend/security/bridge.ts`
- `security/input.ts` -> `shared/security/input.ts`
- `security/origins.ts` -> `backend/security/origins.ts`
- `security/policy.ts` -> `backend/security/policy.ts`
- `procurement/compliance.ts` -> `shared/procurement/compliance.ts` with `procurement/compliance.ts` retained as a compatibility export
- procurement item workspace validation primitives -> `shared/procurement/items.ts`
- procurement category icon contract -> `shared/procurement/categories.ts`
- `blockly/block-definitions.ts` -> `frontend/blockly/block-definitions.ts`
- `blockly/du-editor-fallback.ts` -> `frontend/blockly/du-editor-fallback.ts`
- `blockly/du-plan-routes.ts` -> `frontend/blockly/du-plan-routes.ts` and `shared/blockly/du-plan-rules.ts`
- `blockly/du-toolbox.ts` -> `frontend/blockly/du-toolbox.ts` and `shared/blockly/du-toolbox-selection.ts`
- `blockly/workspace-draft-queue.ts` -> `frontend/blockly/workspace-draft-queue.ts` and `shared/blockly/workspace-save-state.ts`
- `blockly/workspace-events.ts` -> `frontend/blockly/workspace-events.ts`
- `blockly/workspace-runtime.ts` -> `frontend/blockly/workspace-runtime.ts`
- `blockly/workspace-ui-state.ts` -> `frontend/blockly/workspace-ui-state.ts`
- `blockly/blockly-serialization.ts` -> `shared/blockly/blockly-serialization.ts` and `frontend/blockly/workspace-serialization.ts`
- `blockly/du-workspace-calculations.ts` -> `shared/blockly/du-workspace-calculations.ts`
- `blockly/editor-contract.ts` -> `shared/blockly/editor-contract.ts`
- `blockly/plan-submission.ts` -> `shared/blockly/plan-submission.ts`
- `blockly/workspace-catalog-identity.ts` -> `shared/blockly/workspace-catalog-identity.ts`
- `blockly/workspace-save.ts` -> `shared/blockly/workspace-save.ts`
- `blockly/workspace-validation.ts` -> `shared/blockly/workspace-validation.ts`

### Notes

- `tenant-admin/dashboard-cache.ts` moved to `frontend/tenant-admin/dashboard-cache.ts` because it is a browser storage helper consumed by client UI.
- `auth/session.ts` was split because session-state evaluation is shared by Convex/tests, while remember-me bootstrap storage is browser-only.

## Deferred

- None for the auth/security lib boundary split.
- None for the Blockly lib boundary split.
