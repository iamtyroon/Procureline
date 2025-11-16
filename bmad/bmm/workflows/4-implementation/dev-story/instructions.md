# Develop Story - Workflow Instructions

```xml
<critical>The workflow execution engine is governed by: {project-root}/bmad/core/tasks/workflow.xml</critical>
<critical>You MUST have already loaded and processed: {installed_path}/workflow.yaml</critical>
<critical>Communicate all responses in {communication_language} and language MUST be tailored to {user_skill_level}</critical>
<critical>Generate all documents in {document_output_language}</critical>
<critical>Only modify the story file in these areas: Tasks/Subtasks checkboxes, Dev Agent Record (Debug Log, Completion Notes), File List, Change Log, and Status</critical>
<critical>Execute ALL steps in exact order; do NOT skip steps</critical>
<critical>Absolutely DO NOT stop because of "milestones", "significant progress", or "session boundaries". Continue in a single execution until the story is COMPLETE (all ACs satisfied and all tasks/subtasks checked) UNLESS a HALT condition is triggered or the USER gives other instruction.</critical>
<critical>Do NOT schedule a "next session" or request review pauses unless a HALT condition applies. Only Step 6 decides completion.</critical>

<critical>User skill level ({user_skill_level}) affects conversation style ONLY, not code updates.</critical>

<workflow>

  <step n="1" goal="Find next ready story and load it" tag="sprint-status">
    <check if="{{story_path}} is provided">
      <action>Use {{story_path}} directly</action>
      <action>Read COMPLETE story file</action>
      <action>Extract story_key from filename or metadata</action>
      <goto>task_check</goto>
    </check>

    <critical>MUST read COMPLETE sprint-status.yaml file from start to end to preserve order</critical>
    <action>Load the FULL file: {{output_folder}}/sprint-status.yaml</action>
    <action>Read ALL lines from beginning to end - do not skip any content</action>
    <action>Parse the development_status section completely to understand story order</action>

    <action>Find the FIRST story (by reading in order from top to bottom) where:
      - Key matches pattern: number-number-name (e.g., "1-2-user-auth")
      - NOT an epic key (epic-X) or retrospective (epic-X-retrospective)
      - Status value equals "ready-for-dev"
    </action>

    <check if="no ready-for-dev or in-progress story found">
      <output>📋 No ready-for-dev stories found in sprint-status.yaml
**Options:**
1. Run `story-context` to generate context file and mark drafted stories as ready
2. Run `story-ready` to quickly mark drafted stories as ready without generating context
3. Run `create-story` if no incomplete stories are drafted yet
4. Check {output-folder}/sprint-status.yaml to see current sprint status
      </output>
      <action>HALT</action>
    </check>

    <action>Store the found story_key (e.g., "1-2-user-authentication") for later status updates</action>
    <action>Find matching story file in {{story_dir}} using story_key pattern: {{story_key}}.md</action>
    <action>Read COMPLETE story file from discovered path</action>

    <anchor id="task_check" />

    <action>Parse sections: Story, Acceptance Criteria, Tasks/Subtasks, Dev Notes, Dev Agent Record, File List, Change Log, Status</action>

    <action>Check if context file exists at: {{story_dir}}/{{story_key}}.context.xml</action>
    <check if="context file exists">
      <action>Read COMPLETE context file</action>
      <action>Parse all sections: story details, artifacts (docs, code, dependencies), interfaces, constraints, tests</action>
      <action>Use this context to inform implementation decisions and approaches</action>
    </check>
    <check if="context file does NOT exist">
      <output>ℹ️ No context file found for {{story_key}}

Proceeding with story file only. For better context, consider running `story-context` workflow first.
      </output>
    </check>

    <action>Identify first incomplete task (unchecked [ ]) in Tasks/Subtasks</action>

    <action if="no incomplete tasks"><goto step="6">Completion sequence</goto></action>
    <action if="story file inaccessible">HALT: "Cannot develop story without access to story file"</action>
    <action if="incomplete task or subtask requirements ambiguous">ASK user to clarify or HALT</action>
  </step>

  <step n="1.25" goal="Detect sub-story and load predecessor context">
    <critical>SUB-STORY SUPPORT: Handle stories split by create-story complexity analysis</critical>

    <action>Parse story_key to detect sub-story format:

      **Pattern Recognition:**
      - Standard story: `{epic}-{story}-{title}` (e.g., "2-11-photo-capture")
      - Sub-story: `{epic}-{story}-{subletter}-{title}` (e.g., "2-11-a-database-schema")

      **Parsing Logic:**
      1. Split story_key by dashes: parts = story_key.split('-')
      2. If parts[0] is numeric AND parts[1] is numeric AND parts[2] is single letter (a-z):
         - This is a SUB-STORY
         - epic_num = parts[0]
         - story_num = parts[1]
         - sub_letter = parts[2]
         - story_title = parts[3+] (remainder)
         - parent_story_key = "{epic_num}-{story_num}-{story_title_base}"
         - Set {{is_sub_story}} = true
      3. Otherwise:
         - This is a STANDARD story
         - epic_num = parts[0]
         - story_num = parts[1]
         - story_title = parts[2+]
         - Set {{is_sub_story}} = false

      Store: {{is_sub_story}}, {{epic_num}}, {{story_num}}, {{sub_letter}}, {{parent_story_key}}
    </action>

    <check if="{{is_sub_story}} == false">
      <output>ℹ️ Standard story format detected</output>
      <action>Set {{predecessor_context}} = null</action>
      <action>Skip to next step (1.5)</action>
    </check>

    <check if="{{is_sub_story}} == true">
      <output>📑 Sub-story detected: {{story_key}}

**Sub-Story Context:**
- Epic: {{epic_num}}
- Story Series: {{epic_num}}-{{story_num}}
- Sub-story Part: {{sub_letter}}
- Parent Story: {{parent_story_key}}

Checking for predecessor sub-stories to load context...
      </output>

      <action>Determine predecessor sub-story:

        **Predecessor Logic:**
        - Sub-letter sequence: a, b, c, d, e, f, g, h, ...
        - If {{sub_letter}} == 'a': No predecessor (foundation story)
        - If {{sub_letter}} == 'b': Predecessor is 'a'
        - If {{sub_letter}} == 'c': Predecessor is 'b'
        - etc.

        **Calculation:**
        1. Convert {{sub_letter}} to ASCII code
        2. Subtract 1 to get predecessor letter
        3. If result < 'a': No predecessor exists
        4. Otherwise: Construct predecessor_key = "{epic_num}-{story_num}-{predecessor_letter}-*"

        Store: {{has_predecessor}}, {{predecessor_letter}}, {{predecessor_key_pattern}}
      </action>

      <check if="{{has_predecessor}} == false">
        <output>ℹ️ This is the foundation sub-story (part a) - no predecessor to load</output>
        <action>Set {{predecessor_context}} = "Foundation sub-story - no predecessor"</action>
        <action>Skip to next step (1.5)</action>
      </check>

      <check if="{{has_predecessor}} == true">
        <output>🔍 Predecessor sub-story detected: {{predecessor_key_pattern}}

Searching for completed predecessor story files...
        </output>

        <action>Find predecessor story file:
          1. List all files in {{story_dir}}
          2. Filter for files matching pattern: {{epic_num}}-{{story_num}}-{{predecessor_letter}}-*.md
          3. Should match exactly 1 file
          4. If 0 files found: HALT with error (dependency not met)
          5. If >1 files found: HALT with error (ambiguous match)
          6. Store matched file path as {{predecessor_story_path}}
        </action>

        <check if="predecessor story file NOT found">
          <output>🚨 DEPENDENCY NOT MET

Cannot implement sub-story {{story_key}} because predecessor sub-story was not found.

**Required predecessor:** {{predecessor_key_pattern}}

**Reason:** Sub-stories in a series must be implemented in order (a → b → c → ...).

**Action Required:**
1. Check sprint-status.yaml to verify predecessor status
2. If predecessor is "done": Check {{story_dir}} for missing file
3. If predecessor is not "done": Implement predecessor first
4. Do NOT proceed with this story until predecessor is complete

**Workflow will HALT.**
          </output>
          <action>HALT workflow execution</action>
        </check>

        <action>Load and parse predecessor story file:
          1. Read COMPLETE predecessor story file from {{predecessor_story_path}}
          2. Extract key sections:

             A) Status - Verify predecessor is "done":
                - If status != "done": HALT with dependency error
                - If status == "done": Proceed

             B) Dev Agent Record → Completion Notes:
                - Extract list of completion notes
                - Focus on: new services, interfaces, architectural decisions

             C) Dev Agent Record → File List:
                - Extract files created (NEW)
                - Extract files modified (MODIFIED)
                - Map file paths to capabilities (e.g., "services/PhotoService.js" → "Photo upload service")

             D) Dev Notes:
                - Extract any "Successors" or "Integration Points" notes
                - Look for public APIs or shared components documented

             E) Acceptance Criteria (completed):
                - Review what functionality was delivered
                - Identify contracts/interfaces for this sub-story to consume

             F) Tasks (completed):
                - Understand what was implemented
                - Identify reusable components

          3. Store ALL findings as {{predecessor_context}} with structure:
             - predecessor_key: (e.g., "2-11-a-database-schema")
             - status: "done" (verified)
             - new_files: [list with descriptions]
             - modified_files: [list]
             - new_services: [list with interfaces]
             - architectural_decisions: [list]
             - integration_contracts: [list of APIs/interfaces this story should use]
             - completion_notes: [list]
        </action>

        <check if="predecessor status != 'done'">
          <output>🚨 DEPENDENCY NOT MET

Predecessor sub-story {{predecessor_key_pattern}} is not marked as DONE.

**Predecessor Status:** {{predecessor_status}}

**Reason:** Sub-stories must be implemented and completed in sequence.

**Action Required:**
1. Complete predecessor sub-story first
2. Ensure predecessor status is set to "done" in sprint-status.yaml
3. Return to implement this sub-story after predecessor is done

**Workflow will HALT.**
          </output>
          <action>HALT workflow execution</action>
        </check>

        <output>✅ Predecessor context loaded successfully

**Predecessor:** {{predecessor_context.predecessor_key}} (Status: done)

**Key Deliverables from Predecessor:**
{{#if predecessor_context.new_files}}
- **New Files Created:** {{predecessor_context.new_files.length}} files
{{#each predecessor_context.new_files}}
  * {{path}}: {{description}}
{{/each}}
{{/if}}

{{#if predecessor_context.new_services}}
- **New Services/Interfaces:** {{predecessor_context.new_services.length}}
{{#each predecessor_context.new_services}}
  * {{name}}: {{interface_description}}
{{/each}}
{{/if}}

{{#if predecessor_context.integration_contracts}}
- **Integration Contracts for This Story:**
{{#each predecessor_context.integration_contracts}}
  * {{contract}}
{{/each}}
{{/if}}

**IMPORTANT:** Reuse components from predecessor - do NOT recreate functionality.

This context will inform implementation decisions throughout this story.
        </output>

        <action>Add predecessor context to Dev Agent Record automatically:
          At the start of implementation, prepend to Debug Log:

          ```
          === PREDECESSOR CONTEXT (from {{predecessor_context.predecessor_key}}) ===

          This sub-story depends on the following deliverables from the previous sub-story:

          {{#each predecessor_context.integration_contracts}}
          - {{contract}}
          {{/each}}

          Reusable components available:
          {{#each predecessor_context.new_files}}
          - {{path}}: {{description}}
          {{/each}}

          DO NOT recreate functionality already implemented in predecessor.

          =============================================================
          ```
        </action>
      </check>
    </check>
  </step>

  <critical>⚠️ UPCOMING MANDATORY SUB-AGENT INVOCATIONS (DATABASE STORIES)

  The following steps may require invoking the Schema Surveyor sub-agent up to THREE times:
  1. Step 1.5: Pre-implementation schema validation
  2. Step 2.1: Pre-migration schema snapshot (if migration task)
  3. Step 4.5: Post-migration verification (if migration task)

  **YOU MUST (when required):**
  - Use the Task tool to invoke "bmm-schema-surveyor"
  - Wait for the sub-agent to complete its analysis
  - Receive and parse the structured response
  - Store the response in appropriate variables

  **YOU MUST NOT:**
  - Skip the invocation
  - Manually extract schema information from story files or context
  - Simulate, fake, or invent the response
  - Proceed without a valid response from Schema Surveyor

  **Validation:**
  Validation checkpoints (Steps 1.55, 2.15, 4.55) will verify proper invocations.
  If you skip any invocation, the workflow will HALT with an error.

  These sub-agent invocations are NON-NEGOTIABLE for database-related stories.
  </critical>

  <step n="1.5" goal="Pre-implementation schema validation for database stories">
    <critical>Validate database schema hasn't drifted since story context was generated</critical>

    <action>Detect if story involves database work:
      - Check story file for "### Database Schema Reference" section
      - If section exists: Set {{has_database_work}} = true
      - If section missing: Set {{has_database_work}} = false
    </action>

    <check if="{{has_database_work}} == false">
      <output>ℹ️ No database changes in this story - skipping schema validation</output>
      <action>Set {{schema_baseline}} = null and skip to next step</action>
    </check>

    <action>Extract database context from story context XML:
      1. Check if context file contains <databaseContext> section
      2. If found:
         - Extract <surveyMetadata> timestamp
         - Extract <completeSchemaJson> from CDATA
         - Store as {{baseline_schema}}
      3. If not found:
         - Set {{needs_baseline}} = true
    </action>

    <check if="{{needs_baseline}} == true">
      <output>⚠️ No baseline schema found in story context

This story has database changes but no schema baseline.
Context may have been generated before Schema Surveyor integration.

**Recommendation**: Re-run story-context to get fresh schema baseline.

**Options:**
1. Continue without validation (not recommended)
2. Halt and re-run story-context
      </output>
      <action>Ask user to choose option</action>
      <action>If user chooses halt: HALT with message "Re-run story-context before implementing"</action>
      <action>If user chooses continue: Set {{skip_schema_validation}} = true</action>
    </check>

    <check if="{{skip_schema_validation}} == true">
      <action>Skip schema validation and continue to next step</action>
    </check>

    <action>YOU MUST NOW INVOKE Schema Surveyor for pre-implementation validation. This is NOT optional.

      CRITICAL INSTRUCTION - READ CAREFULLY:
      1. Use the Task tool (not any other tool or method)
      2. Set subagent_type EXACTLY as: "bmm-schema-surveyor"
      3. Set model: "sonnet"
      4. Set description: "Pre-implementation validation for {{story_key}}"
      5. Include the COMPLETE schema-survey-request XML in the prompt parameter
      6. WAIT for the Schema Surveyor to return its response
      7. DO NOT simulate, fake, manually extract, or invent schema information
      8. DO NOT read tech specs or other docs to extract schema - use ONLY Schema Surveyor response
      9. DO NOT proceed to the next action until you have a REAL response from Schema Surveyor

      Example Task tool invocation (YOU MUST USE THIS EXACT PATTERN):

      <invoke name="Task">
        <parameter name="subagent_type">bmm-schema-surveyor</parameter>
        <parameter name="model">sonnet</parameter>
        <parameter name="description">Pre-implementation validation for {{story_key}}</parameter>
        <parameter name="prompt">Perform pre-implementation schema validation.

      <schema-survey-request>
        <validation_mode>true</validation_mode>
        <validation_type>pre_implementation</validation_type>
        <task>
          <id>{{story_key}}</id>
          <summary>Pre-implementation schema drift check</summary>
        </task>
        <affected_entities>
          {{#each tables_from_baseline}}
          <table>{{table_name}}</table>
          {{/each}}
        </affected_entities>
        <relationship_depth>1</relationship_depth>
        <requires_rls>false</requires_rls>
        <refresh_cache>true</refresh_cache>
        <generate_migration>false</generate_migration>
        <run_security_audit>false</run_security_audit>
        <compare_against>{{baseline_schema}}</compare_against>
      </schema-survey-request>
        </parameter>
      </invoke>

      WHY YOU MUST DO THIS:
      - Schema Surveyor runs in isolated 200k token sandbox
      - This prevents schema verbosity from polluting main workflow context
      - Schema Surveyor uses MCP tools to retrieve LIVE database schema
      - Manual extraction from docs causes hallucination (wrong table/column names)
      - Schema Surveyor returns structured output per schema-survey-contract.yaml

      After invocation completes, store the COMPLETE response as {{pre_implementation_validation_response}}.
    </action>

    <action>Parse Schema Surveyor validation response:
      - Extract validation_result: PASSED | WARNING | FAILED
      - Extract discrepancies array
      - Extract recommendations
    </action>

    <check if="validation_result == 'PASSED'">
      <output>✅ SCHEMA VALIDATION: PASSED

Database schema matches baseline from story context.
- Baseline timestamp: {{baseline_timestamp}}
- All affected tables unchanged
- No drift detected

Safe to proceed with implementation.
      </output>
      <action>Store {{schema_validated}} = true</action>
    </check>

    <check if="validation_result == 'WARNING'">
      <output>⚠️ SCHEMA VALIDATION: WARNING

Minor schema changes detected since story context was generated.

**Changes Detected:**
{{#each discrepancies}}
- {{table}}: {{change_description}}
{{/each}}

**Assessment**: Changes are minor and do not affect story requirements.

**Recommendation**: {{validation_recommendations}}

**Options:**
1. Continue with implementation (recommended)
2. Review changes and update story context
3. Halt for manual review
      </output>
      <action>Ask user to choose option</action>
      <action>Store {{schema_validated}} = true with warnings</action>
    </check>

    <check if="validation_result == 'FAILED'">
      <output>🚨 SCHEMA VALIDATION: FAILED

Significant schema drift detected since story context was generated.

**Critical Changes:**
{{#each discrepancies}}
- {{table}}: {{change_description}} ({{severity}})
{{/each}}

**Impact**: Story assumptions may be invalid. Implementation may fail or produce incorrect results.

**Immediate Actions Required:**
1. Review schema changes to understand what changed
2. Determine if story requirements are still valid
3. Update story acceptance criteria if needed
4. Re-run story-context to refresh schema baseline

**Recommendation**: HALT and review before proceeding.

**Options:**
1. Halt and review schema changes (STRONGLY RECOMMENDED)
2. Continue anyway (NOT RECOMMENDED - may cause bugs)
      </output>
      <action>Ask user to choose option</action>
      <action>If user chooses halt: HALT with message "Review schema drift before continuing"</action>
      <action>If user chooses continue:
        - Log warning in Dev Agent Record
        - Set {{schema_drift_override}} = true
        - Continue with extreme caution
      </action>
    </check>

    <action>Log validation result to Dev Agent Record → Debug Log:
      "🔍 Pre-implementation schema validation: {{validation_result}}
      Baseline: {{baseline_timestamp}}
      Tables validated: {{tables_checked}}
      {{#if discrepancies}}Discrepancies: {{discrepancy_count}}{{/if}}"
    </action>
  </step>

  <step n="1.55" goal="Validate Step 1.5 Schema Surveyor invocation">
    <check if="{{has_database_work}} == false OR {{skip_schema_validation}} == true">
      <action>Validation skipped (no database work or user chose to skip). Continue to Step 1.6.</action>
    </check>

    <check if="{{has_database_work}} == true AND {{pre_implementation_validation_response}} is empty">
      <output>🚨 VALIDATION FAILED: Schema Surveyor not invoked in Step 1.5

      Story requires database validation but no response found.
      You MUST invoke Schema Surveyor using Task tool in Step 1.5.
      DO NOT proceed without valid response.</output>
      <action>HALT workflow execution</action>
    </check>

    <check if="{{pre_implementation_validation_response}} exists">
      <output>✅ Step 1.5 validation passed - Schema Surveyor invoked successfully</output>
    </check>
  </step>

  <step n="1.6" goal="Detect review continuation and extract review context">
    <critical>Determine if this is a fresh start or continuation after code review</critical>

    <action>Check if "Senior Developer Review (AI)" section exists in the story file</action>
    <action>Check if "Review Follow-ups (AI)" subsection exists under Tasks/Subtasks</action>

    <check if="Senior Developer Review section exists">
      <action>Set review_continuation = true</action>
      <action>Extract from "Senior Developer Review (AI)" section:
        - Review outcome (Approve/Changes Requested/Blocked)
        - Review date
        - Total action items with checkboxes (count checked vs unchecked)
        - Severity breakdown (High/Med/Low counts)
      </action>
      <action>Count unchecked [ ] review follow-up tasks in "Review Follow-ups (AI)" subsection</action>
      <action>Store list of unchecked review items as {{pending_review_items}}</action>

      <output>⏯️ **Resuming Story After Code Review** ({{review_date}})

**Review Outcome:** {{review_outcome}}
**Action Items:** {{unchecked_review_count}} remaining to address
**Priorities:** {{high_count}} High, {{med_count}} Medium, {{low_count}} Low

**Strategy:** Will prioritize review follow-up tasks (marked [AI-Review]) before continuing with regular tasks.
      </output>
    </check>

    <check if="Senior Developer Review section does NOT exist">
      <action>Set review_continuation = false</action>
      <action>Set {{pending_review_items}} = empty</action>

      <output>🚀 **Starting Fresh Implementation**

Story: {{story_key}}
Context file: {{context_available}}
First incomplete task: {{first_task_description}}
      </output>
    </check>
  </step>

  <step n="1.7" goal="Mark story in-progress" tag="sprint-status">
    <action>Load the FULL file: {{output_folder}}/sprint-status.yaml</action>
    <action>Read all development_status entries to find {{story_key}}</action>
    <action>Get current status value for development_status[{{story_key}}]</action>

    <check if="current status == 'ready-for-dev'">
      <action>Update the story in the sprint status report to = "in-progress"</action>
      <output>🚀 Starting work on story {{story_key}}
Status updated: ready-for-dev → in-progress
      </output>
    </check>

    <check if="current status == 'in-progress'">
      <output>⏯️ Resuming work on story {{story_key}}
Story is already marked in-progress
      </output>
    </check>

    <check if="current status is neither ready-for-dev nor in-progress">
      <output>⚠️ Unexpected story status: {{current_status}}
Expected ready-for-dev or in-progress. Continuing anyway...
      </output>
    </check>
  </step>

  <step n="2" goal="Plan and implement task">
    <action>Review acceptance criteria and dev notes for the selected task</action>
    <action>Plan implementation steps and edge cases; write down a brief plan in Dev Agent Record → Debug Log</action>
  </step>

  <step n="2.1" goal="Pre-migration schema snapshot for migration tasks">
    <critical>Take baseline snapshot before writing migration SQL to ensure accuracy</critical>

    <action>Detect if current task involves database migrations:
      - Check task description for migration keywords: "migration", "ALTER TABLE", "CREATE TABLE", "ADD COLUMN", "schema"
      - Check if task references "Database Schema Reference" section in story
      - Check task subtasks for migration-related work
      - Set {{is_migration_task}} = true if ANY keyword found
    </action>

    <check if="{{is_migration_task}} == false">
      <output>ℹ️ Current task does not involve database migrations - skipping pre-migration snapshot</output>
      <action>Set {{pre_migration_snapshot}} = null and skip to task implementation</action>
    </check>

    <output>📸 MIGRATION TASK DETECTED

Current task involves database schema changes.
Taking pre-migration snapshot to establish baseline...
    </output>

    <action>Extract affected tables from task description and story Database Schema Reference:
      - Parse task description for table names
      - Extract tables from story's "Tables Affected" list
      - Store as {{migration_tables}}
    </action>

    <action>YOU MUST NOW INVOKE Schema Surveyor for pre-migration snapshot. This is NOT optional.

      CRITICAL INSTRUCTION - READ CAREFULLY:
      1. Use the Task tool (not any other tool or method)
      2. Set subagent_type EXACTLY as: "bmm-schema-surveyor"
      3. Set model: "sonnet"
      4. Set description: "Pre-migration snapshot for {{story_key}}-{{task_id}}"
      5. Include the COMPLETE schema-survey-request XML in the prompt parameter
      6. WAIT for the Schema Surveyor to return its response
      7. DO NOT simulate, fake, manually extract, or invent schema information
      8. DO NOT read tech specs or other docs to extract schema - use ONLY Schema Surveyor response
      9. DO NOT proceed to the next action until you have a REAL response from Schema Surveyor

      Example Task tool invocation (YOU MUST USE THIS EXACT PATTERN):

      <invoke name="Task">
        <parameter name="subagent_type">bmm-schema-surveyor</parameter>
        <parameter name="model">sonnet</parameter>
        <parameter name="description">Pre-migration snapshot for {{story_key}}-{{task_id}}</parameter>
        <parameter name="prompt">Take pre-migration schema snapshot.

      <schema-survey-request>
        <validation_mode>true</validation_mode>
        <validation_type>pre_migration_snapshot</validation_type>
        <task>
          <id>{{story_key}}-{{task_id}}</id>
          <summary>Pre-migration baseline for {{task_description}}</summary>
        </task>
        <affected_entities>
          {{#each migration_tables}}
          <table>{{table_name}}</table>
          {{/each}}
        </affected_entities>
        <relationship_depth>1</relationship_depth>
        <requires_rls>true</requires_rls>
        <refresh_cache>true</refresh_cache>
        <generate_migration>false</generate_migration>
        <run_security_audit>false</run_security_audit>
        <include_detailed_schema>true</include_detailed_schema>
        <store_as_baseline>true</store_as_baseline>
      </schema-survey-request>
        </parameter>
      </invoke>

      WHY YOU MUST DO THIS:
      - Schema Surveyor runs in isolated 200k token sandbox
      - This prevents schema verbosity from polluting main workflow context
      - Schema Surveyor uses MCP tools to retrieve LIVE database schema
      - Manual extraction from docs causes hallucination (wrong table/column names)
      - Schema Surveyor returns structured output per schema-survey-contract.yaml

      After invocation completes, store the COMPLETE response as {{pre_migration_snapshot_response}}.
    </action>

    <action>Parse Schema Surveyor snapshot response:
      - Extract detailed schema for each affected table:
        * Columns (name, type, nullable, default)
        * Indexes (name, definition)
        * Constraints (PK, FK, unique, check)
        * RLS policies (if any)
      - Store as {{pre_migration_snapshot}}
      - Store snapshot timestamp
    </action>

    <output>✅ PRE-MIGRATION SNAPSHOT COMPLETE

**Baseline captured for:**
{{#each migration_tables}}
- {{table_name}} ({{column_count}} columns, {{index_count}} indexes, {{constraint_count}} constraints)
{{/each}}

**Snapshot timestamp**: {{snapshot_timestamp}}

This baseline will be used to verify migrations after execution.

**Current State Summary:**
{{schema_summary}}
    </output>

    <action>Log snapshot to Dev Agent Record → Debug Log:
      "📸 Pre-migration snapshot taken
      Tables: {{migration_tables}}
      Timestamp: {{snapshot_timestamp}}
      Purpose: Baseline for migration verification"
    </action>

    <action>Store {{pre_migration_snapshot}} in memory for post-migration verification (Step 4.5)</action>
  </step>

  <step n="2.15" goal="Validate Step 2.1 Schema Surveyor invocation">
    <check if="{{is_migration_task}} == false">
      <action>Validation skipped (not a migration task). Continue to Step 2.2.</action>
    </check>

    <check if="{{is_migration_task}} == true AND {{pre_migration_snapshot_response}} is empty">
      <output>🚨 VALIDATION FAILED: Schema Surveyor not invoked in Step 2.1

      Migration task requires pre-migration snapshot but no response found.
      You MUST invoke Schema Surveyor using Task tool in Step 2.1.
      DO NOT proceed without valid snapshot.</output>
      <action>HALT workflow execution</action>
    </check>

    <check if="{{pre_migration_snapshot_response}} exists">
      <output>✅ Step 2.1 validation passed - Pre-migration snapshot captured</output>
    </check>
  </step>

  <step n="2.2" goal="Continue with task implementation">
    <action>Review acceptance criteria and dev notes for the selected task (continuation from Step 2)</action>
    <action>Implement the task COMPLETELY including all subtasks, critically following best practices, coding patterns and coding standards in this repo you have learned about from the story and context file or your own critical agent instructions</action>
    <action>Handle error conditions and edge cases appropriately</action>
    <action if="new or different than what is documented dependencies are needed">ASK user for approval before adding</action>
    <action if="3 consecutive implementation failures occur">HALT and request guidance</action>
    <action if="required configuration is missing">HALT: "Cannot proceed without necessary configuration files"</action>
    <critical>Do not stop after partial progress; continue iterating tasks until all ACs are satisfied and tested or a HALT condition triggers</critical>
    <critical>Do NOT propose to pause for review, stand-ups, or validation until Step 6 gates are satisfied</critical>
  </step>

  <step n="3" goal="Author comprehensive tests">
    <action>Create unit tests for business logic and core functionality introduced/changed by the task</action>
    <action>Add integration tests for component interactions where desired by test plan or story notes</action>
    <action>Include end-to-end tests for critical user flows where desired by test plan or story notes</action>
    <action>Cover edge cases and error handling scenarios noted in the test plan or story notes</action>
  </step>

  <step n="4" goal="Run validations and tests">
    <action>Determine how to run tests for this repo (infer or use {{run_tests_command}} if provided)</action>
    <action>Run all existing tests to ensure no regressions</action>
    <action>Run the new tests to verify implementation correctness</action>
    <action>Run linting and code quality checks if configured</action>
    <action>Validate implementation meets ALL story acceptance criteria; if ACs include quantitative thresholds (e.g., test pass rate), ensure they are met before marking complete</action>
    <action if="regression tests fail">STOP and fix before continuing, consider how current changes made broke regression</action>
    <action if="new tests fail">STOP and fix before continuing</action>
  </step>

  <step n="4.5" goal="Post-migration verification for migration tasks">
    <critical>Verify migrations executed correctly by comparing against pre-migration snapshot</critical>

    <check if="{{pre_migration_snapshot}} == null">
      <output>ℹ️ No pre-migration snapshot exists - skipping post-migration verification</output>
      <action>This task did not involve migrations, continue to next step</action>
    </check>

    <output>🔍 POST-MIGRATION VERIFICATION

Migrations have been applied. Verifying against baseline snapshot...
    </output>

    <action>Construct expected schema state:
      - Start with {{pre_migration_snapshot}} baseline
      - Apply expected changes from migration SQL:
        * New columns added
        * Indexes created
        * Constraints added
        * RLS policies created
      - Store as {{expected_schema_state}}
    </action>

    <action>YOU MUST NOW INVOKE Schema Surveyor for post-migration verification. This is NOT optional.

      CRITICAL INSTRUCTION - READ CAREFULLY:
      1. Use the Task tool (not any other tool or method)
      2. Set subagent_type EXACTLY as: "bmm-schema-surveyor"
      3. Set model: "sonnet"
      4. Set description: "Post-migration verification for {{story_key}}-{{task_id}}"
      5. Include the COMPLETE schema-survey-request XML in the prompt parameter
      6. WAIT for the Schema Surveyor to return its response
      7. DO NOT simulate, fake, manually extract, or invent schema information
      8. DO NOT read tech specs or other docs to extract schema - use ONLY Schema Surveyor response
      9. DO NOT proceed to the next action until you have a REAL response from Schema Surveyor

      Example Task tool invocation (YOU MUST USE THIS EXACT PATTERN):

      <invoke name="Task">
        <parameter name="subagent_type">bmm-schema-surveyor</parameter>
        <parameter name="model">sonnet</parameter>
        <parameter name="description">Post-migration verification for {{story_key}}-{{task_id}}</parameter>
        <parameter name="prompt">Verify post-migration schema state.

      <schema-survey-request>
        <validation_mode>true</validation_mode>
        <validation_type>post_migration_verification</validation_type>
        <task>
          <id>{{story_key}}-{{task_id}}-verify</id>
          <summary>Verify migrations for {{task_description}}</summary>
        </task>
        <affected_entities>
          {{#each migration_tables}}
          <table>{{table_name}}</table>
          {{/each}}
        </affected_entities>
        <relationship_depth>1</relationship_depth>
        <requires_rls>true</requires_rls>
        <refresh_cache>true</refresh_cache>
        <generate_migration>false</generate_migration>
        <run_security_audit>true</run_security_audit>
        <compare_against>{{pre_migration_snapshot}}</compare_against>
        <expected_state>{{expected_schema_state}}</expected_state>
        <verify_rls_policies>true</verify_rls_policies>
        <verify_indexes>true</verify_indexes>
      </schema-survey-request>
        </parameter>
      </invoke>

      WHY YOU MUST DO THIS:
      - Schema Surveyor runs in isolated 200k token sandbox
      - This prevents schema verbosity from polluting main workflow context
      - Schema Surveyor uses MCP tools to retrieve LIVE database schema
      - Manual extraction from docs causes hallucination (wrong table/column names)
      - Schema Surveyor returns structured output per schema-survey-contract.yaml

      After invocation completes, store the COMPLETE response as {{post_migration_verification_response}}.
    </action>

    <action>Parse Schema Surveyor verification response:
      - Extract validation_result: PASSED | FAILED
      - Extract checks_performed array (each check with result)
      - Extract discrepancies array (if any)
      - Extract recommendations
    </action>

    <check if="validation_result == 'PASSED'">
      <output>✅ POST-MIGRATION VERIFICATION: PASSED

All migrations executed successfully!

**Verification Results:**
{{#each checks_performed}}
✅ {{check_name}}: {{result}}
   Expected: {{expected}}
   Actual: {{actual}}
{{/each}}

**Summary:**
- All columns created: ✅
- All indexes created: ✅
- All constraints added: ✅
- All RLS policies applied: ✅
- Schema matches expected state: ✅

Migration task completed successfully.
      </output>

      <action>Log success to Dev Agent Record → Completion Notes:
        "✅ Migration verified: All schema changes applied correctly
        Tables affected: {{migration_tables}}
        Verification timestamp: {{verification_timestamp}}"
      </action>
    </check>

    <check if="validation_result == 'FAILED'">
      <output>❌ POST-MIGRATION VERIFICATION: FAILED

Migration execution issues detected!

**Failed Checks:**
{{#each discrepancies}}
❌ {{check_name}}: {{result}}
   Expected: {{expected}}
   Actual: {{actual}}
   Issue: {{issue_description}}
{{/each}}

**Possible Causes:**
1. Migration SQL had errors and partially failed
2. Migration file wasn't executed
3. Database permissions issue
4. Constraint conflicts prevented creation

**Immediate Actions Required:**
1. Review migration execution logs
2. Check database for error messages
3. Verify migration file was applied
4. Fix issues and re-run migration

**CRITICAL**: DO NOT proceed to next task until migrations are verified.
      </output>

      <action>Log failure to Dev Agent Record → Debug Log:
        "❌ Migration verification FAILED
        Failed checks: {{failed_check_count}}
        See discrepancies above
        HALTING until resolved"
      </action>

      <action>HALT with message: "Migration verification failed - fix migration issues before proceeding"</action>
    </check>

    <action>Run security audit if RLS policies were part of migration:
      - Check verification response for security_audit section
      - If critical RLS issues found: HALT
      - If high/medium issues: WARN but allow continue with user confirmation
    </action>

    <check if="security_audit contains critical issues">
      <output>🚨 CRITICAL SECURITY ISSUES DETECTED

Migration created security vulnerabilities!

**Critical Issues:**
{{#each security_audit.critical}}
- {{type}}: {{table}} - {{issue}}
  Remediation: {{remediation_url}}
{{/each}}

**IMMEDIATE ACTION REQUIRED**: Fix RLS policies before proceeding.
      </output>

      <action>HALT with message: "Fix critical security issues in migration"</action>
    </check>

    <action>Clear {{pre_migration_snapshot}} from memory (no longer needed after verification)</action>
  </step>

  <step n="4.55" goal="Validate Step 4.5 Schema Surveyor invocation">
    <check if="{{pre_migration_snapshot}} == null">
      <action>Validation skipped (not a migration task). Continue to Step 5.</action>
    </check>

    <check if="{{pre_migration_snapshot}} != null AND {{post_migration_verification_response}} is empty">
      <output>🚨 VALIDATION FAILED: Schema Surveyor not invoked in Step 4.5

      Migration task requires post-migration verification but no response found.
      You MUST invoke Schema Surveyor using Task tool in Step 4.5.
      DO NOT proceed without valid verification.</output>
      <action>HALT workflow execution</action>
    </check>

    <check if="{{post_migration_verification_response}} exists">
      <output>✅ Step 4.5 validation passed - Post-migration verification complete</output>
    </check>
  </step>

  <step n="5" goal="Mark task complete, track review resolutions, and update story">
    <critical>If task is a review follow-up, must mark BOTH the task checkbox AND the corresponding action item in the review section</critical>

    <action>Check if completed task has [AI-Review] prefix (indicates review follow-up task)</action>

    <check if="task is review follow-up">
      <action>Extract review item details (severity, description, related AC/file)</action>
      <action>Add to resolution tracking list: {{resolved_review_items}}</action>

      <!-- Mark task in Review Follow-ups section -->
      <action>Mark task checkbox [x] in "Tasks/Subtasks → Review Follow-ups (AI)" section</action>

      <!-- CRITICAL: Also mark corresponding action item in review section -->
      <action>Find matching action item in "Senior Developer Review (AI) → Action Items" section by matching description</action>
      <action>Mark that action item checkbox [x] as resolved</action>

      <action>Add to Dev Agent Record → Completion Notes: "✅ Resolved review finding [{{severity}}]: {{description}}"</action>
    </check>

    <action>ONLY mark the task (and subtasks) checkbox with [x] if ALL tests pass and validation succeeds</action>
    <action>Update File List section with any new, modified, or deleted files (paths relative to repo root)</action>
    <action>Add completion notes to Dev Agent Record if significant changes were made (summarize intent, approach, and any follow-ups)</action>

    <check if="review_continuation == true and {{resolved_review_items}} is not empty">
      <action>Count total resolved review items in this session</action>
      <action>Add Change Log entry: "Addressed code review findings - {{resolved_count}} items resolved (Date: {{date}})"</action>
    </check>

    <action>Save the story file</action>
    <action>Determine if more incomplete tasks remain</action>
    <action if="more tasks remain"><goto step="2">Next task</goto></action>
    <action if="no tasks remain"><goto step="6">Completion</goto></action>
  </step>

  <step n="6" goal="Story completion and mark for review" tag="sprint-status">
    <action>Verify ALL tasks and subtasks are marked [x] (re-scan the story document now)</action>
    <action>Run the full regression suite (do not skip)</action>
    <action>Confirm File List includes every changed file</action>
    <action>Execute story definition-of-done checklist, if the story includes one</action>
    <action>Update the story Status to: review</action>

    <!-- Mark story ready for review -->
    <action>Load the FULL file: {{output_folder}}/sprint-status.yaml</action>
    <action>Find development_status key matching {{story_key}}</action>
    <action>Verify current status is "in-progress" (expected previous state)</action>
    <action>Update development_status[{{story_key}}] = "review"</action>
    <action>Save file, preserving ALL comments and structure including STATUS DEFINITIONS</action>

    <check if="story key not found in file">
      <output>⚠️ Story file updated, but sprint-status update failed: {{story_key}} not found

Story is marked Ready for Review in file, but sprint-status.yaml may be out of sync.
      </output>
    </check>

    <action if="any task is incomplete">Return to step 1 to complete remaining work (Do NOT finish with partial progress)</action>
    <action if="regression failures exist">STOP and resolve before completing</action>
    <action if="File List is incomplete">Update it before completing</action>
  </step>

  <step n="6.5" goal="Final database acceptance criteria validation">
    <critical>Comprehensive verification of ALL database-related acceptance criteria before marking story complete</critical>

    <action>Check if story has database changes:
      - Look for "### Database Schema Reference" section in story file
      - If not found: Set {{has_database_acs}} = false and skip to next step
      - If found: Set {{has_database_acs}} = true
    </action>

    <check if="{{has_database_acs}} == false">
      <output>ℹ️ No database acceptance criteria - skipping final database validation</output>
      <action>Continue to completion communication</action>
    </check>

    <output>📋 FINAL DATABASE ACCEPTANCE CRITERIA VALIDATION

Running comprehensive database validation before story completion...
    </output>

    <action>Extract all database-related acceptance criteria from story:
      - Parse "Acceptance Criteria" section
      - Identify ACs related to database (keywords: table, column, migration, RLS, FK, index)
      - Store as {{database_acs}} with AC numbers
    </action>

    <action>Extract affected tables from story's Database Schema Reference:
      - Read "Tables Affected" list
      - Store as {{final_validation_tables}}
    </action>

    <action>Invoke Schema Surveyor for final AC validation:
      Construct comprehensive validation request:
      ```xml
      <schema-survey-request>
        <validation_mode>true</validation_mode>
        <validation_type>final_ac_validation</validation_type>
        <task>
          <id>{{story_key}}-final</id>
          <summary>Final validation for {{story_title}}</summary>
          <description>Comprehensive check of all database acceptance criteria</description>
        </task>
        <affected_entities>
          {{#each final_validation_tables}}
          <table>{{table_name}}</table>
          {{/each}}
        </affected_entities>
        <acceptance_criteria>
          {{#each database_acs}}
          <ac id="{{ac_number}}">{{ac_description}}</ac>
          {{/each}}
        </acceptance_criteria>
        <relationship_depth>2</relationship_depth>
        <requires_rls>true</requires_rls>
        <refresh_cache>true</refresh_cache>
        <generate_migration>false</generate_migration>
        <run_security_audit>true</run_security_audit>
        <verify_performance_recommendations>true</verify_performance_recommendations>
      </schema-survey-request>
      ```

      Invoke using Task tool:
      - subagent_type: "bmm-schema-surveyor"
      - model: "sonnet"
      - prompt: "Perform final database AC validation. {{final_validation_request_xml}}"
    </action>

    <action>Parse Schema Surveyor final validation response:
      - Extract ac_validation_results array (per AC)
      - Extract security_audit results
      - Extract performance_validation results
      - Extract overall validation_result: PASSED | FAILED
    </action>

    <check if="validation_result == 'PASSED'">
      <output>✅ FINAL DATABASE VALIDATION: PASSED

All database acceptance criteria verified!

**Acceptance Criteria Results:**
{{#each ac_validation_results}}
✅ AC #{{ac_number}}: {{ac_description}}
   Status: {{result}}
   {{#if verification_details}}
   Details: {{verification_details}}
   {{/if}}
{{/each}}

**Security Audit:**
{{#if security_audit}}
{{#if security_audit.critical.length > 0}}
❌ Critical Issues: {{security_audit.critical.length}} - SEE BELOW
{{else}}
✅ No critical security issues
{{/if}}
{{#if security_audit.high.length > 0}}
⚠️ High Priority Issues: {{security_audit.high.length}}
{{else}}
✅ No high priority security issues
{{/if}}
{{#if security_audit.medium.length > 0}}
⚠️ Medium Priority Issues: {{security_audit.medium.length}}
{{else}}
✅ No medium priority security issues
{{/if}}
{{/if}}

**Performance Validation:**
{{#each performance_validation}}
{{#if status == 'PASSED'}}✅{{else}}⚠️{{/if}} {{check_name}}: {{result}}
{{/each}}

**Overall Assessment**: Story meets all database requirements ✅
      </output>

      <action>Log final validation to Dev Agent Record → Completion Notes:
        "✅ Final database AC validation: PASSED
        All {{database_acs.length}} database ACs verified
        Security: {{security_summary}}
        Performance: {{performance_summary}}
        Validation timestamp: {{validation_timestamp}}"
      </action>
    </check>

    <check if="validation_result == 'FAILED'">
      <output>❌ FINAL DATABASE VALIDATION: FAILED

Story CANNOT be marked complete - database acceptance criteria not met!

**Failed Acceptance Criteria:**
{{#each ac_validation_results}}
{{#if result == 'FAILED'}}
❌ AC #{{ac_number}}: {{ac_description}}
   Issue: {{issue}}
   Expected: {{expected}}
   Actual: {{actual}}
   Action Required: {{action_required}}
{{/if}}
{{/each}}

**CRITICAL**: Fix all failed ACs before marking story complete.
      </output>

      <action>Log failure to Dev Agent Record → Debug Log:
        "❌ Final database AC validation FAILED
        Failed ACs: {{failed_ac_count}}
        Story CANNOT be completed until issues resolved"
      </action>

      <action>HALT with message: "Fix failed database acceptance criteria before marking story complete"</action>
    </check>

    <check if="security_audit contains critical or high issues">
      <output>🚨 SECURITY ISSUES DETECTED IN FINAL VALIDATION

**Critical Issues ({{critical_count}}):**
{{#each security_audit.critical}}
- {{type}}: {{table}} - {{issue}}
  Remediation: {{remediation_url}}
  Priority: CRITICAL - MUST FIX
{{/each}}

**High Priority Issues ({{high_count}}):**
{{#each security_audit.high}}
- {{type}}: {{table}} - {{issue}}
  Remediation: {{remediation_url}}
  Priority: HIGH - SHOULD FIX
{{/each}}

**Assessment**:
{{#if critical_count > 0}}
- Critical issues MUST be fixed before completing story
{{/if}}
{{#if high_count > 0}}
- High priority issues should be addressed (can be deferred with user approval)
{{/if}}

**Options:**
1. Fix all issues now (recommended)
2. Fix critical only, defer high priority issues
3. Add follow-up story for high priority issues
      </output>

      <action>If critical issues exist: HALT with message "Fix critical security issues before completing"</action>
      <action>If only high/medium issues exist: Ask user whether to fix now or defer</action>
    </check>

    <check if="performance_validation has warnings">
      <output>⚠️ PERFORMANCE RECOMMENDATIONS

**Performance Observations:**
{{#each performance_validation}}
{{#if status == 'WARNING'}}
⚠️ {{check_name}}: {{result}}
   Recommendation: {{recommendation}}
   Impact: {{impact}}
{{/if}}
{{/each}}

**Note**: These are recommendations, not blockers.
Performance optimizations can be addressed now or in future stories.
      </output>

      <action>Log performance warnings to Dev Agent Record → Completion Notes:
        "⚠️ Performance recommendations:
        {{performance_warnings_summary}}
        Consider addressing in future optimization story"
      </action>
    </check>

    <output>

✅ FINAL DATABASE VALIDATION COMPLETE

Story is ready for review with verified database implementation.
    </output>
  </step>

  <step n="7" goal="Completion communication and user support">
    <action>Optionally run the workflow validation task against the story using {project-root}/bmad/core/tasks/validate-workflow.xml</action>
    <action>Prepare a concise summary in Dev Agent Record → Completion Notes</action>

    <action>Communicate to {user_name} that story implementation is complete and ready for review</action>
    <action>Summarize key accomplishments: story ID, story key, title, key changes made, tests added, files modified</action>
    <action>Provide the story file path and current status (now "review", was "in-progress")</action>

    <action>Based on {user_skill_level}, ask if user needs any explanations about:
      - What was implemented and how it works
      - Why certain technical decisions were made
      - How to test or verify the changes
      - Any patterns, libraries, or approaches used
      - Anything else they'd like clarified
    </action>

    <check if="user asks for explanations">
      <action>Provide clear, contextual explanations tailored to {user_skill_level}</action>
      <action>Use examples and references to specific code when helpful</action>
    </check>

    <action>Once explanations are complete (or user indicates no questions), suggest logical next steps</action>
    <action>Common next steps to suggest (but allow user flexibility):
      - Review the implemented story yourself and test the changes
      - Verify all acceptance criteria are met
      - Ensure deployment readiness if applicable
      - Run `code-review` workflow for peer review
      - Check sprint-status.yaml to see project progress
    </action>
    <action>Remain flexible - allow user to choose their own path or ask for other assistance</action>
  </step>

</workflow>
```
