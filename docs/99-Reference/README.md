# 99-Reference

## Purpose

This folder contains reference materials, standards, templates, and glossaries that support all other phases. These are living documents that evolve throughout the project lifecycle.

## Folder Structure

```
99-Reference/
├── glossary/          # Terms and definitions
├── standards/         # Coding standards, conventions
└── templates/         # Document templates
```

## Subfolders

### `glossary/`
**Terminology and Definitions** - Shared vocabulary for the project.

**Contains:**
- Business domain glossary
- Technical terminology
- Acronym definitions
- Ubiquitous language (DDD)

**Example:** `glossary-procurement-terms.md`, `glossary-technical-acronyms.md`

### `standards/`
**Standards and Conventions** - Team agreements on how work should be done.

**Contains:**
- Coding standards
- Git commit conventions
- Documentation standards
- Code review guidelines
- Definition of Done (DoD)
- Definition of Ready (DoR)

**Example:** `standard-typescript-coding.md`, `standard-git-commits.md`

### `templates/`
**Document Templates** - Reusable templates for consistent documentation.

**Contains:**
- PRD templates
- ADR templates
- Test plan templates
- Runbook templates
- User story templates

**Example:** `template-prd.md`, `template-adr.md`, `template-user-story.md`

## BMAD Workflows That Output Here

- `/bmad:bmb:workflows:module-brief` → `templates/`
- `/bmad:bmb:workflows:create-workflow` → `templates/`
- `/bmad:bmb:workflows:create-agent` → `templates/`

## Document Types

| Subfolder | Type | Description | Example |
|-----------|------|-------------|---------|
| glossary/ | Domain Glossary | Business terms | `glossary-procurement.md` |
| glossary/ | Technical Glossary | Tech terminology | `glossary-architecture.md` |
| standards/ | Coding Standard | Language-specific rules | `standard-python-pep8.md` |
| standards/ | Process Standard | Workflow conventions | `standard-code-review.md` |
| templates/ | Document Template | Reusable doc structure | `template-test-plan.md` |

## Reference Lifecycle

1. **Creation**: Standards emerge from team practices
2. **Agreement**: Team reviews and agrees to standards
3. **Documentation**: Standards formally documented
4. **Adoption**: Team follows documented standards
5. **Evolution**: Standards updated based on learnings
6. **Enforcement**: Code reviews and automation enforce standards

## Key Principles

- **Living Documents**: Reference materials evolve continuously
- **Team Ownership**: Standards created by team, not imposed
- **Practical**: Standards must be realistic and enforceable
- **Accessible**: Easy to find and understand
- **Enforced**: Automated where possible (linters, CI checks)

## Using Templates

1. Copy template from `templates/` folder
2. Save to appropriate phase folder with proper naming
3. Fill in all required sections
4. Remove template instructions and examples
5. Have document reviewed per standards

## Related Folders

- **All Phases**: Reference materials support every folder
- **Architecture**: `02-Architecture/patterns/` - Architectural standards
- **Retrospectives**: `09-Retrospectives/` - Learnings inform standards
