---
title: "Quick Reference Guide - Fast Lookups"
document-type: "quick-reference"
project: "Procureline"

# Guide Metadata
guide-type: "quick-reference"
guide-scope: "complete-vault-overview"
reference-tables: 7

# Dates
created: "2025-10-05"
last-updated: "2025-10-05"

# Classification
tags:
  - vault-meta
  - quick-reference
  - lookup-tables
  - navigation

# Cross-References
related:
  - "[[README]]"
  - "[[tag-index]]"
  - "[[vault-index]]"
---

# 📋 Procureline Quick Reference Guide

**Purpose**: Fast lookup tables for instant access to screens, ADRs, sessions, components, and key metrics.

**Use Case**: When you need specific information quickly without reading full documentation.

---

## 🖥️ **Screen Design Reference Table**

| # | Screen Name | Pipeline | Status | Prototype | Quality | Reuse % |
|---|-------------|----------|--------|-----------|---------|---------|
| 0 | Procureline Admin Login | Admin (L1) | ✅ Complete | screen-0-procureline-admin-login.html | 10/10 | 85% |
| 1 | Procureline Admin Dashboard | Admin (L1) | ✅ Complete | screen-1-procureline-admin-dashboard.html | 10/10 | 87% |
| 0 | Tenant Admin Login | Tenant Admin (L2) | ✅ Complete | screen-0-tenant-admin-login.html | 10/10 | 85% |
| 1 | Tenant Admin Dashboard | Tenant Admin (L2) | ✅ Complete | screen-1-tenant-admin-dashboard.html | 10/10 | 87% |
| 0.5 | PO Login | Procurement Officer (L3) | ✅ Complete | screen-0.5-po-login.html | 10/10 | 85% |
| 1 | PO Dashboard | Procurement Officer (L3) | ✅ Complete | screen-1-po-dashboard.html | 10/10 | 87% |
| 2 | Department Management | Procurement Officer (L3) | ✅ Complete | screen-2-po-department-management.html | 10/10 | 87% |
| 3 | Category Management | Procurement Officer (L3) | ✅ Complete | screen-3-po-category-management.html | 10/10 | 87% |
| 4 | Blockly Consolidation | Procurement Officer (L3) | ✅ Complete | screen-4-po-blockly-consolidation.html | 10/10 | 87% |
| 0.5 | DU Login | Departmental User (L4) | ✅ Complete | screen-0.5-du-login.html | 10/10 | 85% |
| 1 | DU Dashboard | Departmental User (L4) | ✅ Complete | screen-1-du-dashboard.html | 10/10 | 87% |
| 2 | DU Blockly Editor | Departmental User (L4) | ✅ Complete | screen-2-du-blockly-editor.html | 10/10 | 87% |
| 3 | Plan Review & Communication | Departmental User (L4) | ✅ Complete | screen-3-du-plan-review-communication.html | 10/10 | 87% |

**Total**: 13 production-ready screens
**Average Quality**: 10/10
**Average Component Reuse**: 87%

**Documentation Location**: `06-UX/02-Screen-Designs/[Pipeline]/screen-X-name-design-complete.md`
**Prototype Location**: `.superdesign/design_iterations/screen-X-name.html`

---

## 🏛️ **Architecture Decision Records (ADRs) Reference**

| ADR # | Title | Impact | Status | Date | Affected Pipelines |
|-------|-------|--------|--------|------|-------------------|
| 001 | Multi-Tenant SaaS Architecture | High | ✅ Accepted | 2025-09-15 | All Pipelines |
| 002 | 4-Layer Authentication System | High | ✅ Accepted | 2025-09-16 | All Pipelines |
| 003 | Blockly Visual Programming Integration | High | ✅ Accepted | 2025-09-17 | PO, DU |
| 004 | Bento Box Dashboard Pattern | High | ✅ Accepted | 2025-09-18 | All Pipelines |
| 005 | Excel Import/Export Integration | Medium | ✅ Accepted | 2025-09-19 | PO, DU |
| 006 | OKLCH Color System | Medium | ✅ Accepted | 2025-09-20 | All Pipelines |
| 007 | Inter Font Typography System | Medium | ✅ Accepted | 2025-09-20 | All Pipelines |
| 008 | 300ms Animation Timing Standard | Low | ✅ Accepted | 2025-09-21 | All Pipelines |
| 009 | 87% Component Reuse Target | High | ✅ Accepted | 2025-09-22 | All Pipelines |

