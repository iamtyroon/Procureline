---
title: "Procureline Vault - Navigation Guide"
document-type: "navigation-guide"
project: "Procureline"

# Guide Metadata
guide-type: "vault-readme"
guide-scope: "complete-vault-navigation"
target-audience: "all-team-members"

# Vault Stats
total-documents: "71"
prototypes: 13
screen-designs: 13
validated-components: 30

# Dates
created: "2025-10-03"
last-updated: "2025-10-16-screen4-enhancement"

# Classification
tags:
  - vault-meta
  - navigation
  - readme
  - onboarding

# Cross-References
related:
  - "[[tag-index]]"
  - "[[quick-reference-guide]]"
  - "[[vault-index]]"
---

# 📘 Procureline Documentation Vault

**Welcome to the Procureline University Procurement Platform documentation vault!**

This README provides complete navigation guidance for developers, designers, product managers, and stakeholders.

---

## 🎯 **Quick Start: What You Need to Know**

### **What is Procureline?**

Procureline is a **multi-tenant SaaS procurement platform** for African universities, featuring:
- **4-layer hierarchical authentication** (Platform → University → Procurement Officer → Department)
- **Visual Blockly-based** procurement plan creation (inspired by Scratch)
- **Excel integration** for government procurement submissions
- **87% component reuse** across validated design system

### **Current Status**

✅ **14 production-ready prototypes** across 4 user pipelines
✅ **Procurement Officer pipeline complete** (5 screens, 10/10 quality)
✅ **Screen 4 PO Blockly NEW PRODUCTION VERSION** (October 2025 - Major Enhancement)
  - 3-tier collapsible blocks, SheetJS Excel export, 5 realistic departments (103.5M KES)
  - Modal-based UX, toast notifications, timing block system, government compliance
✅ **Departmental User pipeline complete** (5 screens, 10/10 quality)
✅ **Procureline Admin pipeline complete** (2 screens)
✅ **Tenant Admin pipeline complete** (2 screens, 95% component reuse)
✅ **Immutable design system** validated through production implementation
✅ **30+ reusable components** cataloged and documented

---

## 🎓 **New to the Vault?**

**Start Here**: **[[getting-started-guide]]**

The comprehensive onboarding guide will take you from zero to productive in 2-4 hours.

**Quick Start (15 minutes)**:
1. Read **[[Procureline-Project-Brief]]**
2. Review **[[procureline-design-dna-standards]]**
3. View `.superdesign/design_iterations/screen-1-po-dashboard.html`

**Certification**: Complete the certification checklist in the Getting Started Guide to validate your vault proficiency.

---

## 🔍 **How to Find Information**

### **Method 1: Tag-Based Search**

Use [[tag-index]] to find documents by category (67 controlled tags in 10 categories).

**Examples**:
- Find all dashboard screens → Search "dashboard" tag → 4 results
- Find all architecture decisions → Search "architecture" + "decision-record" → 9 ADRs
- Find all BMad sessions → Search "bmad-party-mode" → 15 session logs

### **Method 2: Quick Reference Tables**

Use [[quick-reference-guide]] for instant lookups:
- All 13 screens with prototypes
- All 9 ADRs with status
- All session logs with deliverables
- Component reuse metrics

### **Method 3: Vault Index**

Use [[vault-index]] for complete file directory (59+ files organized by folder).

---

## 🚀 **Golden Paths: How to Navigate by Role**

### **👨‍💻 For Frontend Developers**

**Start Here**:
1. [[procureline-design-dna-standards]] - Immutable design rules
2. [[component-catalog]] - 30+ reusable components
3. `06-UX/02-Screen-Designs/` - 13 production-ready specs

**Workflow**: Design DNA → Components → Screen Docs → Prototypes → Implement

---

### **🎨 For UX/UI Designers**

**Start Here**:
1. [[procureline-design-dna-standards]] - IMMUTABLE foundation (MUST READ)
2. [[component-catalog]] - 30+ validated components
3. [[design-iterations-file-index]] - Design evolution

**Design Governance**:
- ⚠️ Design DNA is IMMUTABLE
- ✅ 87% component reuse target
- ✅ 6 validation checkpoints for new screens

---

### **📊 For Product Managers**

**Start Here**:
1. [[Procureline-Project-Brief]] - Complete vision
2. [[po-pipeline-completion-update]] - PO pipeline (COMPLETE)
3. [[departmental-user-pipeline-design-plan]] - DU pipeline (COMPLETE)

**Pipeline Status**:
- ✅ Procurement Officer: 5 screens
- ✅ Departmental User: 4 screens
- ✅ Procureline Admin: 2 screens
- ⏸️ Tenant Admin: 1 screen (1 eliminated)

---

### **🏗️ For Backend Engineers**

**Start Here**:
1. [[webapp-architecture-vision]] - Complete architecture
2. [[adr-index]] - 9 architecture decisions
3. [[technical-requirements-quick-reference]] - API/database specs

