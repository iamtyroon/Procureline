---
title: "Tag Index - Complete Taxonomy"
document-type: "vault-index"
project: "Procureline"

# Index Metadata
index-type: "tag-index"
index-scope: "entire-vault"
total-tags: 67
tag-categories: 10

# Maintenance
update-frequency: "after-major-changes"
auto-generated: false

# Dates
created: "2025-10-05"
last-updated: "2025-10-05"

# Classification
tags:
  - vault-meta
  - navigation
  - index
  - tag-taxonomy

# Cross-References
related:
  - "[[README]]"
  - "[[quick-reference-guide]]"
  - "[[vault-index]]"
---

# Procureline Vault Tag Index

**Purpose**: Complete hierarchical taxonomy of all tags used across the Procureline documentation vault

**Total Tags**: 67 controlled vocabulary tags
**Tag Categories**: 10 primary categories
**Tag Format**: `kebab-case` following `category/subcategory/tag` structure

---

## 🏷️ Tag Taxonomy

### **1. Document Type Tags** (10 tags)

Primary classification for document types:

- `screen-design` (13 uses) - Screen design documentation
- `architecture-decision-record` (1 use) - ADR index and decisions
- `session-log` (15 uses) - BMad session logs
- `pipeline-completion` (1 use) - Pipeline completion updates
- `pipeline-design-plan` (1 use) - Pipeline design plans
- `research-analysis` (1 use) - University and market research
- `design-system` (2 uses) - Design DNA and component catalog
- `vault-index` (4 uses) - Navigation and index files
- `navigation-guide` (2 uses) - README and quick reference
- `project-brief` (1 use) - Project overview and brief

**Usage Pattern**: Every document should have exactly one document-type tag

---

### **2. Pipeline Tags** (4 tags)

User role and pipeline identification:

- `procureline-admin` (2 uses) - Layer 1 platform management
- `tenant-admin` (2 uses) - Layer 2 university administration
- `procurement-officer` (5 uses) - Layer 3 central procurement
- `departmental-user` (4 uses) - Layer 4 department planning

**Usage Pattern**: Screen designs and pipeline-specific docs use pipeline tags

**Cross-Reference**: See [[webapp-architecture-vision|4-Layer Authentication]] for role definitions

---

### **3. Status Tags** (8 tags)

Document and component status tracking:

- `production-ready` (13 uses) - Validated for implementation
- `complete` (9 uses) - Design/documentation finished
- `in-progress` (2 uses) - Active development
- `prototype` (0 uses) - Concept/early stage
- `concept` (0 uses) - Ideation phase
- `validated` (11 uses) - User/technical validation complete
- `archived` (1 use) - Historical/deprecated content
- `deprecated` (0 uses) - Superseded content

**Usage Pattern**: Screen designs typically have both `production-ready` and `validated`

---

### **4. Quality Tags** (5 tags)

Quality assurance and validation markers:

- `10-out-of-10` (13 uses) - Achieved 10/10 quality rating
- `validated` (11 uses) - Validation completed
- `bmad-approved` (14 uses) - BMad design approval
- `user-tested` (2 uses) - User testing conducted
- `needs-review` (0 uses) - Pending quality review

**Usage Pattern**: Production screens should have `validated` + `bmad-approved`

---

### **5. Component Tags** (7 tags)

Reusable component identification:

- `bento-box` (4 uses) - Bento box dashboard layout
- `blockly-editor` (2 uses) - Blockly visual programming
- `dashboard` (6 uses) - Dashboard screens
- `authentication` (3 uses) - Login and auth screens
- `navigation` (5 uses) - Navigation patterns
- `data-table` (2 uses) - Data table components
- `form-system` (3 uses) - Form components

**Cross-Reference**: See [[component-catalog]] for full component documentation

---

### **6. Impact Tags** (6 tags)

Change impact assessment:

- `impact/high` (4 uses) - High impact decisions/changes
- `impact/medium` (3 uses) - Medium impact changes
- `impact/low` (2 uses) - Low impact changes
- `breaking-change` (0 uses) - Breaking changes
- `enhancement` (1 use) - Feature enhancements
- `bugfix` (0 uses) - Bug fixes

**Usage Pattern**: Primarily used in ADRs and technical decisions

---

### **7. Architecture Tags** (6 tags)

Technical architecture markers:

- `multi-tenant` (3 uses) - Multi-tenant SaaS architecture
- `authentication` (3 uses) - Authentication systems
- `data-model` (1 use) - Data modeling
- `integration` (2 uses) - System integrations
- `security` (1 use) - Security architecture
- `performance` (1 use) - Performance considerations

**Cross-Reference**: See [[adr-index]] for architecture decisions

---

### **8. Session Tags** (5 tags)

Session type and format markers:

- `bmad-party-mode` (15 uses) - Multi-agent BMad sessions
- `solo-design` (0 uses) - Individual design work
- `research-session` (1 use) - Research-focused sessions
- `refactoring-session` (0 uses) - Code/doc refactoring
- `validation-session` (0 uses) - Validation-focused sessions

