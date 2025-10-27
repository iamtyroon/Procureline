# 05-Testing

## Purpose

This folder contains all testing-related documentation including test strategies, test cases, automation specifications, and test execution reports.

## Folder Structure

```
05-Testing/
├── test-plans/        # Test strategy documents
├── test-cases/        # Individual test cases
├── automation/        # Test automation specs
└── reports/           # Test execution reports
```

## Subfolders

### `test-plans/`
**Test Strategy and Planning** - High-level test approach and coverage plans.

**Contains:**
- Test strategy documents
- Risk-based test planning
- Test coverage matrices
- Testing scope and objectives
- Resource allocation plans

**Example:** `test-plan-authentication-epic.md`

### `test-cases/`
**Individual Test Cases** - Detailed test scenarios and acceptance criteria.

**Contains:**
- Functional test cases
- Integration test scenarios
- Edge case documentation
- Acceptance criteria validation
- Regression test suites

**Naming:** `tc-###-feature-scenario.md`

**Example:** `tc-001-login-valid-credentials.md`

### `automation/`
**Test Automation Specifications** - Automated test framework and configuration.

**Contains:**
- Test automation architecture
- Framework selection justification
- Test fixture specifications
- CI/CD test integration
- Performance test configurations

**Example:** `automation-playwright-setup.md`, `automation-api-tests-spec.md`

### `reports/`
**Test Execution Reports** - Results and metrics from test runs.

**Contains:**
- Test execution summaries
- Coverage reports
- Bug reports and defect tracking
- Quality metrics
- Sprint test status

**Example:** `test-report-sprint-01.md`, `coverage-report-2025-10.md`

## BMAD Workflows That Output Here

- `/bmad:bmm:workflows:testarch-test-design` → `test-plans/`
- `/bmad:bmm:workflows:testarch-atdd` → `test-cases/`
- `/bmad:bmm:workflows:testarch-automate` → `automation/`
- `/bmad:bmm:workflows:testarch-framework` → `automation/`
- `/bmad:bmm:workflows:testarch-trace` → `reports/`
- `/bmad:bmm:agents:tea` → All subfolders

## Testing Philosophy

1. **Shift-Left**: Testing activities begin during requirements phase
2. **Traceability**: Tests trace to requirements and stories
3. **Automation-First**: Automate repetitive tests
4. **Risk-Based**: Prioritize testing based on impact and likelihood
5. **Continuous**: Testing integrated into CI/CD pipeline

## Document Lifecycle

1. **Planning**: Test plans created from requirements/specs
2. **Design**: Test cases designed before implementation
3. **Execution**: Tests run and results documented
4. **Reporting**: Results analyzed and communicated
5. **Maintenance**: Tests updated as features evolve

## Related Folders

- **Requirements**: `01-Product-Requirements/prds/` - Tests validate requirements
- **Specs**: `03-Technical-Specifications/` - Tests verify technical correctness
- **Stories**: `04-Development/epics/*/stories/` - Tests linked to user stories
- **Operations**: `08-Operations/` - Production monitoring informed by test results