**Total**: 9 ADRs (all accepted)
**High Impact**: 5 ADRs
**Medium Impact**: 3 ADRs
**Low Impact**: 1 ADR

**Documentation Location**: `02-Architecture/decisions/adr-index.md`

---

## 📝 **Session Logs Reference**

| Session Name | Date | Type | Duration | Focus | Deliverable |
|--------------|------|------|----------|-------|-------------|
| Screen 0 Implementation Failures | 2025-01-20 | Solo | 6 hrs | Login screens | Lessons learned |
| Screen 0.5 Design Redemption | 2025-01-22 | BMad Party | 4 hrs | Authentication | PO Login complete |
| Screen 1 PO Dashboard | 2025-01-23 | BMad Party | 4 hrs | Dashboard | PO Dashboard complete |
| Screen 1 DU Dashboard | 2025-01-23 | BMad Party | 3 hrs | Dashboard | DU Dashboard complete |
| Screen 2 Department Management | 2025-01-24 | BMad Party | 4 hrs | CRUD + budgets | Dept Mgmt complete |
| Screen 2 DU Blockly Editor | 2025-01-24 | BMad Party | 5 hrs | Visual programming | Blockly Editor complete |
| Screen 3 Category Management | 2025-01-25 | BMad Party | 4 hrs | Templates + Excel | Category Mgmt complete |
| Screen 3 DU Plan Review | 2025-01-25 | BMad Party | 3 hrs | Submission workflow | Plan Review complete |
| Screen 4 Blockly Consolidation | 2025-01-26 | BMad Party | 5 hrs | Visual consolidation | Blockly Consolidation complete |
| Procureline Admin Screen 0 | 2025-01-20 | BMad Party | 3 hrs | Admin login | Admin Login complete |
| Procureline Admin Screen 1 | 2025-01-21 | BMad Party | 4 hrs | Tenant management | Admin Dashboard complete |
| Documentation Efficiency | 2025-10-03 | BMad Party | 6 hrs | Vault refactoring | Refactoring plan complete |

**Total**: 12+ documented sessions
**BMad Party Mode**: 11 sessions
**Solo Design**: 1 session
**Total Design Time**: ~50+ hours

**Documentation Location**: `08-Research/Project Logs/bmad-session-log-[screen-name].md`

---

## 🎨 **Component Catalog Reference**

### **Foundation Components**

| Component | Category | Reuse Count | Validated In |
|-----------|----------|-------------|-------------|
| Primary Button | Foundation | 50+ instances | All 14 prototypes |
| Secondary Button | Foundation | 30+ instances | All dashboards |
| Icon Button | Foundation | 40+ instances | All toolbars |
| Typography System (H1-H4) | Foundation | 100% | All 14 prototypes |
| Color Palette (OKLCH) | Foundation | 100% | All 14 prototypes |

### **Layout Components**

| Component | Category | Reuse Count | Validated In |
|-----------|----------|-------------|-------------|
| 12-Column Bento Grid | Layout | 4 uses | All dashboards |
| Page Container | Layout | 14 uses | All 14 prototypes |
| Top Navigation Bar | Layout | 14 uses | All 14 prototypes |
| Breadcrumb | Layout | 10 uses | All navigation screens |

### **Dashboard Components**

| Component | Category | Reuse Count | Validated In |
|-----------|----------|-------------|-------------|
| Metric Card | Dashboard | 20+ uses | All 4 dashboards |
| Quick Action Card | Dashboard | 15+ uses | PO & DU dashboards |
| Chart Container | Dashboard | 8+ uses | Dashboard analytics |

### **Form Components**

| Component | Category | Reuse Count | Validated In |
|-----------|----------|-------------|-------------|
| Text Input | Form | 40+ uses | All forms |
| Dropdown/Select | Form | 25+ uses | All selection screens |
| File Upload | Form | 1 use | PO Category Management |
| Form Validation | Form | 100% | All forms |

### **Data Display Components**

