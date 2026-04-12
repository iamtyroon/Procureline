# Story 5.4: Plan Persistence & Recovery

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want my Blockly procurement plan to save automatically and recover safely after interruptions,
so that I do not lose work when connectivity drops, the browser closes unexpectedly, or I need to return later to finish the draft.

## Acceptance Criteria

1. [Given] a Departmental User edits an editable Blockly draft [When] the workspace changes settle [Then] the editor continues the current automatic draft-save behavior through the canonical `saveDepartmentUserWorkspaceDraft` path [And] the header save state remains truthful with statuses such as `Saving draft...`, `Saved`, or an equivalent queued or recovery-aware state instead of implying that every local edit has already reached Convex (FR39e, FR47).
2. [Given] the browser is offline, the Convex client is temporarily disconnected, or a draft-save attempt otherwise cannot be confirmed immediately [When] the DU keeps editing [Then] the latest workspace snapshot is persisted into a browser-owned offline queue for that plan and user [And] the UI shows that changes are queued locally instead of silently dropping them or repeatedly failing toasts on every edit (FR39e, architecture offline support).
3. [Given] offline or transient-save conditions resolve [When] connectivity returns or the editor regains a healthy Convex session [Then] queued draft snapshots are retried automatically against the existing canonical draft-save mutation [And] replay is coalesced so stale intermediate snapshots do not overwrite the newest workspace state or create needless save storms (FR39e, FR47).
4. [Given] the DU has unsynced queued work or an in-flight draft persistence operation [When] they try to reload the page, close the tab, navigate away in-browser, or use the editor `Exit` action [Then] the app warns them that unsaved changes may be lost and offers a clear `Stay`/`Leave` decision [And] browser-level `beforeunload` handling is only attached while there is real unsynced risk instead of permanently degrading navigation performance (FR39g).
5. [Given] the browser crashes, the tab is killed, or the editor is reopened after an interrupted session [When] a newer local recovery snapshot exists than the last acknowledged server draft [Then] the DU is offered a truthful recovery path that restores the newer local workspace into the editor [And] the app surfaces copy such as `Recovered unsaved changes. Review and save.` instead of silently overwriting the canonical draft or discarding local work (FR39h).
6. [Given] a local recovery snapshot exists but the live server draft is newer, equal, or otherwise authoritative [When] the editor resolves startup state [Then] the app loads the correct canonical draft without false recovery prompts [And] stale local recovery entries are ignored or cleared deterministically so reopen flows do not oscillate between old and new plan states (FR39h, current revision metadata seam).
7. [Given] the DU explicitly wants to start over [When] they invoke `Start Over` or `Clear Plan` from the editor shell [Then] the app presents an app-native confirmation that explains the full effect on the current draft [And] confirming clears the editable planning canvas plus any queued offline snapshots and recovery backups for that plan while preserving the required department context and truthful empty-state recalculation [And] the cleared workspace is persisted back through the canonical draft-save path so the next login does not resurrect pre-reset server state (FR39j).
8. [Given] a plan draft has already been saved previously [When] the DU logs in later or reopens `/du/plans/[planId]` [Then] the editor restores the canonical saved draft by default and can continue from the latest acknowledged or intentionally recovered workspace state without creating a second same-year plan or losing existing summary truthfulness on the DU dashboard (FR47, Story 5.2 canonical-plan contract).
9. [Given] the DU is viewing a submitted, approved, or otherwise read-only plan [When] the editor renders in view mode [Then] autosave, offline queueing, recovery restoration, leave-page warnings, and `Start Over` are disabled or hidden truthfully [And] the story does not backdoor write operations into read-only sessions (current read-only contract).
10. [Given] local browser persistence is unavailable, corrupted, or quota-limited [When] the editor attempts to queue or restore recovery data [Then] the DU gets a truthful non-blocking warning, the existing Convex-backed draft flow continues where possible, and the editor fails closed without corrupting the canonical server draft (NFR-S7, MDN storage limits guidance).
11. [Given] validation, catalog-lifecycle, budget, and compliance state are already derived by Stories 5.3, 5.6, and 5.7 [When] a recovered or queued workspace snapshot is loaded or replayed [Then] the restored plan runs through the same current identity-reconciliation and rollup helpers so warnings, totals, removed-item notices, duplicate handling, and reserved-submit blockers remain truthful after recovery instead of diverging from live editor rules.
12. [Given] the current repo already serializes Blockly workspace JSON with `revision`, `lastSavedAt`, `lastSavedByUserId`, `recoveredAt`, and `saveSource` metadata [When] Story 5.4 extends persistence behavior [Then] the implementation reuses and evolves that metadata seam for queue and recovery state instead of introducing a second unrelated draft format or falling back to XML-based storage (Story 5.2 JSON contract, Blockly save/load guidance).
13. [Given] multiple local snapshots can be produced quickly while the DU drags blocks or edits quantities [When] offline queueing and recovery backups are written [Then] the implementation coalesces to the latest durable plan snapshot per plan and user, preserves monotonic revision ordering, and prevents an older local snapshot from overwriting a newer server draft after reconnect (FR39e, current `revision` metadata, NFR-P2).
14. [Given] the same DU opens the same plan in multiple tabs or browser windows [When] each editor can produce local queue or recovery snapshots independently [Then] the implementation detects the competing local session and avoids silently replaying stale work from the background tab [And] the user gets a truthful refresh-or-recover message instead of nondeterministic last-tab-wins behavior.
15. [Given] a queued draft snapshot is ready to replay after reconnect [When] the server-side plan has since become read-only, been deleted, or otherwise fails the current editability checks [Then] queued replay halts deterministically, the stale local snapshot is not retried forever, and the DU receives truthful guidance that the plan can no longer accept draft changes.
16. [Given] save and recovery status is visible in the editor shell [When] accessibility needs apply [Then] queued, saved, recovered, blocked, and error states are expressed through visible text and meaningful `aria-live` announcements rather than color alone, and high-frequency recalculation or save ticks do not spam screen readers on every keystroke (NFR-A1, UX accessibility guidance).
17. [Given] Story 5.4 completes [When] automated coverage runs [Then] the repo contains deterministic tests for queued-offline snapshot coalescing, reconnect retry, leave-page warning activation, local recovery resolution, stale-recovery suppression, clear-plan confirmation, concurrent-tab conflict handling, read-only no-op behavior, storage-failure fallback, and stale-revision rejection so later submission stories build on a resilient draft foundation.

