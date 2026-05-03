# Sprint Change Proposal: Epic 7 PO Consolidation Alignment

## Section 1: Issue Summary
**Problem Statement:** The original Epic 7 documentation (Story 7.2) described a complex "Drag-and-Drop Department Consolidation" feature where the Procurement Officer would manually drag department blocks onto a canvas. This approach was over-engineered and deviated from the simpler, more efficient unified consolidation view already implemented in the project prototype (`procurelinedb.html`). 

**Context:** During review of the implementation artifacts, it was discovered that the PO consolidation workspace prototype automatically aggregates all approved department plans into a single Blockly view without requiring manual drag-and-drop assembly. Adhering to the original documentation would lead to "hallucinating" a feature that strayed from the validated prototype.

## Section 2: Impact Analysis
- **Epic Impact:** Epic 7 needed modifications to Story 7.1 and complete replacement of Story 7.2 to reflect automated aggregation instead of manual assembly.
- **Story Impact:** 
  - Story 7.1: Updated to state that opening the consolidation workspace automatically loads all approved plans.
  - Story 7.2: Completely redefined from "Drag-and-Drop Department Consolidation" to "Automated Department Plan Aggregation".
- **Artifact Conflicts:** The Epic 7 document in `implementation-artifacts/epics/epic7/epic-07-consolidation-export.md` was in direct conflict with the prototype UI/UX in `docs/html/procurelinedb.html`.
- **Technical Impact:** Simplifies the implementation significantly. The frontend no longer needs to handle complex drag-and-drop mechanics between "available departments" and a "consolidation canvas". Instead, the backend will dynamically aggregate all `status: 'approved'` plans when the PO opens the workspace.

## Section 3: Recommended Approach
**Selected Approach:** Direct Adjustment (Option 1)
**Rationale:** We can directly modify the existing Epic 7 stories to align with the prototype without affecting the overall MVP timeline or scope. In fact, this approach reduces technical complexity and implementation effort by removing the need for custom drag-and-drop mechanics in the UI. 
**Effort Estimate:** Low (Simplifies development)
**Risk Level:** Low 

## Section 4: Detailed Change Proposals
*Note: These changes have already been applied to `epic-07-consolidation-export.md`.*

**Story 7.2 Update:**
*OLD:* Drag-and-Drop Department Consolidation (User drags departments onto a canvas to build the master plan).
*NEW:* Automated Department Plan Aggregation (System automatically aggregates all approved plans into a single unified master plan upon initialization).

**Story 7.1 Update:**
*OLD:* System shows all approved department plans as draggable blocks.
*NEW:* System automatically loads all approved department plans into the unified view.

**Implementation Notes Update:**
*OLD:* Consolidation uses Blockly visual interface for department blocks...
*NEW:* Consolidation uses a unified Blockly visual interface which aggregates all approved departmental plans automatically...

## Section 5: Implementation Handoff
- **Change Scope:** Minor (Simplification of existing planned work)
- **Route to:** Development Team
- **Deliverables:** Updated `epic-07-consolidation-export.md`
- **Responsibilities:** Developers should implement the PO Consolidation Workspace by following the prototype pattern in `procurelinedb.html`, ensuring all approved plans are automatically loaded into the Blockly editor when opened by a Procurement Officer.