| Component | Category | Reuse Count | Validated In |
|-----------|----------|-------------|-------------|
| Data Table | Data Display | 5+ uses | Dept/Category Mgmt |
| List Items | Data Display | 15+ uses | All list views |
| Badge/Tag | Data Display | 30+ uses | All dashboards |
| Status Indicators | Data Display | 20+ uses | All status displays |

### **Feedback Components**

| Component | Category | Reuse Count | Validated In |
|-----------|----------|-------------|-------------|
| Toast Notification | Feedback | 10+ uses | Form submissions |
| Modal/Dialog | Feedback | 8+ uses | Confirmation dialogs |
| Alert Banner | Feedback | 6+ uses | System messages |
| Spinner/Skeleton Loader | Feedback | 14 uses | All loading states |

### **Blockly Components**

| Component | Category | Reuse Count | Validated In |
|-----------|----------|-------------|-------------|
| Blockly Workspace | Blockly | 2 uses | PO & DU Blockly screens |
| Department Plan Block | Blockly | 1 use | PO Consolidation |
| Item Block | Blockly | 1 use | DU Editor |
| Aggregate Block | Blockly | 1 use | PO Consolidation |
| Timing Block | Blockly | 1 use | PO Consolidation |

**Total Components**: 30+ validated
**Component Reuse Efficiency**: 87% average
**100% Reuse Components**: Typography, Colors, Navigation

**Documentation Location**: `06-UX/Design System/component-catalog.md`

---

## 📊 **Pipeline Completion Status**

| Pipeline | Layer | Total Screens | Completed | In Progress | Quality | Status |
|----------|-------|---------------|-----------|-------------|---------|--------|
| Procureline Admin | 1 | 2 | 2 | 0 | 10/10 | ✅ Complete |
| Tenant Admin | 2 | 1 | 1 | 0 | 10/10 | ⏸️ Partial (1 eliminated) |
| Procurement Officer | 3 | 5 | 5 | 0 | 10/10 | ✅ Complete |
| Departmental User | 4 | 4 | 4 | 0 | 10/10 | ✅ Complete |

**Overall Progress**: 12/12 active screens (100%)
**Eliminated Designs**: 1 (Tenant Admin Screen 2 - see eliminated-designs-index)
**Average Quality**: 10/10
**Component Reuse**: 87% average

---

## 🎯 **Design System Metrics**

### **Immutable Design Standards**

| Standard | Value | Status | Validated Through |
|----------|-------|--------|-------------------|
| Primary Color | `oklch(0.6916 0.1692 154.0327)` | 🔒 Immutable | 14 prototypes |
| Typography | Inter font family | 🔒 Immutable | 14 prototypes |
| Animation Timing | 300ms cubic-bezier | 🔒 Immutable | All interactions |
| Bento Grid | 12-column system | 🔒 Immutable | 4 dashboards |
| Component Reuse Target | 87% | ✅ Achieved | PO & DU pipelines |

### **Quality Metrics**

| Metric | Target | Achieved | Status |
|--------|--------|----------|--------|
| Screen Quality Rating | 10/10 | 10/10 (13 screens) | ✅ Met |
| Component Reuse | 75%+ | 87% | ✅ Exceeded |
| Production Readiness | 100% | 100% (13 screens) | ✅ Met |
| Design DNA Compliance | 100% | 100% (14 prototypes) | ✅ Met |
| Accessibility (WCAG 2.1 AA) | 100% | 100% (all screens) | ✅ Met |

---

## 📁 **Key File Locations**

### **Entry Points**

| Document | Location | Purpose |
|----------|----------|---------|
| README | Root folder | Vault navigation guide |
| tag-index | Root folder | 67 controlled tags |
| quick-reference-guide | Root folder | This document |
| vault-index | Root folder | Complete file directory |

### **Essential Documentation**

| Document | Location | Purpose |
|----------|----------|---------|
| Procureline Project Brief | `00-Vision-Exploration/` | Complete project vision |
| Design DNA Standards | `06-UX/Design System/` | Immutable design rules |
| Component Catalog | `06-UX/Design System/` | 30+ reusable components |
| ADR Index | `02-Architecture/decisions/` | 9 architecture decisions |
| Webapp Architecture | `02-Architecture/` | Technical architecture |

### **Screen Designs**