## Tasks / Subtasks

- [x] Task 1: Introduce a browser-owned DU workspace persistence coordinator instead of calling Convex directly from every editor change (AC: 1-6, 8-10, 13-17)
  - [x] Add a focused helper such as `webapp/lib/blockly/workspace-draft-queue.ts` or equivalent that owns per-plan draft queue records, recovery snapshots, retry status, and coalescing rules.
  - [x] Prefer IndexedDB for queued Blockly snapshots and recovery blobs because the workspace payload is structured JSON and can grow beyond comfortable `localStorage` use; use smaller browser storage only for lightweight flags if needed.
  - [x] Key local draft continuity state by current user plus plan ID so one DU's browser data does not leak into another DU's draft or another plan for the same tenant.
  - [x] Keep the queue model latest-snapshot-first for a given plan instead of replaying every intermediate keystroke-sized mutation when reconnect happens.
  - [x] Include a deterministic same-plan multi-tab coordination signal, such as a per-plan session marker or heartbeat, so a background tab cannot silently replay stale queued work over a foreground editor session.

- [x] Task 2: Extend the current Blockly workspace metadata seam for recovery-aware saves and stale-replay protection (AC: 2-6, 10-15)
  - [x] Reuse `webapp/lib/blockly/blockly-serialization.ts` and evolve the existing `editorMetadata` contract with any additional safe fields needed for queueing or recovery, such as expanded `saveSource` values or last-acknowledged revision markers.
  - [x] Keep JSON Blockly serialization as the only canonical workspace format; do not introduce XML persistence, ad hoc DOM snapshots, or a second local-only plan model.
  - [x] Ensure recovery restores stamp `recoveredAt` and any new recovery provenance fields truthfully so the UI and backend can reason about what happened.
  - [x] Add a server-safe stale-write contract in `webapp/convex/functions/plans.ts` so older queued revisions cannot silently overwrite newer persisted drafts after reconnect.
  - [x] Extend the save-source or revision metadata enough to distinguish normal sync, local-recovery restore, and clear-plan resets so conflict handling and queue cleanup stay explicit.

