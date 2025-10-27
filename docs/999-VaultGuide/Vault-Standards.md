---
document-type: Standardization Guide
category: Vault Maintenance
created: 2025-10-02
last-updated: 2025-10-02
status: active
applies-to: All Documentation
tags:
  - standards
  - obsidian
  - vault-maintenance
  - best-practices
related:
  - "[[vault-index]]"
  - "[[vault-health-dashboard]]"
---

# Procureline Obsidian Vault - Standards & Best Practices

**Purpose**: Define and maintain Obsidian best practices for the Procureline documentation vault
**Applies To**: All markdown files (.md) in the vault
**Enforcement**: Manual review + automated checks (planned)
**Last Review**: October 2, 2025

---

## 🎯 **CORE STANDARDS**

### 1. **YAML Frontmatter** (REQUIRED for all files)

Every markdown file MUST begin with YAML frontmatter enclosed in `---` delimiters.

#### **Minimum Required Fields**:
```yaml
---
document-type: [README|Design Document|Session Log|Architecture|etc.]
last-updated: YYYY-MM-DD
status: [active|complete|archived|draft]
tags:
  - tag1
  - tag2
---
```

#### **Screen Design Frontmatter Template**:
```yaml
---
project: Procureline
pipeline: [Admin|Tenant Admin|Procurement Officer|Departmental User]
screen: Screen [Number]
screen-name: [Display Name]
design-date: YYYY-MM-DD
status: [complete|in-progress|draft]
quality-rating: [X/10]
design-system: Procureline DNA
architecture: [Bento Box|3-Panel Layout|etc.]
implementation-file: [filename.html]
implementation-status: [production-ready|in-progress|planned]
tags:
  - screen-design
  - [pipeline-tag]
  - [feature-tags]
related:
  - "[[linked-document-1]]"
  - "[[linked-document-2]]"
---
```

#### **Session Log Frontmatter Template**:
```yaml
---
project: Procureline
session-type: [BMad Party Mode|Solo Design|Collaborative]
session-date: YYYY-MM-DD
pipeline: [Pipeline Name]
screen: [Screen Number]
deliverables:
  - [Deliverable 1]
  - [Deliverable 2]
status: [complete-success|in-progress|archived]
participants:
  - [Participant 1]
  - [Participant 2]
tags:
  - bmad-session
  - [specific-tags]
related:
  - "[[design-document]]"
  - "[[related-logs]]"
---
```

---

## 📝 **WIKI-LINK STANDARDS**

### 2. **Link Syntax** (REQUIRED)

#### **✅ CORRECT**:
- `[[filename]]` - Basic wiki-link
- `[[filename|Display Text]]` - Wiki-link with custom display
- Use exact filename (without .md extension)
- Use lowercase kebab-case for filenames

#### **❌ INCORRECT**:
- `[filename](filename.md)` - Markdown links (avoid unless external)
- `[[Filename With Spaces]]` - Use kebab-case instead
- `[[file-name.md]]` - Don't include .md extension

### 3. **Link Verification**

Before publishing changes:
1. ✅ All wiki-links must reference existing files
2. ✅ Use exact filename matching (case-sensitive)
3. ✅ Verify links in Obsidian's graph view
4. ✅ Check for broken links monthly

---

## 🏷️ **TAG STANDARDS**

### 4. **Tag Taxonomy**

#### **Document Type Tags**:
- `#screen-design` - Interface design specifications
- `#bmad-session` - Session logs and collaboration docs
- `#architecture` - System architecture documents
- `#prd` - Product requirements
- `#research` - Market/technical research

#### **Pipeline Tags**:
- `#admin` - Procureline Admin pipeline
- `#tenant-admin` - Tenant Admin pipeline
- `#procurement-officer` - PO pipeline
- `#departmental-user` - DU pipeline

#### **Status Tags**:
- `#design-complete` - Finalized designs
- `#production-ready` - Ready for implementation
- `#in-progress` - Active development
- `#archived` - Historical documents

#### **Feature Tags**:
- `#blockly-integration` - Google Blockly features
- `#bento-architecture` - Bento box layouts
- `#gamification` - Gamification features
- `#real-time-chat` - Real-time communication
- `#visual-programming` - Visual programming interfaces

### 5. **Tag Formatting**

- ✅ Use `#kebab-case` format
- ✅ Place in frontmatter YAML array
- ✅ Also inline tags where contextually relevant
- ❌ Avoid `#CamelCase` or `#snake_case`

---

## 📅 **DATE STANDARDS**

### 6. **Date Format** (REQUIRED: ISO 8601)

**Standard**: `YYYY-MM-DD`

#### **✅ CORRECT**:
- `2025-10-02`
- `2025-01-15`

#### **❌ INCORRECT**:
- `October 2, 2025`
- `10/2/2025`
- `02-10-2025`

