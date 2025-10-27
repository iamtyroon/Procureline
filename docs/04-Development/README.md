# Development Documentation

This folder contains all development execution artifacts including epics, stories, sprint plans, and status tracking.

## Folder Structure

```
04-Development/
├── epics/                    # All epics with nested stories
│   └── epic-###-name/
│       ├── epic-###-name.md  # Epic document
│       └── stories/          # Stories belonging to this epic
│           └── story-###-name.md
│
├── sprints/                  # Sprint planning and execution
│   └── sprint-##/
│
└── status/                   # Status tracking files
    └── sprint-status.yaml
```

## Naming Conventions

### Epics
- **Folder**: `epic-###-descriptive-name/` (3-digit zero-padded number)
- **Document**: `epic-###-descriptive-name.md` (matches folder name)
- **Example**: `epic-001-user-authentication/epic-001-user-authentication.md`

### Stories
- **Location**: Within parent epic's `stories/` subfolder
- **Filename**: `story-###-descriptive-name.md` (global numbering across all epics)
- **Example**: `epic-001-user-authentication/stories/story-001-login-page.md`

### Sprints
- **Folder**: `sprint-##/` (2-digit zero-padded number)
- **Example**: `sprint-01/`, `sprint-02/`

## Workflow Integration

BMAD workflows automatically manage this structure:
- `/bmad:bmm:workflows:create-story` - Creates stories in appropriate epic folder
- `/bmad:bmm:workflows:dev-story` - Executes story development tasks
- `/bmad:bmm:workflows:sprint-planning` - Manages sprint status tracking

## Management Rules

1. **Epic Context**: Stories always live within their parent epic folder
2. **Global Story Numbers**: Story IDs increment globally (not per-epic)
3. **Sprint References**: Sprints reference stories by their full path
4. **Status Tracking**: `status/sprint-status.yaml` tracks story progression
5. **Immutability**: Once created, epic/story folders don't move between sprints

## Cross-References

- **Requirements**: Stories trace back to `01-Product-Requirements/`
- **Architecture**: Stories reference `02-Architecture/` decisions
- **Technical Specs**: Stories implement `03-Technical-Specifications/`
- **Testing**: Test cases in `05-Testing/` link to stories