| Pipeline | Location | Screens |
|----------|----------|---------|
| Procureline Admin | `06-UX/02-Screen-Designs/01-Procureline Admin/` | 2 screens |
| Tenant Admin | `06-UX/02-Screen-Designs/02-Tenant Admin/` | 1 screen |
| Procurement Officer | `06-UX/02-Screen-Designs/03-Procurement Officer/` | 5 screens |
| Departmental User | `06-UX/02-Screen-Designs/04-Departmental User/` | 4 screens |

### **Prototypes**

| Location | Contents | Count |
|----------|----------|-------|
| `.superdesign/design_iterations/` | Production-ready HTML prototypes | 14 files |
| `.superdesign/redundant or refused screens/` | Obsolete/archived prototypes | 1+ files |

---

## 🔍 **Common Lookup Scenarios**

### **"I need the design spec for Screen X"**

1. Navigate to `06-UX/02-Screen-Designs/[Pipeline]/`
2. Open `screen-X-[name]-design-complete.md`
3. Links to prototype, ADRs, and session log included

### **"I need to see the prototype for Screen X"**

1. Navigate to `.superdesign/design_iterations/`
2. Open `screen-X-[pipeline]-[name].html` in browser
3. No build process needed - functional HTML/CSS/JS

### **"I need architecture decision rationale"**

1. Open `02-Architecture/decisions/adr-index.md`
2. Search for ADR number or topic
3. Each ADR includes context, decision, consequences, alternatives

### **"I need component usage examples"**

1. Open `06-UX/Design System/component-catalog.md`
2. Find component by category (Foundation, Layout, Dashboard, etc.)
3. See validated usage, reuse count, implementation details

### **"I need to find all documents about Blockly"**

1. Open `tag-index.md`
2. Search for `blockly` tag
3. Results: 2 screen designs, ADR-003, 2 session logs

### **"I need design system colors/typography"**

1. Open `06-UX/Design System/procureline-design-dna-standards.md`
2. See IMMUTABLE color palette (OKLCH), typography (Inter), animation (300ms)
3. Copy CSS variables directly from document

---

## 📈 **Vault Health Statistics**

| Category | Count | Status |
|----------|-------|--------|
| Total Markdown Files | 59+ | ✅ Healthy |
| Screen Design Docs | 13 | ✅ Complete |
| Interactive Prototypes | 14 | ✅ Complete |
| Session Logs | 15+ | ✅ Complete |
| ADRs | 9 | ✅ Complete |
| Validated Components | 30+ | ✅ Complete |
| Controlled Tags | 67 | ✅ Complete |
| Eliminated Designs | 1 | ✅ Archived |
| Broken Links | 0 | ✅ Healthy |

**Last Health Check**: October 5, 2025 (Phase 10 Completion)
**Vault Version**: 1.0 (Production Ready)

---

## 🎓 **Quick Start Paths**

### **30-Second Overview**
- Read: [[README|Quick Start]] (2 min)
- Browse: This quick reference guide (3 min)
- Check: [[tag-index]] for tag categories (2 min)

### **10-Minute Foundation**
1. [[Procureline-Project-Brief]] - Project vision (5 min)
2. [[procureline-design-dna-standards]] - Design rules (5 min)

### **30-Minute Deep Dive**
1. [[Procureline-Project-Brief]] - Vision (5 min)
2. [[webapp-architecture-vision]] - Architecture (15 min)
3. [[procureline-design-dna-standards]] - Design system (5 min)
4. Browse 2-3 prototypes in `.superdesign/design_iterations/` (5 min)

### **1-Hour Complete Understanding**
1. [[Procureline-Project-Brief]] - Vision (5 min)
2. [[webapp-architecture-vision]] - Architecture (15 min)
3. [[adr-index]] - Scan all 9 ADRs (15 min)
4. [[procureline-design-dna-standards]] - Design system (10 min)
5. [[component-catalog]] - Components (10 min)
6. Browse 5+ prototypes (5 min)

---

## 🔗 **Related Navigation Aids**

- [[README]] - Complete vault navigation guide with golden paths by role
- [[tag-index]] - 67 controlled vocabulary tags in 10 categories
- [[vault-index]] - Complete file directory (59+ files)
- [[prototype-documentation-map]] - Bidirectional prototype↔doc linkage

---

*Quick Reference Guide maintained by BMad Design Team - Procureline University Procurement Platform*
*Last Updated: October 5, 2025*