- [x] Task 3: Rework the DU editor save orchestration around queueing, recovery, and truthful state reporting (AC: 1-3, 5-6, 8-16)
  - [x] Update `webapp/src/components/blockly/BlocklyEditor.tsx` so change handling passes through the new persistence coordinator instead of directly awaiting every debounced mutation result inline.
  - [x] Preserve the current `lastSavedAt` and save-badge rhythm, but add truthful queued or recovery-aware states so the header distinguishes `saved to server` from `saved locally and pending sync`.
  - [x] Keep current `BlocklyWorkspace` debounced snapshot generation, validation feedback, and summary recalculation seams; Story 5.4 should extend them, not replace them.
  - [x] Reuse existing `toast` and alert-card patterns for recovery notices, storage fallback warnings, and clear-plan outcomes instead of prototype-style browser alerts.
  - [x] Surface explicit blocked-sync messaging when replay is refused because the plan became read-only, missing, or stale relative to another local editing session.

- [x] Task 4: Add page-leave guardrails and explicit reset behavior without regressing the current planning shell (AC: 4, 7, 9, 16-17)
  - [x] Attach `beforeunload` listeners only while unsynced or in-flight draft risk exists, and remove them again when the editor is safely synced.
  - [x] Add an in-app confirm path for the `Exit` action and any route-level navigation that bypasses the browser dialog but still risks losing queued work.
  - [x] Use a more reliable lifecycle signal such as `visibilitychange` or equivalent app-state handling for automatic recovery snapshot persistence instead of relying on `beforeunload` alone.
  - [x] Add a real `Start Over` or `Clear Plan` affordance to the editor shell that clears the plan safely without leaving orphaned local queue or recovery records behind.
  - [x] Ensure `Start Over` clears both browser-owned recovery state and the canonical server draft snapshot in one truthful flow so reset work does not come back on the next reopen.

- [x] Task 5: Keep backend draft persistence authoritative while remaining compatible with the current DU plan summary contract (AC: 1-3, 6, 8-15, 17)
  - [x] Extend `webapp/convex/functions/plans.ts` so draft-save handling can reject stale revisions or other replay hazards while still recomputing category summaries, item counts, budget totals, and compliance posture from workspace JSON.
  - [x] Preserve tenant scoping, DU editability guards, and canonical one-plan-per-department-plus-fiscal-year behavior already established in Story 5.2.
  - [x] Ensure queue replay and recovery restore still flow through `workspace-save.ts`, `workspace-catalog-identity.ts`, and `du-workspace-calculations.ts` so server and client summary truth stays aligned.
  - [x] Fail closed on malformed recovery or queued payloads without partially patching the server draft.
  - [x] When replay is rejected because editability or existence changed, return a deterministic error contract that tells the client to stop retrying and clear or quarantine the queued snapshot.

- [x] Task 6: Add deterministic guardrail coverage for autosave continuity, offline queueing, and recovery (AC: 1-17)
  - [x] Add pure helper tests for queue coalescing, recovery snapshot freshness comparison, storage parse failures, stale-revision filtering, and clear-plan cleanup.
  - [x] Extend `webapp/tests/department-user-blockly-workspace.test.ts` or add focused new suites such as `webapp/tests/blockly-workspace-persistence.test.ts` for reconnect retry, read-only no-op behavior, leave-warning activation, recovery prompts, concurrent-tab conflict handling, and start-over confirmation.
  - [x] Add backend tests proving stale queued revisions are rejected while newer revisions still persist and recompute summaries correctly.
  - [x] Update `webapp/tests/run-tests.ts` if any new suites are introduced.

