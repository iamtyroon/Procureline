# Agent Routing Guide

## Overview

This guide explains how BMAD agents automatically route documents to the correct folders based on document type and workflow outputs.

## System Components

### 1. Folder Map (`docs/folder-map.yaml`)

The **master routing configuration** that defines:
- Document type to folder mappings
- Workflow output destinations
- Naming conventions
- Special routing rules (epics, stories, sprints)

**Location:** `/docs/folder-map.yaml`

### 2. Core Configuration (`bmad/core/config.yaml`)

Contains:
- Reference to folder_map location
- Phase folder name mappings
- User preferences and settings

**Updated:** Config now includes `folder_map` and `doc_phases` keys

### 3. Workflow Engine (`bmad/core/tasks/workflow.xml`)

The execution engine that:
- Loads folder_map during workflow initialization
- Routes documents to correct folders based on type
- Creates output directories as needed

**Updated:** Now loads folder_map in phase 2 of variable resolution

## How Routing Works

### Step-by-Step Process

1. **Workflow Initialization**
   - Workflow loads `bmad/core/config.yaml`
   - Reads `folder_map` location from config
   - Loads `/docs/folder-map.yaml` into memory

2. **Document Type Detection**
   - Workflow identifies document type (e.g., `prd`, `epic`, `story`)
   - Looks up type in folder_map mappings

3. **Path Resolution**
   - Finds correct destination folder from mapping
   - Resolves any path variables (`{project-root}`, `{epic-folder}`)
   - Applies naming conventions

4. **Output Creation**
   - Creates directory if it doesn't exist
   - Writes document to resolved path
   - Follows nested structure rules (e.g., stories inside epics)

## Document Type Mappings

| Document Type | Destination Folder | Example |
|---------------|-------------------|---------|
| `brainstorming_output` | `00-Vision-Exploration/` | `brainstorm-session-2025-10.md` |
| `product_brief` | `01-Product-Requirements/briefs/` | `product-brief-procurement.md` |
| `prd` | `01-Product-Requirements/prds/` | `prd-workflow-automation.md` |
| `adr` | `02-Architecture/decisions/` | `adr-001-database-choice.md` |
| `architecture_diagram` | `02-Architecture/diagrams/` | `c4-context-diagram.md` |
| `tech_spec` | `03-Technical-Specifications/` | `tech-spec-api-v1.md` |
| `epic` | `04-Development/epics/epic-###-name/` | `epic-001-auth/epic-001-auth.md` |
| `story` | `04-Development/epics/epic-###-name/stories/` | `story-001-login.md` |
| `test_plan` | `05-Testing/test-plans/` | `test-plan-authentication.md` |
| `wireframe` | `06-UX/wireframes/` | `wireframe-dashboard.png` |
| `mockup` | `06-UX/mockups/` | `mockup-login-screen.fig` |

## Workflow-Specific Routing

### BMM Module Workflows

```yaml
/bmad:bmm:workflows:product-brief    → 01-Product-Requirements/briefs/
/bmad:bmm:workflows:prd              → 01-Product-Requirements/prds/
/bmad:bmm:workflows:architecture     → 02-Architecture/decisions/
/bmad:bmm:workflows:tech-spec        → 03-Technical-Specifications/
/bmad:bmm:workflows:create-story     → 04-Development/epics/{epic}/stories/
/bmad:bmm:workflows:sprint-planning  → 04-Development/status/
/bmad:bmm:workflows:retrospective    → 09-Retrospectives/
```

### CIS Module Workflows

```yaml
/bmad:cis:workflows:brainstorming       → 00-Vision-Exploration/
/bmad:cis:workflows:design-thinking     → 00-Vision-Exploration/
/bmad:cis:workflows:innovation-strategy → 00-Vision-Exploration/
```

## Special Routing Rules

### Epic-Story Nesting

**Epic creation:**
```
Input: epic_id=001, epic_name=user-authentication
Output: 04-Development/epics/epic-001-user-authentication/
        └── epic-001-user-authentication.md
        └── stories/ (subfolder created)
```

**Story creation:**
```
Input: story_id=001, story_name=login-page, parent_epic=epic-001-user-authentication
Output: 04-Development/epics/epic-001-user-authentication/stories/
        └── story-001-login-page.md
```

### Sprint Folders

```
Input: sprint_number=01
Output: 04-Development/sprints/sprint-01/
```

### Status Files

Fixed location:
```
04-Development/status/sprint-status.yaml
```

## Naming Conventions

### Epics
- **Folder:** `epic-{###}-{descriptive-name}` (3-digit zero-padded)
- **File:** `epic-{###}-{descriptive-name}.md` (matches folder)
- **Example:** `epic-001-user-authentication/epic-001-user-authentication.md`

### Stories
- **File:** `story-{###}-{descriptive-name}.md`
- **Numbering:** Global across all epics
- **Example:** `story-042-password-reset-flow.md`

### ADRs (Architecture Decision Records)
- **File:** `adr-{###}-{decision-title}.md`
- **Example:** `adr-001-database-selection.md`

### Sprints
- **Folder:** `sprint-{##}` (2-digit zero-padded)
- **Example:** `sprint-01`, `sprint-02`

## Verification

To verify agent routing is working:

1. **Check folder_map loads:**
   ```bash
   cat /home/iamtyroon/Projects/Procureline/docs/folder-map.yaml
   ```

2. **Verify config references:**
   ```bash
   grep folder_map /home/iamtyroon/Projects/Procureline/bmad/core/config.yaml
   ```

3. **Test with workflow:**
   - Run any BMM workflow (e.g., `/bmad:bmm:workflows:product-brief`)
   - Check document appears in correct folder
   - Verify naming convention followed

## Troubleshooting

### Document Not Routing Correctly

1. Check document_type is specified in workflow YAML
2. Verify document_type exists in folder_map.yaml mappings
3. Ensure workflow engine loaded folder_map (check step 1a, phase 2)

### Folder Not Created

1. Verify output_folder in core config is correct
2. Check file permissions in docs/ directory
3. Ensure workflow has create directory step

### Wrong Naming Convention

1. Check folder_map.yaml naming_conventions section
2. Verify workflow applies correct pattern
3. Review example outputs in folder_map

## Adding New Document Types

To add a new document type routing:

1. Edit `docs/folder-map.yaml`
2. Add type to appropriate phase mapping
3. Add workflow output mapping if needed
4. Update this guide with new type
5. Test with actual workflow

**Example:**
```yaml
# In folder-map.yaml under requirements.subfolders.research.types:
- competitor_analysis
- user_survey_results
```

## Related Documentation

- **Folder Structure:** See README.md in each phase folder
- **BMAD Workflows:** `/bmad/_cfg/workflow-manifest.csv`
- **Configuration:** `/bmad/core/config.yaml`
- **Workflow Engine:** `/bmad/core/tasks/workflow.xml`
