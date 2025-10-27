# 06-UX

## Purpose

This folder contains all user experience design artifacts including research, wireframes, mockups, prototypes, and design system documentation.

## Folder Structure

```
06-UX/
├── research/          # User research findings
├── wireframes/        # Low-fidelity designs
├── mockups/           # High-fidelity designs
├── prototypes/        # Interactive prototypes
└── design-system/     # Component library, style guide
```

## Subfolders

### `research/`
**User Research and Insights** - Evidence-based understanding of user needs.

**Contains:**
- User research study reports
- Usability test results
- User feedback analysis
- A/B test results
- Heuristic evaluations

**Example:** `user-research-procurement-officers-2025-10.md`

### `wireframes/`
**Low-Fidelity Designs** - Early-stage layout and interaction concepts.

**Contains:**
- Wireframe sketches
- Information architecture diagrams
- User flow diagrams
- Content structure mockups

**Formats:** `.md` (ASCII/Markdown), `.png`, `.fig` (Figma), `.sketch`

**Example:** `wireframe-login-screen.png`, `user-flow-procurement-process.md`

### `mockups/`
**High-Fidelity Designs** - Visual designs with final styling and branding.

**Contains:**
- Screen designs
- Visual design comps
- Brand application examples
- Responsive design variations

**Example:** `mockup-dashboard-desktop.png`, `mockup-mobile-requisition-form.fig`

### `prototypes/`
**Interactive Prototypes** - Clickable demonstrations of user interactions.

**Contains:**
- Interactive prototype files
- Animation specifications
- Micro-interaction designs
- Prototype testing notes

**Example:** `prototype-procurement-workflow-v2.fig`, `prototype-onboarding-flow.md`

### `design-system/`
**Design System Documentation** - Reusable component library and guidelines.

**Contains:**
- Component library specifications
- Style guide (colors, typography, spacing)
- Design tokens
- Accessibility guidelines
- Usage documentation

**Example:** `design-system-components.md`, `style-guide-colors.md`

## BMAD Workflows That Output Here

- `/bmad:bmm:workflows:create-ux-design` → `wireframes/`, `mockups/`
- `/bmad:bmm:agents:ux-designer` → All subfolders
- `/bmad:bmm:workflows:research` (with research_type: user) → `research/`

## Design Process

1. **Research**: Understand user needs and pain points
2. **Wireframe**: Sketch low-fidelity layouts and flows
3. **Mockup**: Create high-fidelity visual designs
4. **Prototype**: Build interactive demonstrations
5. **Test**: Validate designs with users
6. **Systematize**: Document reusable patterns in design system

## Design Principles

- **User-Centered**: Always prioritize user needs
- **Accessible**: WCAG 2.1 AA compliance minimum
- **Consistent**: Follow design system patterns
- **Responsive**: Design for all screen sizes
- **Performant**: Optimize for fast load times

## Document Lifecycle

1. **Exploration**: Research and wireframe creation
2. **Design**: High-fidelity mockup development
3. **Validation**: User testing and feedback
4. **Handoff**: Specifications provided to development
5. **Implementation**: Developers build from designs
6. **Verification**: Design QA ensures fidelity

## Related Folders

- **Requirements**: `01-Product-Requirements/` - User stories inform UX
- **Development**: `04-Development/epics/` - Stories reference UX designs
- **Testing**: `05-Testing/` - Usability tests validate UX