## Dev Notes

### Story Foundation

- Epic 5 positions Story 5.4 as the continuity layer that makes the DU Blockly editor safe for real work after Story 5.2 introduced canonical JSON persistence, Story 5.3 hardened validation, Story 5.6 centralized budget/compliance summaries, and Story 5.7 improved toolbox and viewport ergonomics.
- The current editor already saves debounced draft snapshots to Convex and shows a `Saved` indicator, so this story is not starting from zero.
- The real gap is what happens outside the happy path: lost connectivity, browser interruption, stale queued writes, and explicit "start over" behavior.

### Previous Story Intelligence

- Story 5.2 established the canonical `plans.workspaceState` JSON contract, the thin `/du/plans/*` route shell, and the current debounced `BlocklyWorkspace` snapshot flow. Story 5.4 must preserve that foundation instead of replacing the editor architecture.
- Story 5.3 already owns validation issue shaping, duplicate-item prevention, lifecycle warnings, and truthful submit blockers. Recovery or queue replay must pass through those same helpers instead of reviving stale or pre-guardrail workspace states blindly.
- Story 5.6 moved persisted budget and compliance truth onto the server by recalculating from `workspaceState` in `saveDepartmentUserWorkspaceDraft`; Story 5.4 should extend that save path, not create a second local-only summary model.
- Story 5.7 already introduced `workspace-ui-state.ts` for viewport-only local persistence and hardened hydration event handling. Story 5.4 should mirror that helper-driven local-state style while keeping draft continuity separate from mere UI viewport state.
- Story 4.7 and Story 4.8 established archive-safe category and item identity handling. Recovery logic must therefore preserve stable IDs and rerun current identity reconciliation rather than treating saved labels as authoritative.

### Planning And Prototype Intelligence

- The Epic 5 source explicitly calls for `Real-time sync via Convex subscriptions with offline queue` and `Local storage backup for crash recovery`, and Story 5.4 acceptance criteria in the epic require FR39e, FR39g, FR39h, FR39j, and FR47.
- The architecture artifact is even more specific:
  - `Offline Support | IndexedDB with auto-sync`
  - `User Editing -> Auto-save to IndexedDB`
  - `Network Online? -> Yes -> Sync to Convex / No -> Continue saving to IndexedDB`
  - `Conflict Detected? -> Show diff dialog`
- The earlier UX specification contains a higher-level note that offline capability is not required for MVP, but that conflicts with the later and more story-specific Epic 5 plus architecture requirements. For Story 5.4, treat the epic and architecture as canonical and scope the work narrowly to DU draft continuity rather than a whole-app offline mode.
- The HTML prototype seeds the editor from an IndexedDB-backed demo database and already treats local browser storage as part of the continuity story. Production implementation should keep Convex as canonical while using browser storage only for queue and recovery durability.

### Current Implementation State Discovered In Code

- `webapp/src/components/blockly/BlocklyWorkspace.tsx` already:
  - serializes debounced Blockly snapshots,
  - queues a direct `onWorkspaceChange(...)` callback after roughly `700ms`,
  - persists viewport state to `localStorage`,
  - and suppresses hydration-only save noise.
- `webapp/src/components/blockly/BlocklyEditor.tsx` already:
  - calls `api.functions.plans.saveDepartmentUserWorkspaceDraft` through `useMutation(...)`,
  - tracks `saveState` as `idle | saving | saved | error`,
  - exposes `lastSavedAt`,
  - and toasts when direct draft sync fails.
  It does not yet queue failed saves locally, warn on leave, restore a crash snapshot, or expose a `Start Over` flow.