**Usage Pattern**: All current sessions use `bmad-party-mode` (collaborative agent approach)

---

### **9. Design Tags** (6 tags)

Design system and visual identity:

- `immutable` (2 uses) - Immutable design standards
- `design-dna` (2 uses) - Core design DNA
- `component-library` (2 uses) - Component catalog
- `visual-identity` (1 use) - Brand/visual identity
- `interaction-pattern` (1 use) - Interaction patterns
- `87-percent-reuse` (1 use) - 87% component reuse achievement

**Cross-Reference**: See [[procureline-design-dna-standards]] for immutable design rules

---

### **10. Vault Meta Tags** (5 tags)

Vault structure and navigation:

- `vault-meta` (6 uses) - Vault structure documents
- `navigation` (3 uses) - Navigation aids
- `index` (4 uses) - Index documents
- `golden-path` (1 use) - Recommended learning path
- `quick-reference` (2 uses) - Quick reference guides

**Usage Pattern**: Used for vault organization and discovery documents

---

## 📊 Tag Usage Statistics

### **Most Used Tags** (10+ uses):
1. `screen-design` (13 uses)
2. `bmad-party-mode` (15 uses)
3. `session-log` (15 uses)
4. `production-ready` (13 uses)
5. `validated` (11 uses)
6. `bmad-approved` (14 uses)
7. `10-out-of-10` (13 uses)

### **Pipeline Distribution**:
- **Procurement Officer**: 5 screens (most documented pipeline)
- **Departmental User**: 4 screens (complete pipeline)
- **Tenant Admin**: 2 screens (1 eliminated, 1 active)
- **Procureline Admin**: 2 screens (platform management)

### **Quality Metrics**:
- **10/10 Quality Screens**: 13 screens
- **Validated Designs**: 11 documents
- **BMad Approved**: 14 documents
- **Production Ready**: 13 screens

---

## 🔍 Tag Search Examples

### **Find All Procurement Officer Screens**:
Search for: `procurement-officer` + `screen-design`
**Result**: 5 screens (Login, Dashboard, Dept Mgmt, Category Mgmt, Blockly Consolidation)

### **Find All BMad Party Mode Sessions**:
Search for: `bmad-party-mode` + `session-log`
**Result**: 15 session logs

### **Find All Production-Ready Dashboards**:
Search for: `dashboard` + `production-ready`
**Result**: 4 dashboards (Admin, Tenant Admin, PO, DU)

### **Find All Architecture Decisions**:
Search for: `architecture` + `decision-record`
**Result**: 9 ADRs in adr-index.md

### **Find Immutable Design Standards**:
Search for: `immutable` + `design-system`
**Result**: Design DNA standards + Component catalog

---

## 📝 Tag Application Guidelines

### **Required Tags for Screen Designs**:
```yaml
tags:
  - screen-design                    # Document type
  - pipeline/[role]                  # Pipeline identifier
  - production-ready                 # Status
  - validated                        # Quality marker
  - bmad-approved                    # Approval marker
  - [component-tags]                 # Components used
```

### **Required Tags for Session Logs**:
```yaml
tags:
  - session-log                      # Document type
  - bmad-party-mode                  # Session type
  - screen-design                    # Focus area
  - [pipeline-tag]                   # Pipeline if screen-specific
  - [screen-specific-tag]            # Component/feature tags
```

### **Required Tags for Architecture Docs**:
```yaml
tags:
  - architecture                     # Category
  - [specific-architecture-tag]      # multi-tenant, authentication, etc.
  - impact/[level]                   # Impact assessment
  - validated                        # Validation status
```

---

## 🔗 Related Documentation

**Vault Navigation**:
- [[README]] - Vault overview and entry points
- [[quick-reference-guide]] - Fast lookup tables
- [[vault-index]] - Complete file directory

**Design System**:
- [[procureline-design-dna-standards]] - Immutable design rules
- [[component-catalog]] - 30+ reusable components
- [[adr-index]] - 9 architecture decisions

**Pipelines**:
- [[po-pipeline-completion-update]] - Procurement Officer pipeline (complete)
- [[departmental-user-pipeline-design-plan]] - Departmental User pipeline (complete)

---

## 📈 Tag Evolution Guidelines

### **Adding New Tags**:
1. Verify tag doesn't already exist with similar meaning
2. Follow `kebab-case` naming convention
3. Place in appropriate category (1-10 above)
4. Update this index with new tag entry
5. Document usage pattern and cross-references

### **Deprecating Tags**:
1. Mark as `(deprecated)` in index
2. Document replacement tag
3. Provide migration path in related docs
4. Keep deprecated entry for 1 version cycle

### **Tag Governance**:
- Tags controlled through this central index
- No ad-hoc tag creation without index update
- Quarterly review of tag usage and consolidation
- Maintain controlled vocabulary (no synonyms)

---

*Tag index maintained by BMad Design Team - Procureline University Procurement Platform*
*Last comprehensive audit: October 5, 2025*
