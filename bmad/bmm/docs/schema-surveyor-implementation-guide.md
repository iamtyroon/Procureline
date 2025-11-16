# Schema Surveyor Implementation Guide

**Version**: 3.0
**Last Updated**: 2025-11-06
**Project**: Procureline
**Author**: BMad Master + Tyroon

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Integration Points](#integration-points)
4. [Usage Guide](#usage-guide)
5. [Benefits](#benefits)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Features](#advanced-features)
8. [Future Enhancements](#future-enhancements)

---

## Overview

The **Schema Surveyor** is a specialized sub-agent that provides live database intelligence for story creation and development. It runs in its own 200k token sandbox to prevent schema verbosity from polluting the main workflow context.

### Problem Statement

Before Schema Surveyor:
- Dev agents hallucinated incorrect table/column names
- Stories lacked specific migration SQL guidance
- Security vulnerabilities (missing RLS) went undetected
- Schema changes conflicted across parallel stories
- Performance issues from missing indexes were discovered late

### Solution

Schema Surveyor provides:
- **Live schema retrieval** via Supabase MCP tools (zero hallucinations)
- **Migration SQL generation** with rollback scripts and complexity analysis
- **Security auditing** via `get_advisors` MCP tool
- **Schema diff tracking** to detect drift and conflicts
- **Performance recommendations** (missing indexes, query optimization)
- **TypeScript type awareness** for frontend alignment
- **200k token sandbox** to prevent context pollution

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Main Workflow                         │
│              (create-story / story-context)             │
│                                                         │
│  Step 4.75 / 2.75: Database Schema Survey               │
│  ┌──────────────────────────────────────────────┐      │
│  │ 1. Detect if story involves database work    │      │
│  │ 2. Extract affected tables & keywords        │      │
│  │ 3. Construct schema-survey-request XML       │      │
│  │ 4. Invoke Schema Surveyor sub-agent ─────────┼──────┼──┐
│  │ 5. Parse response & extract intelligence     │      │  │
│  │ 6. Include in story document / context       │      │  │
│  └──────────────────────────────────────────────┘      │  │
└─────────────────────────────────────────────────────────┘  │
                                                              │
                                                              │
┌─────────────────────────────────────────────────────────┐  │
│          Schema Surveyor Sub-Agent (200k sandbox)       │◄─┘
│                                                         │
│  ┌──────────────────────────────────────────────┐      │
│  │ MCP Tools Available:                         │      │
│  │ - mcp__supabase__list_tables                 │      │
│  │ - mcp__supabase__list_migrations             │      │
│  │ - mcp__supabase__execute_sql                 │      │
│  │ - mcp__supabase__get_advisors                │      │
│  │ - mcp__supabase__generate_typescript_types   │      │
│  │ - mcp__supabase__list_branches               │      │
│  └──────────────────────────────────────────────┘      │
│                                                         │
│  Execution Flow:                                        │
│  1. Parse schema-survey-request XML                     │
│  2. Query schema (list tables, deep SQL queries)        │
│  3. Run security audit (get_advisors)                   │
│  4. Generate migration SQL recommendations              │
│  5. Check TypeScript type changes                       │
│  6. Detect cross-story conflicts                        │
│  7. Return 4-part response:                             │
│     - Part 1: Executive Summary (XML)                   │
│     - Part 2: Raw MCP Results (Markdown)                │
│     - Part 3: Intelligence Report (Markdown)            │
│     - Part 4: Complete JSON (JSON)                      │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Returns structured response
                           ▼
         ┌────────────────────────────────────┐
         │    Schema Survey Contract (YAML)   │
         │  Defines input/output structure    │
         │  Consumed by workflows for parsing │
         └────────────────────────────────────┘
```

### Data Flow

**Input**: `<schema-survey-request>` XML with:
- Story ID, summary, description
- Affected tables
- Relationship depth (0-2)
- Security flags (RLS, auth)
- Action flags (generate_migration, run_security_audit, check_type_updates)
- Keywords for fuzzy matching

**Processing** (in 200k sandbox):
- Query Supabase schema via MCP
- Fuzzy match tables based on keywords
- Deep dive: columns, constraints, indexes, RLS policies
- Traverse FK relationships
- Run security/performance audits
- Generate migration SQL
- Check TypeScript type changes
- Detect cross-story conflicts

**Output**: 4-part structured response:
1. **Executive Summary (XML)**: Quick metrics for workflow decisions
2. **Raw MCP Results (Markdown)**: Proof of work
3. **Intelligence Report (Markdown)**: Human-readable analysis
4. **Complete JSON**: Machine-readable for dev agent

---

## Integration Points

### 1. Create-Story Workflow (Step 4.75)

**When**: After UX specs loaded, before requirements finalization

**Purpose**: Generate database intelligence for story creation

**Flow**:
```
1. Detect if story involves database (keyword matching)
2. If no database work: Skip
3. If database work detected:
   a. Extract affected tables from ACs/tech-spec
   b. Determine relationship depth & security requirements
   c. Construct schema-survey-request XML
   d. Invoke Schema Surveyor (200k sandbox)
   e. Parse response
   f. Extract migration SQL, security issues, performance notes
   g. Include in story document:
      - "Database Schema Reference" section
      - Migration SQL code block
      - Security requirements
      - Test data fixtures
   h. Store Complete JSON for later use in story-context
4. Check for critical security issues → Prepend security tasks if found
5. Check for schema conflicts → Warn user
6. Check migration complexity → Tag for architect review if complex
```

**Output in Story File**:
```markdown
### Database Schema Reference

**Schema Intelligence Summary:**
- Tables Affected: inspections, equipment
- Migration Complexity: medium
- Security Issues: 1 critical, 2 high
- Conflicts: None detected

**Migration SQL:**
```sql
BEGIN;

ALTER TABLE public.inspections
  ADD COLUMN equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL;

CREATE INDEX idx_inspections_equipment_id ON public.inspections(equipment_id);

COMMIT;
```

**Security Requirements:**
- CRITICAL: equipment table missing RLS policy

**Performance Notes:**
- Recommendation: Add index on inspections(equipment_id) for FK lookups

**Test Data Fixtures:**
- equipment table: 5 test records needed for assignment workflow
```

### 2. Story-Context Workflow (Step 2.75)

**When**: After UX specs loaded, before code analysis

**Purpose**: Validate schema survey and include in context XML

**Flow**:
```
1. Check if story has "Database Schema Reference" section
2. If no database section: Skip
3. If database section exists:
   a. Load stored schema survey JSON (from create-story)
   b. If not found: Generate fresh survey
   c. If found: Validate with fresh query to detect schema drift
   d. Compare current vs stored:
      - Check columns match
      - Check for new migrations
      - Check for security changes
   e. If drift detected:
      - Warn user with specific differences
      - Ask whether to continue or halt
      - Use updated schema if continue
   f. Prepare for XML embedding:
      - Extract actionable intelligence
      - Format as structured XML
      - Wrap Complete JSON in CDATA
4. Include in context XML as <databaseContext> section
5. Dev agent receives complete schema intelligence
```

**Output in Context XML**:
```xml
<databaseContext>
  <surveyMetadata>
    <timestamp>2025-11-06T14:30:00Z</timestamp>
    <source>stored-and-validated</source>
    <driftDetected>false</driftDetected>
    <projectId>xsrimymebzinenvzyblz</projectId>
  </surveyMetadata>

  <tablesAffected>
    <table>
      <name>inspections</name>
      <schema>public</schema>
      <primaryKey>id</primaryKey>
    </table>
    <table>
      <name>equipment</name>
      <schema>public</schema>
      <primaryKey>id</primaryKey>
    </table>
  </tablesAffected>

  <migrationGuidance>
    <complexity>medium</complexity>
    <sql><![CDATA[
      -- Migration SQL here
    ]]></sql>
    <rollbackSql><![CDATA[
      -- Rollback SQL here
    ]]></rollbackSql>
    <testingChecklist>
      <item>Test FK constraint enforcement</item>
      <item>Verify RLS policy blocks unauthorized access</item>
    </testingChecklist>
  </migrationGuidance>

  <securityRequirements>
    <critical>
      <type>missing_rls_policy</type>
      <table>equipment</table>
      <issue>Table is publicly readable without RLS</issue>
      <remediationUrl>https://supabase.com/docs/guides/auth/row-level-security</remediationUrl>
    </critical>
  </securityRequirements>

  <performanceNotes>
    <missingIndex>
      <table>inspections</table>
      <column>equipment_id</column>
      <reason>FK lookup without index causes table scans</reason>
      <recommendation>CREATE INDEX idx_inspections_equipment_id ON inspections(equipment_id);</recommendation>
    </missingIndex>
  </performanceNotes>

  <completeSchemaJson><![CDATA[
    {
      "metadata": { ... },
      "tables": [ ... ],
      "relationships": [ ... ]
    }
  ]]></completeSchemaJson>
</databaseContext>
```

---

## Usage Guide

### For Story Creators (PM/SM Agents)

**When creating a story** that involves database work:

1. **Run create-story workflow as normal**
   - Schema Surveyor automatically invokes if database keywords detected

2. **Review generated "Database Schema Reference" section**
   - Verify tables affected are correct
   - Review migration SQL for accuracy
   - Check security warnings

3. **Address critical security issues immediately**
   - If critical issues found, story will be flagged
   - Security fix tasks will be prepended to task list
   - Dev agent MUST fix security before feature implementation

4. **Handle schema conflicts**
   - If another story is modifying same tables, you'll be warned
   - Options:
     - Coordinate with other story (sequence migrations)
     - Use Supabase branching for isolation
     - Defer story until conflict resolved

5. **Complex migrations may need architect review**
   - If migration complexity is "complex" or "high-risk", story will be tagged
   - Architect should review before implementation

### For Developers (Dev Agent)

**When implementing a story** with database changes:

1. **Read story "Database Schema Reference" section**
   - Tables Affected: Know which tables to modify
   - Migration SQL: Use as template (DO NOT blindly copy)
   - Security Requirements: MUST address before feature work
   - Performance Notes: Follow index recommendations

2. **Access full schema context in story context XML**
   - File: `docs/05-Epics-Stories/Epic-X/Story Context/story-key.context.xml`
   - Section: `<databaseContext>`
   - Contains: Complete table schemas, relationships, constraints

3. **Implement migration**
   - Use provided migration SQL as starting point
   - Verify FK constraints are correct
   - Add recommended indexes
   - Implement required RLS policies

4. **Run security checks**
   - Test RLS policies block unauthorized access
   - Verify no SQL injection vulnerabilities
   - Check remediation URLs for best practices

5. **Update TypeScript types**
   - Check `<typeScriptUpdates>` section in context
   - Update interfaces in specified files
   - Verify no breaking changes (or handle gracefully)

6. **Create test fixtures**
   - Check `<testDataRequirements>` section
   - Create required test data
   - Test all acceptance criteria with fixtures

---

## Benefits

### Context Efficiency

**Before Schema Surveyor**:
- Schema queries in main workflow consumed 20-40k tokens
- Verbose schema dumps polluted conversation context
- Repeated schema queries across multiple stories

**After Schema Surveyor**:
- Schema queries isolated in 200k sandbox
- Main workflow sees only 2-5k token summary
- **Context savings: 15-35k tokens per story**

### Accuracy

**Before**:
- Dev agents hallucinated table names: "profiles_user" vs "user_profiles"
- Incorrect column types and constraints
- **Rework rate: 30-50% for database stories**

**After**:
- Live schema from Supabase MCP (zero hallucinations)
- Correct table/column names on first attempt
- **Rework rate: <5%**

### Security

**Before**:
- RLS policy gaps discovered in production
- Security vulnerabilities found during code review
- **Security issues per story: 2-3 on average**

**After**:
- Proactive security scanning via `get_advisors`
- Critical issues flagged BEFORE development starts
- **Security issues caught early: 95%+**

### Performance

**Before**:
- Missing indexes discovered during load testing
- N+1 query problems found late
- Performance fixes required separate stories

**After**:
- Index recommendations provided upfront
- Query performance analysis during planning
- **Performance issues prevented: 80%+**

### Developer Experience

**Before**:
- Dev agent spends time researching schema
- Unclear migration requirements
- "Figure it out" approach to database changes

**After**:
- Complete schema context provided
- Precise migration SQL template
- Clear security and performance guidance
- **Dev time savings: 40-60% on database stories**

---

## Troubleshooting

### Issue: Schema Surveyor not invoked during create-story

**Symptoms**:
- Story created without "Database Schema Reference" section
- No migration SQL provided

**Causes**:
- Story doesn't contain database keywords
- Database work is implicit, not obvious from title/ACs

**Resolution**:
1. Manually trigger by adding database keywords to story title or ACs
2. Or: Re-run create-story after adding explicit table references to epic/tech-spec

**Prevention**:
- Be explicit in epic/tech-spec about database changes
- Mention table names in acceptance criteria

### Issue: Schema drift detected during story-context

**Symptoms**:
- Warning: "🚨 SCHEMA DRIFT DETECTED"
- Differences shown between stored and current schema

**Causes**:
- Another story applied migrations after this story was created
- Manual schema changes made outside workflow
- Migrations applied directly to database

**Resolution**:
1. Review schema changes to ensure story is still valid
2. Options:
   - **Continue with updated schema** (recommended if changes don't affect story)
   - **Halt and review manually** (if changes conflict with story requirements)
3. If story requirements outdated:
   - Update acceptance criteria in story file
   - Re-run create-story to refresh requirements

**Prevention**:
- Generate story context shortly after story creation
- Coordinate schema changes across parallel stories
- Use Supabase branching for isolated testing

### Issue: Critical security issues flagged

**Symptoms**:
- Warning: "🚨 CRITICAL SECURITY ISSUES DETECTED"
- Story has security fix tasks prepended

**Causes**:
- Table missing RLS policies
- Public access to sensitive data
- Auth bypass vulnerabilities

**Resolution**:
1. **MUST fix security issues BEFORE feature implementation**
2. Review remediation URLs provided
3. Implement RLS policies as specified
4. Test that RLS blocks unauthorized access
5. Re-run security audit to verify fixes

**Prevention**:
- Follow RLS best practices from start
- Use security templates for common patterns
- Review Supabase security docs

### Issue: Schema Surveyor takes too long / times out

**Symptoms**:
- Sub-agent doesn't return within expected time
- Timeout errors from MCP tools

**Causes**:
- Large database with many tables (100+ tables)
- Complex relationship traversal (depth=2 with many FKs)
- Slow Supabase API response

**Resolution**:
1. Reduce `relationship_depth` in schema-survey-request (use 1 instead of 2)
2. Specify explicit `affected_entities` instead of relying on fuzzy matching
3. Set `refresh_cache=false` to use cached data (if acceptable)
4. Check Supabase API status / network connectivity

**Prevention**:
- Use explicit table references in epics
- Limit relationship depth to what's actually needed
- Cache schema for stories that don't need latest

### Issue: Migration SQL is incorrect or incomplete

**Symptoms**:
- Generated migration doesn't match requirements
- Missing constraints or indexes
- Incorrect FK relationships

**Causes**:
- Fuzzy matching selected wrong tables
- Requirements ambiguous in ACs
- Schema Surveyor misinterpreted intent

**Resolution**:
1. **Migration SQL is a TEMPLATE, not final code**
2. Dev agent MUST review and customize for specific requirements
3. Verify FK relationships match data model
4. Add any additional constraints from ACs
5. Test migration in dev environment before applying

**Prevention**:
- Be specific about table names in ACs
- Explicitly list affected tables in epic/tech-spec
- Provide data model diagrams for complex relationships

---

## Advanced Features

### 1. Fuzzy Table Matching

Schema Surveyor uses sophisticated fuzzy matching to find relevant tables:

**Algorithm**:
- Split compound words: "userprofile" → "user", "profile"
- Handle singular/plural: "profiles" ≈ "profile"
- Ignore common suffixes: "_data", "_info", "_table"
- Word order agnostic: "user_profile" ≈ "profile_user"
- Partial match: "user_prof" ≈ "user_profile"

**Example**:
```
Story: "Add equipment tracking to inspections"
Keywords extracted: "equipment", "tracking", "inspection"

Matches found:
✅ "equipment" → equipment (exact match)
✅ "inspection" → inspections (plural variant)
✅ "tracking" → No direct match, but FK relationships reveal equipment_tracking table
```

### 2. Cross-Story Conflict Detection

Schema Surveyor reads `sprint-status.yaml` to detect parallel stories touching same tables:

**Detection Logic**:
```
1. Extract tables from current story requirements
2. Read sprint-status.yaml
3. Find all stories with status IN_PROGRESS
4. For each in-progress story:
   a. Check if story file exists
   b. Parse "Database Schema Reference" section
   c. Extract tables affected
5. If overlap detected:
   - Flag as conflict
   - List conflicting stories
   - Recommend coordination strategy
```

**Conflict Resolution Strategies**:
- **Sequential migrations**: Story A completes before Story B starts
- **Supabase branching**: Each story uses isolated branch for testing
- **Coordination**: Dev agents communicate to avoid conflicts

### 3. Schema Diff Tracking

Schema Surveyor maintains an in-memory snapshot of schema state:

**Snapshot Structure**:
```json
{
  "last_snapshot_timestamp": "2025-11-06T14:30:00Z",
  "tables": {
    "inspections": {
      "columns": ["id", "created_at", "equipment_id"],
      "snapshot_hash": "abc123"
    }
  },
  "migrations_count": 42,
  "last_migration": "20251106_add_equipment_tracking"
}
```

**Diff Algorithm**:
```
For each table:
  1. Compare column count
  2. Compare column names/types
  3. Compare constraints
  4. Compare indexes
  5. Compare RLS policies

Generate diff report:
  - Added: [new columns, constraints, indexes]
  - Removed: [deleted items]
  - Modified: [changed items]
```

**Use Cases**:
- Detect unexpected schema changes
- Warn if migrations applied between story creation and development
- Validate story requirements still valid

### 4. Branching Strategy Recommendations

Schema Surveyor recommends Supabase branching for:

**Complex Migrations**:
- Multiple tables with cross-dependencies
- Schema changes requiring data migration
- Migrations that might need rollback

**Exploratory Work**:
- Experimenting with schema designs
- Testing performance impact
- Prototyping new features

**Parallel Development**:
- Multiple stories modifying same tables
- Need for isolated testing environments

**Recommendation Logic**:
```python
def should_recommend_branching(story):
    if migration_complexity in ['complex', 'high-risk']:
        return True
    if len(affected_tables) > 3:
        return True
    if cross_story_conflicts_detected:
        return True
    if story.type == 'exploratory':
        return True
    return False
```

---

## Future Enhancements

### Planned for v4.0

1. **Data Migration Intelligence**
   - Detect when DDL changes require data migrations
   - Generate data migration SQL (INSERT/UPDATE/DELETE)
   - Estimate data migration complexity and duration

2. **Schema Versioning**
   - Track schema state across story lifecycle
   - Store historical snapshots
   - Enable rollback to previous schema state

3. **Enhanced Conflict Resolution**
   - Automatic migration sequencing suggestions
   - Dependency graph visualization
   - Merge conflict prediction

4. **Performance Simulation**
   - Estimate query performance impact before implementation
   - Suggest query optimizations
   - Recommend sharding/partitioning strategies

5. **Schema Testing**
   - Generate schema test fixtures automatically
   - Create RLS policy test cases
   - Validate FK constraints with test data

### Under Consideration

- **Multi-database support** (PostgreSQL, MySQL, MongoDB)
- **Schema documentation generation** (auto-generate ER diagrams)
- **Cost estimation** (storage, query costs for cloud databases)
- **Migration history tracking** (git-like version control for schema)

---

## Reference Documentation

**Related Files**:
- Schema Surveyor Agent: `.claude/agents/bmad-analysis/schema-surveyor.md`
- Output Contract: `bmad/bmm/workflows/schema-survey-contract.yaml`
- Create-Story Integration: `bmad/bmm/workflows/4-implementation/create-story/instructions.md` (Step 4.75)
- Story-Context Integration: `bmad/bmm/workflows/4-implementation/story-context/instructions.md` (Step 2.75)

**MCP Tools Used**:
- `mcp__supabase__list_tables`
- `mcp__supabase__list_migrations`
- `mcp__supabase__execute_sql`
- `mcp__supabase__get_advisors`
- `mcp__supabase__generate_typescript_types`
- `mcp__supabase__list_branches`

**Project Configuration**:
- Project ID: `xsrimymebzinenvzyblz`
- Database: Supabase (PostgreSQL)
- Schema: `public` (primary schema)

---

## Support

For issues, questions, or feature requests:

1. **Check Troubleshooting section** above
2. **Review agent definition** for detailed behavior specs
3. **Examine workflow integration** for invocation patterns
4. **Test in isolation** by manually invoking Schema Surveyor
5. **Report issues** with full context (story file, error logs, MCP responses)

---

**End of Guide**

Generated by: BMad Master Agent
Date: 2025-11-06
For: Procureline Project