- `webapp/lib/blockly/blockly-serialization.ts` already has an important extension seam:
  - `revision`
  - `lastSavedAt`
  - `lastSavedByUserId`
  - `recoveredAt`
  - `saveSource`
  but `saveSource` currently supports only `workspace_seed` and `workspace_sync`.
- `webapp/lib/blockly/workspace-save.ts` and `webapp/convex/functions/plans.ts` already recompute persisted summaries from workspace JSON safely, but they do not yet reject stale local replay using revision-aware optimistic concurrency.
- `webapp/lib/blockly/workspace-ui-state.ts` persists only zoom and pan metadata to `localStorage`; there is no plan-draft queue or crash-recovery helper yet.
- Repo-wide search confirms there is currently no DU editor handling for:
  - `beforeunload`
  - `visibilitychange`
  - browser `online`/`offline` events
  - IndexedDB-backed draft queueing
  - `Start Over` or `Clear Plan`
  - local crash-recovery prompts
  - same-plan multi-tab coordination or blocked replay cleanup after editability changes

### Technical Requirements

- Keep Convex as the canonical source of truth for saved DU drafts. Browser persistence in this story is a durability layer for interrupted sessions, not a competing authoritative plan store.
- Prefer IndexedDB for queued workspace snapshots and recovery blobs because Blockly JSON is structured, potentially large, and better suited to IndexedDB than generic Web Storage alone.
- Reuse the current JSON Blockly serialization contract and current summary derivation pipeline. Do not introduce XML, DOM scraping, or hand-rolled alternative plan formats.
- Queueing must be plan-scoped and user-scoped, coalesce to the latest durable snapshot for that plan, and preserve monotonic revision ordering.
- Older queued revisions must never overwrite newer persisted drafts after reconnect. The server and client need one shared stale-write contract.
- Same-plan multi-tab editing must not degenerate into silent last-tab-wins queue replay. The implementation needs one deterministic local-conflict rule and one truthful user-facing message.
- Local recovery prompts must be deterministic:
  - newer local unsynced snapshot -> offer recovery
  - equal or older local snapshot -> load server draft quietly
- Recovery restore must rerun current catalog identity refresh, validation, budget, and compliance helpers so saved warnings and totals remain truthful under current business rules.
- `beforeunload` should be used sparingly and only when there is real unsynced risk. Because browser support is limited and unreliable in some cases, automatic recovery snapshots should also hook into a more reliable lifecycle signal such as `visibilitychange` or equivalent.
- `Start Over` or `Clear Plan` should clear nested planning content plus local queue or recovery state for that plan, but should not break the editor contract by removing required department-level context or creating a second plan record.
- `Start Over` must also persist the emptied canonical draft back to Convex. Otherwise the next reopen can resurrect the pre-reset server workspace even if local cleanup succeeded.
- Read-only sessions must remain read-only. This story must not re-enable persistence or queue replay for submitted or approved plans.
- If a queued replay becomes invalid because the plan was submitted, approved, deleted, or access changed elsewhere, the client must stop retrying and surface a deterministic blocked-sync state rather than spinning forever.
- If IndexedDB or browser storage fails, the user should receive truthful feedback and the app should fail closed without corrupting the canonical draft.

### Detected Conflicts Or Variances

- `_bmad-output/planning-artifacts/ux-design-specification.md` says offline capability is not required for MVP, but the more specific Epic 5 story map, PRD FR39e/FR39h, and architecture all require offline queueing plus crash recovery for the DU editor.
- The clean resolution for this story is:
  - implement editor-scoped draft continuity and recovery only;
  - do not broaden into generalized offline browsing, offline auth, or whole-app synchronization semantics.
- Convex React already retries outstanding mutations and reconnects automatically. Story 5.4 therefore should not duplicate Convex's in-flight retry semantics blindly; it should add browser-owned queueing and recovery for cases beyond the lifetime of an outstanding mutation or beyond the active tab session.