---

## 🗂️ **FILE ORGANIZATION**

### 7. **Folder Structure**

```
procureline obsidian docs/
├── 01-Product/           # Product requirements, stakeholder analysis
├── 02-Architecture/      # System design, technical specs
├── 06-UX/
│   ├── Research Bible/   # UI/UX research foundation
│   ├── Design System/    # Visual identity standards
│   └── Screen Designs/   # Interface designs by pipeline
│       ├── 01-Procureline Admin/
│       ├── 02-Tenant Admin/
│       ├── 03-Procurement Officer/
│       └── 04-Departmental User/
└── 08-Research/
    ├── University Analysis/
    ├── Market Analysis/
    └── Project Logs/     # Session logs, timelines
```

### 8. **File Naming Conventions**

#### **Screen Designs**:
- Pattern: `screen-[number]-[pipeline-abbrev]-[function].md`
- Examples:
  - `screen-1-du-dashboard-design-complete.md`
  - `screen-3-po-category-management-design-complete.md`

#### **Session Logs**:
- Pattern: `bmad-session-log-[screen]-[pipeline]-[function].md`
- Examples:
  - `bmad-session-log-screen-1-du-dashboard-implementation.md`
  - `bmad-session-log-screen-3-du-plan-review-communication.md`

#### **Architecture Documents**:
- Pattern: `[topic]-[type].md`
- Examples:
  - `technical-requirements-quick-reference.md`
  - `blockly-integration-strategy.md`

---

## 🔗 **CROSS-REFERENCE STANDARDS**

### 9. **Bidirectional Linking**

Every document should link to related documents AND be linked from them.

#### **Screen Design → Session Log**:
```yaml
# In screen-1-du-dashboard-design-complete.md
related:
  - "[[bmad-session-log-screen-1-du-dashboard-implementation]]"
```

#### **Session Log → Screen Design**:
```yaml
# In bmad-session-log-screen-1-du-dashboard-implementation.md
related:
  - "[[screen-1-du-dashboard-design-complete]]"
```

### 10. **Pipeline Progression Links**

Screens should link to predecessor and successor screens:

```yaml
# In screen-2-du-blockly-editor-design-complete.md
related:
  - "[[screen-1-du-dashboard-design-complete]]"  # Previous
  - "[[screen-3-du-plan-review-communication-design-complete]]"  # Next
  - "[[procureline-design-dna-standards]]"  # Design system
```

---

## 📊 **QUALITY STANDARDS**

### 11. **Document Completeness**

Every document MUST include:
- ✅ YAML frontmatter with all required fields
- ✅ Clear title (H1)
- ✅ Purpose/overview section
- ✅ Tags (both frontmatter and inline)
- ✅ Related documents links
- ✅ Last updated date

### 12. **Quality Metrics**

Target vault health metrics:
- **Link Integrity**: 100% valid wiki-links
- **Frontmatter Coverage**: 100% of files
- **Cross-References**: 80%+ bidirectional links
- **Tag Coverage**: 100% properly tagged
- **Date Standardization**: 100% ISO 8601 format

---

## 🔧 **MAINTENANCE PROCEDURES**

### 13. **Monthly Vault Audit**

1. Run link checker (manual or automated)
2. Verify all frontmatter present
3. Check for orphaned documents (no incoming links)
4. Update vault-index.md with new files
5. Review tag taxonomy for new categories

### 14. **Pre-Commit Checklist**

Before committing changes:
- [ ] YAML frontmatter added/updated
- [ ] All wiki-links tested in Obsidian
- [ ] Dates in ISO 8601 format
- [ ] Tags follow taxonomy
- [ ] Related documents linked bidirectionally
- [ ] vault-index.md updated if new file
- [ ] File in correct folder per organization

---

## 📚 **REFERENCE DOCUMENTS**

### Key Vault Documents:
- [[vault-index]] - Complete vault file index
- [[README]] - Project overview and quick start
- [[design-iterations-file-index]] - Screen design file tracker
- [[procureline-design-dna-standards]] - Design system foundation
- [[vault-health-dashboard]] - Latest vault health metrics

### Obsidian Resources:
- [Obsidian Help - YAML Frontmatter](https://help.obsidian.md/Editing+and+formatting/Properties)
- [Obsidian Help - Internal Links](https://help.obsidian.md/Linking+notes+and+files/Internal+links)
- [Obsidian Help - Tags](https://help.obsidian.md/Editing+and+formatting/Tags)

---

## 📈 **VERSION HISTORY**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-02 | Initial standards document created after vault audit |

---

**Document Status**: ✅ **ACTIVE**
**Next Review**: 2025-11-02 (Monthly)
**Maintained By**: BMad Documentation Manager

---

*These standards ensure the Procureline Obsidian vault remains well-organized, searchable, and maintainable as the project scales.*
