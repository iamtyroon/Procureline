---
title: Procureline Vault - Getting Started Guide
document-type: onboarding-guide
project: Procureline
guide-type: comprehensive-onboarding
target-audience: new-team-members, stakeholders, ai-agents
estimated-time: 2-4 hours
created: '2025-10-07'
last-updated: '2025-10-07'
tags:
- documentation
- getting-started
- onboarding
- project-brief
- training
- vault-meta
- vision
related:
- '[[README]]'
- '[[vault-index]]'
- '[[quick-reference-guide]]'
- '[[Procureline-Project-Brief]]'
---

# Procureline Vault - Getting Started Guide

**Welcome to the Procureline Documentation Vault!**

This comprehensive guide will help you navigate, understand, and effectively use the complete Procureline project documentation.

**Estimated Time**: 2-4 hours to complete full onboarding

---

## 🎯 What You'll Learn

By the end of this guide, you will be able to:

1. **Understand the Procureline Project** - Vision, architecture, and business goals
2. **Navigate the Vault** - Find any document quickly using multiple pathways
3. **Understand the Design System** - Immutable Procureline Design DNA and component library
4. **Review Screen Designs** - Access all 14 production-ready prototypes
5. **Understand Technical Architecture** - 4-layer authentication, multi-tenant SaaS, ADRs
6. **Track Development Progress** - Session logs, pipeline completion, milestones
7. **Use Vault Effectively** - Search, cross-reference, contribute documentation

---

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] Access to the Procureline documentation vault repository
- [ ] Markdown viewer or Obsidian installed (recommended: Obsidian for best experience)
- [ ] Basic understanding of procurement processes (helpful but not required)
- [ ] Familiarity with software development terminology