### Architecture Compliance

- Keep App Router pages thin and continue using the current DU planning stack:
  - `DepartmentUserBlocklyWorkspace`
  - `BlocklyEditor`
  - `BlocklyWorkspace`
- Keep authorization, editability checks, tenant scoping, and persisted-summary recomputation in Convex functions near the data source.
- Reuse helper-first boundaries:
  - serialization helpers
  - workspace save helpers
  - workspace event helpers
  - identity reconciliation helpers
- Preserve JSON Blockly persistence and the current lazy client-only Blockly host. Story 5.4 is a persistence enhancement, not a route-architecture rewrite.
- Keep future boundaries explicit:
  - Story 5.5 owns request-item workflow completion
  - Story 6.1 owns true plan submission
  - Story 6.2 owns deeper submission-readiness validation
  - Story 7+ may own broader multi-plan merge semantics if needed

### Library And Framework Requirements

- Stay on the repo's installed stack for this story unless a separately approved dependency change is required:
  - Next.js `^16.1.6` in `webapp/package.json`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - React `^19.2.4`
  - `sonner` `^2.0.7`
- Verified locally on 2026-04-06:
  - `npm view next version` -> `16.2.2`
  - `npm view convex version` -> `1.34.1`
  - `npm view blockly version` -> `12.5.1`
- Official guidance still relevant to this story:
  - Convex React docs say mutations are automatically retried until confirmed and that the client reconnects when the internet connection drops.
  - MDN says `beforeunload` is mainly for a browser-generated leave-confirmation dialog, requires user interaction, and is not reliably fired in some environments.
  - MDN describes IndexedDB as suitable for significant structured client-side data.
  - Blockly save/load docs continue to recommend JSON serialization via `Blockly.serialization.workspaces.save(...)` and `load(...)`.
