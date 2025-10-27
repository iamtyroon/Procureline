# 02-Architecture

## Purpose

This folder defines the **how** - the technical architecture, system design, and foundational technology decisions that enable the product requirements.

## Folder Structure

```
02-Architecture/
├── decisions/         # Architecture Decision Records (ADRs)
├── diagrams/          # System diagrams, C4 models
└── patterns/          # Design patterns, conventions
```

## Subfolders

### `decisions/`
**Architecture Decision Records (ADRs)** - Formal documentation of significant architectural choices.

**Contains:**
- Individual ADR documents following standard format
- Technology selection justifications
- Trade-off analysis
- Consequences and implications

**Naming:** `adr-###-decision-title.md`

**Example:** `adr-001-database-selection-postgresql.md`

**Template Structure:**
- Status: Proposed/Accepted/Deprecated/Superseded
- Context: What situation prompted this decision
- Decision: What was decided
- Consequences: What results from this decision
- Alternatives Considered: What else was evaluated

### `diagrams/`
**System Architecture Diagrams** - Visual representations of system structure.

**Contains:**
- C4 model diagrams (Context, Container, Component, Code)
- Entity-Relationship Diagrams (ERDs)
- Sequence diagrams
- Deployment diagrams
- Network topology diagrams

**Formats:** `.md` (Mermaid), `.svg`, `.png`, `.drawio`

**Example:** `c4-context-diagram.md`, `erd-procurement-schema.png`

### `patterns/`
**Design Patterns and Conventions** - Reusable architectural patterns and coding standards.

**Contains:**
- Design pattern implementations
- Architectural patterns (microservices, event-driven, etc.)
- API design conventions
- Code organization standards

**Example:** `pattern-repository-pattern.md`, `api-rest-conventions.md`

## BMAD Workflows That Output Here

- `/bmad:bmm:workflows:architecture` → `decisions/`
- `/bmad:bmm:agents:architect` → `decisions/`, `diagrams/`
- `/bmad:bmb:workflows:document-project` → `patterns/`

## Document Lifecycle

1. **Proposal**: ADRs start as proposals with context
2. **Review**: Technical team reviews and discusses
3. **Acceptance**: Decision is accepted or rejected
4. **Implementation**: Accepted decisions guide development
5. **Evolution**: Superseded ADRs remain for historical context

## Key Principles

- **Immutability**: ADRs are never deleted, only superseded
- **Traceability**: Decisions link to requirements and stories
- **Justification**: Every decision documents "why"
- **Consequences**: Both positive and negative impacts documented

## Related Folders

- **Previous Phase**: `01-Product-Requirements/` - Requirements drive architecture
- **Next Phase**: `03-Technical-Specifications/` - Architecture guides detailed specs
- **Implementation**: `04-Development/` - Architecture decisions referenced in stories
- **Deployment**: `07-Deployment/` - Deployment implements architectural choices