**Recommended Setup**:
- **Obsidian** (https://obsidian.md) - Best vault experience with wiki-link support
- **Git** - For version control and collaboration
- **Web Browser** - To view HTML prototypes

---

## 🚀 Quick Start (15 Minutes)

If you need to get productive immediately, follow this express path:

### **Step 1: Read the Vision Brief** (5 minutes)

Open: **[[Procureline-Project-Brief]]**

**What you'll learn**:
- What Procureline is and why it exists
- Target market (African universities)
- Core value proposition
- High-level architecture overview

### **Step 2: Review the Design System** (5 minutes)

Open: **[[procureline-design-dna-standards]]**

**What you'll learn**:
- Signature green color: `oklch(0.6916 0.1692 154.0327)`
- Inter font typography system
- Bento box dashboard pattern
- 87% component reuse principle

### **Step 3: Explore One Prototype** (5 minutes)

Open: `.superdesign/design_iterations/screen-1-po-dashboard.html` in browser

**What you'll see**:
- Production-ready Procurement Officer dashboard
- Bento box grid pattern in action
- Procureline visual identity applied

**✅ After Quick Start**: You'll have foundational context to start contributing

---

## 📖 Complete Onboarding (2-4 Hours)

For comprehensive understanding, follow this structured learning path:

---

## **MODULE 1: Project Understanding** (30 minutes)

### **1.1: Read Project Vision**

**Document**: **[[Procureline-Project-Brief]]**

**Focus Areas**:
- Executive summary
- Target market analysis (African universities)
- 4-layer authentication system (Procureline Admin → Tenant Admin → PO → DU)
- Core user workflows
- Business model and feasibility

**Key Takeaway**: Procureline is a multi-tenant SaaS procurement platform specifically designed for African universities, solving critical procurement planning inefficiencies.

---

### **1.2: Understand Stakeholders**

**Document**: **[[stakeholder-analysis-user-stories]]**

**Primary Stakeholders**:
1. **Procurement Officers** (Layer 3) - Daily system operators
2. **Departmental Users** (Layer 4) - Department-level planning staff
3. **Tenant Admins** (Layer 2) - University-level administrators
4. **Procureline Admins** (Layer 1) - Platform operators

**Key Takeaway**: Each layer has distinct responsibilities, permissions, and workflows. Understanding role boundaries is critical.

---

### **1.3: Review Architecture**

**Document**: **[[webapp-architecture-vision]]**

**Focus Areas**:
- Multi-tenant architecture (ADR-001)
- 4-layer role-based access control (ADR-002)
- Security and data isolation
- Scalability considerations

**Key Takeaway**: Architecture is designed to support 50+ universities with complete data isolation and role-based security.

---

### **1.4: Check Feasibility Analysis**

**Document**: **[[saas-architecture-validation-feasibility]]**

**Focus Areas**:
- Technical feasibility: **HIGHLY FEASIBLE**
- Market validation (Pwani University research)
- Financial projections (18-24 month ROI)
- Implementation roadmap

**Key Takeaway**: Project is technically sound, market-validated, and financially viable.

---

## **MODULE 2: Vault Navigation** (20 minutes)

### **2.1: Understand Vault Structure**

**Document**: **[[vault-index]]**

**Folder Structure**:
```
00-Vision-Exploration/    # Project vision, prototypes, reference guides
0.5-Project-Briefs/       # High-level project briefs and vision documents
01-Product/               # Product strategy, user stories, pipeline updates
02-Architecture/          # Technical architecture, ADRs, design decisions
03-Stories/               # User stories and feature requirements
04-Development/           # Development documentation
05-Quality/               # QA and testing documentation
06-UX/                    # Design system, screen designs, research
  ├── 01-Research-Bible/  # UI/UX research foundation
  ├── 02-Screen-Designs/  # Complete screen designs by user pipeline
  │   ├── 01-Procureline Admin/
  │   ├── 02-Tenant Admin/
  │   ├── 03-Procurement Officer/
  │   └── 04-Departmental User/
  └── Design System/      # Procureline visual identity
07-Management/            # Project management artifacts
08-Research/              # Research analysis, session logs
99-Archive/               # Eliminated designs, deprecated docs
```

**Key Takeaway**: BMAD v6 compliant structure with clear separation of concerns.

---

### **2.2: Learn Navigation Paths**

**Document**: **[[README]]**

**5 Golden Paths**:

1. **Path 1: "I'm New - Show Me The Vision"** ⭐ RECOMMENDED
   - Vision brief → Design DNA → Prototypes → Pipeline completion

2. **Path 2: "I'm a Designer"**
   - Design DNA → Component catalog → All screen designs → Research Bible

3. **Path 3: "I'm a Developer"**
   - Architecture → ADRs → Screen designs → Session logs

4. **Path 4: "I'm a Business Analyst"**
   - Vision brief → Stakeholders → Feasibility → University research

5. **Path 5: "I'm an AI Agent"**
   - Vision brief → Vault index → Tag index → Quick reference

**Key Takeaway**: Choose your path based on your role and navigate efficiently.

---

### **2.3: Master Quick Reference**

**Document**: **[[quick-reference-guide]]**

**Use Cases**:
- "Where is the design for PO Dashboard?" → Quick lookup table
- "What ADR covers Blockly integration?" → ADR index
- "Which session designed Screen 3?" → Session log mapping
- "What's the signature color?" → Design token reference

**Key Takeaway**: Bookmark this for instant access to any information.

---

## **MODULE 3: Design System** (45 minutes)

### **3.1: Study Design DNA Standards**

**Document**: **[[procureline-design-dna-standards]]**

**Immutable Elements**:

1. **Color System** (ADR-006)
   - Primary: `oklch(0.6916 0.1692 154.0327)` (signature green)
   - OKLCH perceptually uniform color space
   - Full palette documented

2. **Typography** (ADR-007)
   - Font: Inter (400, 500, 600, 700 weights)
   - Institutional authority with modern clarity
   - Responsive scale system

3. **Animation** (ADR-008)
   - Timing: 300ms cubic-bezier(0.4, 0, 0.2, 1)
   - GPU-accelerated transforms
   - Consistent easing throughout

4. **Bento Box Pattern** (ADR-004)
   - 12-column grid system
   - Responsive breakpoints (desktop, tablet, mobile)
   - 24px gaps (desktop), 16px (tablet/mobile)

**Key Takeaway**: Design system is **IMMUTABLE** - validated through 2 complete pipelines (PO, DU) with 87% component reuse.

---

### **3.2: Explore Component Catalog**

**Document**: **[[component-catalog]]**

**30+ Validated Components**:

**Foundation** (Buttons, Typography, Icons, Colors)
**Layout** (Bento Box Grid, Page Container, Navigation, Breadcrumbs)
**Dashboard** (Metric Cards, Quick Action Cards, Charts)
**Forms** (Text Input, Dropdown, File Upload, Validation)
**Data Display** (Tables, List Items, Badges, Status Indicators)
**Feedback** (Toasts, Modals, Alerts, Loading States)
**Blockly** (Workspace, Custom Procurement Blocks)

**Component Reuse Metrics**:
- **PO Pipeline**: 87% reuse (5 screens)
- **DU Pipeline**: 87% reuse (4 screens)
- **Target**: 87% ✅ **ACHIEVED**

**Key Takeaway**: Use existing components whenever possible. 87% reuse target must be maintained.

---

### **3.3: Review Design Governance**

**Section in**: **[[procureline-design-dna-standards]]** → Design System Governance

**Immutability Principle**:
- Design DNA is **IMMUTABLE** once production-validated
- Changes allowed only for: Critical accessibility issues, critical technical issues, major versions (2.0, 3.0)
- What cannot be changed: Color system, typography, bento box fundamentals, animation timing, component architecture

**Component Contribution**:
1. Propose new component with rationale
2. Design must align with DNA standards
3. Validate across multiple use cases
4. Document in component catalog
5. Update reuse metrics

**Key Takeaway**: Design system stability is paramount. Changes require strong justification.

---

## **MODULE 4: Screen Designs & Prototypes** (60 minutes)

### **4.1: Understand Screen Organization**

**Location**: `06-UX/02-Screen-Designs/`
**Structure**: Organized by user pipeline in dedicated subfolders

**4 Pipelines** (13 screens total):

**Procureline Admin (Layer 1)**: 2 screens
- Screen 0: Login
- Screen 1: Dashboard

**Tenant Admin (Layer 2)**: 2 screens
- Screen 0: Login
- Screen 1: Dashboard

**Procurement Officer (Layer 3)**: 5 screens ✅ **COMPLETE PIPELINE**
- Screen 0.5: Login (dual: PO + DU)
- Screen 1: Dashboard (9-bento grid)
- Screen 2: Department Management
- Screen 3: Category & Item Management
- Screen 4: Blockly Consolidation Editor

**Departmental User (Layer 4)**: 4 screens ✅ **COMPLETE PIPELINE**
- Screen 0.5: Login (shared with PO)
- Screen 1: Dashboard
- Screen 2: Blockly Plan Editor
- Screen 3: Plan Review & Communication

**Key Takeaway**: PO and DU pipelines are production-ready (10/10 quality). Layers 1-2 are foundational screens.

---

### **4.2: Explore Production Prototypes**

**Location**: `.superdesign/design_iterations/`

**14 HTML Prototypes** (all functional):

**Try These First**:
1. `screen-1-po-dashboard.html` - See bento box pattern in action
2. `screen-4-po-blockly-consolidation.html` - See Blockly integration
3. `screen-2-du-blockly-editor.html` - See departmental Blockly workflow

**How to View**:
1. Navigate to `.superdesign/design_iterations/`
2. Open any `.html` file in web browser
3. Interact with prototype (fully functional UI, mock data)

**Key Takeaway**: All prototypes use production-quality design with realistic mock data. These are implementation-ready references.

---

### **4.3: Study Complete Pipeline**

**Document**: **[[po-pipeline-completion-update]]**

**Achievement Highlights**:
- ✅ Complete 4-screen pipeline (plus login)
- ✅ Functional Blockly consolidation
- ✅ Realistic mock data (5 university departments)
- ✅ Excel export capability
- ✅ 87% component reuse validated

**Review This to Understand**:
- Complete user workflow (login → dashboard → management → consolidation → export)
- Production-ready implementation examples
- Component reuse in practice
- Mock data structure

**Key Takeaway**: PO pipeline demonstrates complete end-to-end workflow. Study this to understand implementation standards.

---

### **4.4: Review Screen Design Documentation**

**Example**: **[[screen-1-po-dashboard-design-complete]]**

**Standard Structure**:
1. **Screen Purpose** - High-level overview
2. **Core Functionality** - Feature list
3. **User Flow** - Interaction workflow
4. **Layout Specifications** - Bento box grid details
5. **Component Specifications** - All components with props
6. **Mock Data Structure** - JSON data examples
7. **State Management** - State requirements
8. **Interactions & Behaviors** - Click, hover, transitions
9. **Responsive Design** - Breakpoints and adaptations
10. **Accessibility** - WCAG 2.1 AA compliance
11. **Design Resources** - Prototype links, ADRs, session logs

**Key Takeaway**: Every screen has exhaustive documentation. Use these as implementation blueprints.

---

## **MODULE 5: Technical Architecture** (30 minutes)

### **5.1: Study Architecture Decision Records**

**Location**: `02-Architecture/decisions/`

**9 Critical ADRs**:

**ADR-001: Multi-Tenant Architecture** (High Impact)
- Decision: Dedicated database per tenant
- Rationale: Data isolation, security, compliance
- Status: Accepted, implemented

**ADR-002: 4-Layer Role-Based Access Control** (High Impact)
- Decision: Hierarchical 4-layer system
- Rationale: Matches organizational structure
- Status: Accepted, implemented

**ADR-003: Blockly Visual Programming** (High Impact)
- Decision: Google Blockly for consolidation
- Rationale: Non-technical user accessibility
- Status: Accepted, implemented (PO Screen 4, DU Screen 2)

**ADR-004: Bento Box Dashboard Pattern** (High Impact)
- Decision: 12-column grid for all dashboards
- Rationale: Consistent, flexible, responsive
- Status: Accepted, validated across 4 dashboards

**ADR-005: Excel Import/Export** (Medium Impact)
- Decision: Native Excel integration
- Rationale: Existing workflow compatibility
- Status: Accepted, implemented

**ADR-006: OKLCH Color System** (Medium Impact)
- Decision: OKLCH over RGB/HSL
- Rationale: Perceptual uniformity
- Status: Accepted, all 14 prototypes compliant

**ADR-007: Inter Font Typography** (Medium Impact)
- Decision: Inter font family
- Rationale: Institutional authority + clarity
- Status: Accepted, all 14 prototypes compliant

**ADR-008: 300ms Animation Timing** (Low Impact)
- Decision: 300ms standard transition
- Rationale: Responsive feel without sluggishness
- Status: Accepted, all 14 prototypes compliant

**ADR-009: 87% Component Reuse Target** (High Impact)
- Decision: Minimum 87% reuse across pipelines
- Rationale: Development efficiency, consistency
- Status: Accepted, validated (PO: 87%, DU: 87%)

**Key Takeaway**: ADRs are binding technical decisions. Understand rationale before proposing changes.

---

### **5.2: Understand Data Flow**

**Department Setup** → **Category Assignment** → **Template Distribution** → **Departmental Submissions** → **PO Consolidation** → **Excel Export** → **Government Reporting**

**Multi-Tenant Data Isolation**:
- Each university = separate tenant
- Complete database isolation
- No cross-tenant data access
- Scalable to 50+ universities

**Key Takeaway**: Data flows through 4 layers with strict isolation and role-based permissions.

---

## **MODULE 6: Research & Development History** (30 minutes)

### **6.1: Review University Research**

**Document**: **[[pwani-university-procurement-analysis]]**

**Key Findings**:
- 5 departments analyzed
- 45.2M KES total annual budget
- 200+ procurement items
- Quarterly planning cycles
- GOK compliance requirements

**Why This Matters**: All mock data and workflows are based on real university procurement processes.

---

### **6.2: Understand Design Evolution**

**Document**: **[[research-bible-revisions-integration-log]]**

**Design Iterations**: 10+ revisions across 14 prototypes

**Evolution Tracking**:
- Initial research → Principles → Implementation → Validation → Refinement
- All 14 prototypes validated through BMad party mode sessions
- Comprehensive session logs documenting each screen design

**Key Takeaway**: Design decisions are research-backed and validated through multiple iterations.

---

### **6.3: Study Session Logs**

**Location**: `08-Research/Project Logs/`

**15 Session Logs** documenting:
- Screen design sessions (BMad party mode)
- Architecture decisions
- Research findings
- Technical explorations

**Example**: **[[bmad-session-log-screen-1-po-dashboard-implementation]]**

**Session logs contain**:
- Design decisions and rationale
- Technical challenges and solutions
- Component creation and validation
- Mock data development

**Key Takeaway**: Session logs provide historical context for "why" decisions were made.

---

## **MODULE 7: Vault Contribution & Maintenance** (15 minutes)

### **7.1: Adding New Documentation**

**Standard Process**:

1. **Choose Correct Location**
   - Project briefs → `0.5-Project-Briefs/`
   - Product docs → `01-Product/`
   - Architecture → `02-Architecture/`
   - Screen designs → `06-UX/02-Screen-Designs/[pipeline-folder]/`
     - Admin screens → `06-UX/02-Screen-Designs/01-Procureline Admin/`
     - Tenant Admin screens → `06-UX/02-Screen-Designs/02-Tenant Admin/`
     - Procurement Officer screens → `06-UX/02-Screen-Designs/03-Procurement Officer/`
     - Departmental User screens → `06-UX/02-Screen-Designs/04-Departmental User/`
   - Research → `08-Research/`

2. **Add Frontmatter** (see Phase 10 standards)
   ```yaml
   ---
   title: "Document Title"
   document-type: "type-from-controlled-vocabulary"
   project: "Procureline"
   created: "YYYY-MM-DD"
   last-updated: "YYYY-MM-DD"
   tags:
     - category/tag
   related:
     - "[[related-document-1]]"
     - "[[related-document-2]]"
   ---
   ```

   *(Note: Replace `related-document-1` and `related-document-2` with actual document names)*

3. **Use Standard Structure** (varies by document type)
   - See existing documents for templates

4. **Create Cross-References**
   - Link to related documents using wiki-style links (`` `[[document-name]]` ``)
   - Ensure bidirectional linking

5. **Update Indexes**
   - Add entry to relevant index (vault-index, tag-index, etc.)
   - Update quick-reference-guide if applicable

---

### **7.2: Maintaining Vault Health**

**Weekly Tasks**:
- Run `vault-health-report.sh` every Monday
- Review health score (target: ≥95)
- Fix any broken links immediately
- Validate new document frontmatter

**Monthly Tasks**:
- Deep audit (manual review of 10 random documents)
- Design system compliance check (test 5 prototypes)
- Archive organization verification
- Health dashboard trend analysis

**Key Takeaway**: Vault health monitoring is systematic. Follow **[[vault-health-monitoring-guide]]** for complete procedures.

---

### **7.3: Design System Contributions**

**Before Creating New Components**:
1. Check **[[component-catalog]]** - component may already exist
2. Verify component aligns with Design DNA standards
3. Validate component across multiple use cases
4. Calculate component reuse impact (maintain 87% target)

**If New Component Approved**:
1. Document in component-catalog.md
2. Create usage examples
3. Link to implementing screens
4. Update reuse metrics

**Key Takeaway**: Component creation requires strong rationale and documentation.

---

## 🎓 Certification Checklist

Complete these tasks to confirm your vault proficiency:

### **Level 1: Basic Navigation** ✅

- [ ] Located and read Procureline-Project-Brief
- [ ] Opened vault-index and used a golden path
- [ ] Found a specific screen design document
- [ ] Viewed an HTML prototype in browser
- [ ] Used quick-reference-guide to look up information

### **Level 2: Design Understanding** ✅

- [ ] Identified the signature green color value
- [ ] Listed the 4 typography weight options
- [ ] Described the bento box grid system
- [ ] Found a component in component-catalog
- [ ] Explained the 87% reuse principle

### **Level 3: Technical Comprehension** ✅

- [ ] Read all 9 ADRs
- [ ] Described the 4-layer authentication system
- [ ] Explained multi-tenant data isolation
- [ ] Traced data flow from DU to PO to Excel
- [ ] Found implementation status for an ADR

### **Level 4: Contribution Readiness** ✅

- [ ] Created a test document with proper frontmatter
- [ ] Added cross-references using wiki-links
- [ ] Ran vault-health-report.sh and reviewed output
- [ ] Updated quick-reference-guide with new entry
- [ ] Validated tag format against tag-index

**🎉 Congratulations!** You're now proficient with the Procureline documentation vault.

---

## 📚 Recommended Reading Order (By Role)

### **For Designers**

1. **[[procureline-design-dna-standards]]** - Immutable design system
2. **[[component-catalog]]** - All 30+ components
3. **[[ui-ux-research-design-principles]]** - Design research foundation
4. **[[screen-1-po-dashboard-design-complete]]** - Example complete screen spec
5. **[[adr-index]]** - Design-critical ADRs (004, 006, 007)
6. View all 14 HTML prototypes in `.superdesign/design_iterations/`

### **For Developers**

1. **[[webapp-architecture-vision]]** - Complete technical architecture
2. **[[adr-index]]** - Core architecture ADRs (001, 002, 003)
3. **[[po-pipeline-completion-update]]** - Production-ready reference implementation
4. **[[screen-1-po-dashboard-design-complete]]** - Detailed implementation spec
5. **[[screen-4-po-blockly-consolidation-design-complete]]** - Complex Blockly integration
6. **[[component-catalog]]** - Reusable component specifications
7. All ADRs for technical constraints and decisions

### **For Business Analysts**

1. **[[Procureline-Project-Brief]]** - Business case and value proposition
2. **[[stakeholder-analysis-user-stories]]** - Complete stakeholder mapping
3. **[[saas-architecture-validation-feasibility]]** - Market validation and financials
4. **[[pwani-university-procurement-analysis]]** - Real university research
5. **[[po-pipeline-completion-update]]** - Delivered functionality overview
6. **[[departmental-user-pipeline-design-plan]]** - Planned functionality roadmap

### **For Project Managers**

1. **[[Procureline-Project-Brief]]** - Project overview
2. **[[vault-index]]** - Complete documentation inventory
3. **[[po-pipeline-completion-update]]** - Milestone achievement
4. **[[departmental-user-pipeline-design-plan]]** - Roadmap and priorities
5. **[[vault-health-dashboard]]** - Documentation quality metrics
6. Session logs in `08-Research/Project Logs/` - Development history

### **For QA/Testing**

1. **[[procureline-design-dna-standards]]** - Quality standards to validate
2. **[[component-catalog]]** - Components to test
3. **[[screen-1-po-dashboard-design-complete]]** - Detailed acceptance criteria
4. All HTML prototypes - Expected behavior references
5. **[[adr-index]]** - Component reuse validation requirements (ADR-009)
6. **[[vault-health-monitoring-guide]]** - Vault quality procedures

---

## 🆘 Common Questions

### **Q: Where do I start if I'm completely new?**

**A**: Follow the **Quick Start** (15 minutes) at the top of this guide, then complete **Module 1: Project Understanding**.

---

### **Q: How do I find a specific piece of information?**

**A**: Use **[[quick-reference-guide]]** for fast lookups. Alternatively, use your editor's search function (Ctrl+Shift+F in Obsidian) to search across all vault files.

---

### **Q: Can I change the design system?**

**A**: Design system is **IMMUTABLE**. Changes allowed only for critical issues (accessibility, browser compatibility) or major version releases (2.0, 3.0). See Design System Governance in **[[procureline-design-dna-standards]]**.

---

### **Q: Which prototype should I reference for implementation?**

**A**: For PO pipeline: All 5 screens are production-ready. For DU pipeline: All 4 screens are production-ready. Refer to corresponding screen design documents (e.g., **[[screen-1-po-dashboard-design-complete]]**) for detailed implementation specs.

---

### **Q: How do I know if my documentation follows standards?**

**A**: Run `vault-health-report.sh` to validate frontmatter, tags, and links. Manually check against Phase 10 frontmatter schema for your document type. Target: 100% compliance.

---

### **Q: What if I find a broken link or error in documentation?**

**A**: Create a GitHub issue with:
- Document name and location
- Description of issue
- Suggested fix (if applicable)
- Priority (P0 for broken core workflows, P1 for broken references, P2 for minor issues)

---

### **Q: How do I contribute a new screen design?**

**A**:
1. Follow BMad party mode design process
2. Ensure Design DNA compliance (validate with existing components)
3. Create design document using screen design template
4. Create HTML prototype in `.superdesign/design_iterations/`
5. Document session in session log
6. Add cross-references (prototype ↔ documentation)
7. Update design-iteration-index
8. Calculate and document component reuse percentage

---

### **Q: Where is the component reuse calculated?**

**A**: See **[[adr-index]]** (ADR-009) for methodology. See **[[component-catalog]]** for metrics. Current: PO Pipeline 87%, DU Pipeline 87%. Target: ≥87%.

---

## 🔗 Essential Bookmarks

**Bookmark these documents for daily reference**:

1. **[[vault-index]]** - Complete vault map
2. **[[quick-reference-guide]]** - Fast information lookup
3. **[[procureline-design-dna-standards]]** - Design system authority
4. **[[component-catalog]]** - Component specifications
5. **[[README]]** - Vault entry point with golden paths
6. **[[vault-health-dashboard]]** - Vault quality metrics
7. **[[tag-index]]** - Complete tag taxonomy

---

## 📞 Support & Resources

### **Documentation Issues**
- Create GitHub issue in documentation repository
- Tag with `documentation`, `vault-health`, or appropriate label
- Reference this guide and relevant vault documents

### **Design System Questions**
- Refer to **[[procureline-design-dna-standards]]**
- Check **[[component-catalog]]** for component details
- Review applicable ADRs (ADR-004, 006, 007, 008, 009)
- Consult with design team if clarification needed

### **Technical Architecture Questions**
- Review all 9 ADRs first
- Check **[[webapp-architecture-vision]]**
- Review session logs for historical context
- Consult with technical lead if clarification needed

---

## ✅ Next Steps After Onboarding

1. **Choose Your Role Path** - Follow recommended reading order for your role
2. **Complete Certification Checklist** - Validate your vault proficiency
3. **Bookmark Essential Documents** - Quick access to key references
4. **Run Your First Health Check** - Execute `vault-health-report.sh`
5. **Contribute Your First Document** - Add a session log or update existing doc
6. **Join Weekly Health Audits** - Participate in Monday vault health reviews

---

**🎉 Welcome to the Procureline Team!**

You now have everything you need to be productive with the Procureline documentation vault. Happy documenting!

---

*Getting Started Guide maintained as part of Procureline Vault documentation*
*For updates or improvements, contact the documentation team*