- Inference:
  - Story 5.4 should layer browser-owned queue and recovery durability around the existing Convex mutation flow;
  - it should not replace JSON workspace persistence or invent a second serialization model.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/lib/blockly/blockly-serialization.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/blockly/workspace-events.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/schema.ts` if the workspace validator or save-source union is extended
  - `webapp/tests/department-user-blockly-workspace.test.ts`

- Expected new files (recommended):
  - `webapp/lib/blockly/workspace-draft-queue.ts`
  - `webapp/lib/blockly/workspace-recovery.ts`
  - `webapp/tests/blockly-workspace-persistence.test.ts`

### Testing Requirements

- Add pure helper tests for:
  - queue coalescing to latest snapshot
  - revision freshness comparison
  - stale local recovery suppression
  - IndexedDB parse or write failure fallback
  - clear-plan cleanup of queue and recovery records
- Add backend tests for:
  - stale revision rejection
  - newer revision acceptance
  - persisted summary recomputation remaining truthful after queue replay
  - read-only plan save rejection staying intact
- Add editor or workspace regression tests for:
  - reconnect-triggered queued save flush
  - leave-warning listener activation only while unsynced or in-flight work exists
  - recovery prompt shown only when local snapshot is newer than server draft
  - read-only mode avoiding queue or recovery writes
  - `Start Over` confirmation and empty-plan reset
- Update `webapp/tests/run-tests.ts` if new suites are introduced.

### Git Intelligence Summary

- Recent DU Blockly commits reinforce a stable extension pattern rather than rewrite pressure:
  - `8b25c49` refined workspace validation and quantity normalization in focused helper files.
  - `4d66927` added shared validation, duplicate handling, and editor-shell truthfulness without replacing the planning architecture.
  - `4991029` improved toolbox/UI behavior and runtime helpers while keeping persistence and event seams modular.
- Earlier Epic 5 work already established the main surfaces this story should extend:
  - `0108dee` for the core Blockly editor shell
  - `caf9721` for shared budget/compliance calculations and editor feedback
- Inference from those commits and the live codebase:
  - Story 5.4 should land as targeted additions to `BlocklyEditor`, `BlocklyWorkspace`, serialization, save helpers, and plan persistence;
  - a broad editor rewrite or a second planning shell would cut against the current repo direction and raise unnecessary regression risk.

### Latest Tech Information

- Verified on 2026-04-06:
  - Next.js latest npm version: `16.2.2`
  - Convex latest npm version: `1.34.1`
  - Blockly latest npm version: `12.5.1`
- Official Convex React docs currently state:
  - mutations are automatically retried until confirmed written;
  - the client warns users if they try to close the tab while mutations are outstanding;
  - the client reconnects automatically when the internet connection drops.
- Official MDN docs currently state:
  - `beforeunload` exists mainly to trigger a browser-generated leave warning;
  - it requires sticky user activation;
  - it is not reliably fired in some scenarios and should be paired with more reliable state-save signals.
- Official MDN IndexedDB docs currently describe IndexedDB as the browser API for significant amounts of structured client-side data.
- Official Blockly docs, last updated 2025-03-10 UTC, continue to recommend JSON serialization and show `Blockly.serialization.workspaces.save(...)` and `load(...)` as the preferred APIs.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and tenant enforcement
  - shadcn/ui plus Tailwind styling
  - `sonner` for transient user feedback
  - Blockly block names in `snake_case`
  - JSON serialization for Blockly persistence
- Where older planning artifacts conflict with the live repo structure, prefer the live repo's current file layout and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 5 Source](../epic-05-du-blockly-planning.md)
- [Story 5.2 Reference](./5-2-blockly-workspace-core.md)
- [Story 5.3 Reference](./5-3-blockly-validation-constraints.md)
- [Story 5.6 Reference](./5-6-budget-meter-calculations.md)
- [Story 5.7 Reference](./5-7-blockly-toolbox-block-management.md)
- [Story 4.7 Reference](../../epic4/stories/4-7-category-management.md)
- [Story 4.8 Reference](../../epic4/stories/4-8-item-catalog-management.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [DU Prototype](../../../../../docs/html/procurelinedb.html)
- [Current Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Current Blockly Host](../../../../../webapp/src/components/blockly/BlocklyWorkspace.tsx)
- [Current Blockly Serialization](../../../../../webapp/lib/blockly/blockly-serialization.ts)
- [Current Workspace Save Helpers](../../../../../webapp/lib/blockly/workspace-save.ts)
- [Current Workspace Events](../../../../../webapp/lib/blockly/workspace-events.ts)
- [Current Workspace UI State Helpers](../../../../../webapp/lib/blockly/workspace-ui-state.ts)
- [Current Workspace Identity Helpers](../../../../../webapp/lib/blockly/workspace-catalog-identity.ts)
- [Current Plan Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current Webapp Package Versions](../../../../../webapp/package.json)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [MDN beforeunload Event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Blockly Save And Load Docs](https://developers.google.com/blockly/guides/get-started/save-and-load)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story sources:
  - `_bmad-output/implementation-artifacts/epics/epic5/epic-05-du-blockly-planning.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-2-blockly-workspace-core.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-3-blockly-validation-constraints.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-6-budget-meter-calculations.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-7-blockly-toolbox-block-management.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `docs/html/procurelinedb.html`
  - `webapp/package.json`
  - `webapp/convex/functions/plans.ts`
  - `webapp/lib/blockly/blockly-serialization.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/blockly/workspace-events.ts`
  - `webapp/lib/blockly/workspace-ui-state.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
- Git context:
  - `git log -5 --oneline`
  - `git show --stat --oneline 8b25c49`
  - `git show --stat --oneline 4d66927`
  - `git show --stat --oneline 4991029`
- Tech verification:
  - `cmd /c npm view next version`
  - `cmd /c npm view convex version`
  - `cmd /c npm view blockly version`
  - `https://docs.convex.dev/client/react`
  - `https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event`
  - `https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API`
  - `https://developers.google.com/blockly/guides/get-started/save-and-load`