**Critical ADRs**:
- ADR-001: Multi-tenant SaaS architecture
- ADR-002: 4-layer authentication
- ADR-005: Excel import/export

---

## 📚 **Core Documentation Categories**

### **1. Screen Design Documentation** (13 files)

Location: `06-UX/02-Screen-Designs/[Pipeline]/`

**Procurement Officer Pipeline** (5 screens):
- Screen 0.5: Login
- Screen 1: Dashboard (9 bento boxes)
- Screen 2: Department Management
- Screen 3: Category Management
- Screen 4: Blockly Consolidation

**Departmental User Pipeline** (5 screens):
- Screen 0: Signup
- Screen 0.5: Login
- Screen 1: Dashboard (12 components with gamification)
- Screen 2: Blockly Editor + Request Sidebar
- Screen 3: Plan Review & Communication

**Admin Pipelines** (4 screens):
- Procureline Admin: Login, Dashboard
- Tenant Admin: Login, Dashboard

---

### **2. Design System Documentation**

**Immutable Standards**:
- [[procureline-design-dna-standards]] - Official theme (LOCKED)
- [[component-catalog]] - 30+ validated components

**Key Design Principles**:
```css
/* IMMUTABLE COLOR (OKLCH) */
--primary: oklch(0.6916 0.1692 154.0327);  /* Signature green */

/* IMMUTABLE TYPOGRAPHY (Inter) */
H1: Inter 700, 48px/56px
Body: Inter 400, 14px/22px

/* IMMUTABLE ANIMATION */
--duration-base: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

### **3. Architecture Documentation**

**Technical Foundation**:
- [[webapp-architecture-vision]] - Complete architecture
- [[adr-index]] - 9 critical decisions
- [[saas-architecture-validation-feasibility]] - Feasibility analysis

**Key Decisions**:
1. Multi-Tenant SaaS (ADR-001)
2. 4-Layer Auth (ADR-002)
3. Blockly Integration (ADR-003)
4. Bento Box Pattern (ADR-004)
5. Excel Integration (ADR-005)

---

### **4. Interactive Prototypes** (13 files)

Location: `.superdesign/design_iterations/`

**Production-Ready HTML Prototypes**:
- All login screens (4)
- All dashboards (4)
- Department/Category management (2)
- Blockly editors (2)
- Plan review/communication (1)

**How to View**: Open any `.html` file in browser (no build needed)

---

## 📊 **Vault Statistics**

### **Documentation Health**
- Total Documents: 71 markdown files
- Screen Designs: 13 production-ready
- Prototypes: 13 interactive HTML
- Session Logs: 15+ BMad sessions
- ADRs: 9 architecture decisions
- Components: 30+ validated

### **Quality Metrics**
- 10/10 Quality Screens: 13
- Component Reuse: 87% average
- Validated Designs: 13
- BMad Approved: 13

### **Pipeline Completion**
- ✅ Procurement Officer: 100% (5/5)
- ✅ Departmental User: 100% (5/5)
- ✅ Procureline Admin: 100% (2/2)
- ✅ Tenant Admin: 100% (2/2)

---

## 🔗 **Essential Links**

### **Getting Started**
- [[Procureline-Project-Brief]] - Project overview
- [[tag-index]] - Find by tag (67 tags)
- [[quick-reference-guide]] - Fast lookups
- [[vault-index]] - Complete directory

### **Design Resources**
- [[procureline-design-dna-standards]] - Immutable foundation
- [[component-catalog]] - 30+ components
- [[design-iterations-file-index]] - Design evolution
- [[prototype-documentation-map]] - Prototype↔Doc links

### **Architecture Resources**
- [[webapp-architecture-vision]] - Technical architecture
- [[adr-index]] - 9 decisions
- [[technical-requirements-quick-reference]] - API/DB specs

### **Product Resources**
- [[stakeholder-analysis-user-stories]] - 50+ user stories
- [[po-pipeline-completion-update]] - PO pipeline
- [[departmental-user-pipeline-design-plan]] - DU pipeline

---

## ❓ **FAQ**

**Q: Where do I start if I'm new?**
A: Read in order:
1. [[Procureline-Project-Brief]] (5 min)
2. [[webapp-architecture-vision]] (15 min)
3. [[procureline-design-dna-standards]] (10 min)
4. [[screen-1-po-dashboard-design-complete]] (10 min)

**Q: How do I find Blockly documents?**
A: Check [[tag-index]], search `blockly` → 2 screens + ADR-003 + session logs

**Q: Can I change the primary green color?**
A: NO. Design DNA is immutable (see governance in design-dna-standards)

**Q: Where are API specifications?**
A: [[technical-requirements-quick-reference]] has complete API/database specs

---

**Welcome to Procureline! 🚀**

*This vault represents 13 production-ready prototypes with 87% component reuse across an immutable design system, documented through 15+ BMad Party Mode collaborative sessions. All 4 user pipelines are now 100% complete with comprehensive design specifications.*
