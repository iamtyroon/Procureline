# 03-Technical-Specifications

## Purpose

This folder contains detailed technical specifications that translate architecture decisions into implementable designs. These specs guide developers during story implementation.

## Folder Structure

```
03-Technical-Specifications/
├── api/               # API specifications
├── database/          # Database schemas, migrations
├── integrations/      # Third-party integration specs
└── technical-debt/    # Tech debt documentation
```

## Subfolders

### `api/`
**API Specifications** - Detailed interface definitions for all APIs.

**Contains:**
- OpenAPI/Swagger specifications
- GraphQL schemas
- REST endpoint documentation
- API versioning strategies
- Request/response examples

**Example:** `openapi-procurement-api-v1.yaml`

### `database/`
**Database Specifications** - Data persistence layer designs.

**Contains:**
- Database schema definitions
- Migration scripts documentation
- Data modeling decisions
- Indexing strategies
- Backup and recovery procedures

**Example:** `schema-procurement-tables-v1.sql`, `migration-001-add-audit-fields.md`

### `integrations/`
**Third-Party Integration Specifications** - External system integration designs.

**Contains:**
- Integration architecture for external services
- API contract specifications
- Authentication/authorization flows
- Data transformation mappings
- Error handling strategies

**Example:** `integration-stripe-payments.md`, `integration-sendgrid-emails.md`

### `technical-debt/`
**Technical Debt Tracking** - Documentation of known technical shortcuts and their remediation plans.

**Contains:**
- Technical debt inventory
- Refactoring plans
- Code smell analysis
- Debt prioritization matrices

**Example:** `tech-debt-legacy-auth-system.md`

## BMAD Workflows That Output Here

- `/bmad:bmm:workflows:tech-spec` → Root or appropriate subfolder
- `/bmad:bmm:agents:architect` → `api/`, `database/`
- `/bmad:bmm:agents:dev` → `integrations/`
- `/bmad:bmb:workflows:audit-workflow` → `technical-debt/`

## Document Lifecycle

1. **Creation**: Specs written after architecture decisions
2. **Review**: Technical review before implementation begins
3. **Implementation**: Developers reference during story work
4. **Updates**: Specs updated as implementation reveals gaps
5. **Versioning**: API specs versioned alongside code

## Quality Standards

- **Completeness**: All interfaces fully specified
- **Testability**: Specs enable test case creation
- **Examples**: Include realistic usage examples
- **Edge Cases**: Document error scenarios and boundaries

## Related Folders

- **Previous Phase**: `02-Architecture/` - Architecture decisions inform specs
- **Implementation**: `04-Development/epics/` - Stories implement these specs
- **Testing**: `05-Testing/test-cases/` - Test cases validate specs
- **Operations**: `08-Operations/` - Operational runbooks reference specs