- Verification commands:
  - `npm test`
  - `npm run lint`
  - `npx eslint src/components/blockly/BlocklyEditor.tsx lib/blockly/blockly-serialization.ts lib/blockly/workspace-draft-queue.ts lib/blockly/workspace-save.ts convex/functions/plans.ts convex/schema.ts tests/blockly-workspace-persistence.test.ts tests/department-user-blockly-workspace.test.ts tests/run-tests.ts`

### Completion Notes List

- 2026-04-06: Created implementation-ready story context for `5-4-plan-persistence-recovery` using the live DU Blockly editor, Epic 5 requirements, architecture offline-support guidance, and current official Convex, MDN, and Blockly documentation.
- 2026-04-06: Clarified that the repo already has debounced Convex draft persistence and viewport local storage, but still lacks app-owned offline queueing, crash-recovery restore, leave-page warnings, and a truthful clear-plan workflow.
- 2026-04-06: Resolved the planning-artifact conflict between the earlier UX `offline not required` note and the more specific PRD plus Epic 5 plus architecture requirements by scoping this story to editor-draft continuity rather than whole-app offline behavior.
- 2026-04-06: Updated sprint tracking so Story 5.4 is ready for development.
- 2026-04-06: Added `workspace-draft-queue.ts` to store per-plan queued snapshots and recovery snapshots in IndexedDB, coordinate same-plan multi-tab leases, and normalize truthful queued or blocked save labels for the DU editor.
- 2026-04-06: Extended Blockly workspace metadata and Convex draft persistence so `workspace_recovery` and `workspace_clear` save sources are preserved and stale queued revisions are rejected before they can overwrite a newer saved draft.
- 2026-04-06: Reworked `BlocklyEditor.tsx` around local recovery bootstrap, queued reconnect replay, visibility-driven recovery persistence, beforeunload and exit guardrails, recovery prompts, and a Start Over flow that clears and re-syncs the draft workspace.
- 2026-04-06: Added deterministic persistence tests in `webapp/tests/blockly-workspace-persistence.test.ts` and expanded Blockly workspace test coverage for stale revision handling; `npm test` passed after the changes.
- 2026-04-06: `npm run lint` still reports unrelated pre-existing TypeScript errors in `webapp/convex/functions/items.ts` and `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`; targeted ESLint on the Story 5.4 files completed with hook-dependency warnings only in `BlocklyEditor.tsx`.

### File List

- `_bmad-output/implementation-artifacts/epics/epic5/stories/5-4-plan-persistence-recovery.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/functions/plans.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/blockly/blockly-serialization.ts`
- `webapp/lib/blockly/workspace-draft-queue.ts`
- `webapp/lib/blockly/workspace-save.ts`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/tests/blockly-workspace-persistence.test.ts`
- `webapp/tests/department-user-blockly-workspace.test.ts`
- `webapp/tests/run-tests.ts`
- `webapp/.test-dist/lib/blockly/blockly-serialization.js`
- `webapp/.test-dist/lib/blockly/workspace-draft-queue.js`
- `webapp/.test-dist/lib/blockly/workspace-save.js`
- `webapp/.test-dist/tests/blockly-workspace-persistence.test.js`
- `webapp/.test-dist/tests/department-user-blockly-workspace.test.js`
- `webapp/.test-dist/tests/run-tests.js`

### Change Log

- 2026-04-06: Implemented Story 5.4 DU draft continuity across the Blockly editor, client-side persistence helpers, Convex stale-write protection, and deterministic persistence tests.

## Story Completion Status

- Story ID: `5.4`
- Story Key: `5-4-plan-persistence-recovery`
- Output File: `_bmad-output/implementation-artifacts/epics/epic5/stories/5-4-plan-persistence-recovery.md`
- Final Status: `review`
- Completion Note: `Implemented DU draft queueing, recovery prompts, stale-write protection, start-over handling, and deterministic persistence coverage on top of the existing Blockly planning foundation.`
