# 01-Product-Requirements

## Purpose

This folder contains formalized product requirements, stakeholder analysis, and research that defines **what** needs to be built. These documents bridge vision and technical implementation.

## Folder Structure

```
01-Product-Requirements/
├── prds/              # Product Requirements Documents
├── briefs/            # Product/Game briefs
├── research/          # Market research, competitive analysis
└── stakeholders/      # Stakeholder analysis, user personas
```

## Subfolders

### `prds/`
**Formal Product Requirements Documents** - Comprehensive specifications of product features, user needs, and success criteria.

**Contains:**
- PRDs for specific features or epics
- Requirements traceability matrices
- Acceptance criteria definitions

**Example:** `prd-procurement-workflow-v2.md`

### `briefs/`
**Product and Project Briefs** - High-level vision documents that precede detailed PRDs.

**Contains:**
- Product vision briefs
- Game design briefs (for game projects)
- Project kickoff briefs

**Example:** `product-brief-procurement-automation.md`

### `research/`
**Market and User Research** - Evidence-based insights that inform requirements.

**Contains:**
- Competitive analysis
- Market opportunity assessments
- User research findings

**Example:** `competitive-analysis-procurement-platforms.md`

### `stakeholders/`
**Stakeholder and User Analysis** - Understanding who the product serves.

**Contains:**
- Stakeholder analysis documents
- User personas
- User journey maps
- User story collections

**Example:** `persona-procurement-officer.md`

## BMAD Workflows That Output Here

- `/bmad:bmm:workflows:product-brief` → `briefs/`
- `/bmad:bmm:workflows:game-brief` → `briefs/`
- `/bmad:bmm:workflows:prd` → `prds/`
- `/bmad:bmm:workflows:research` → `research/`
- `/bmad:bmm:agents:analyst` → `stakeholders/`

## Document Lifecycle

1. **Creation**: Briefs created first, then PRDs elaborated
2. **Review**: Stakeholder review and approval
3. **Immutability**: Once approved, PRDs are versioned not replaced
4. **Traceability**: Requirements traced through to stories and tests

## Related Folders

- **Previous Phase**: `00-Vision-Exploration/` - Vision shapes requirements
- **Next Phase**: `02-Architecture/` - Requirements inform technical design
- **Implementation**: `04-Development/epics/` - Requirements decomposed into stories
- **Validation**: `05-Testing/test-plans/` - Requirements drive test strategy
