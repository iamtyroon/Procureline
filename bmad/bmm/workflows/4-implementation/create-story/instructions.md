# Create Story - Workflow Instructions (Spec-compliant, non-interactive by default)

````xml
<critical>The workflow execution engine is governed by: {project_root}/bmad/core/tasks/workflow.xml</critical>
<critical>You MUST have already loaded and processed: {installed_path}/workflow.yaml</critical>
<critical>Generate all documents in {document_output_language}</critical>
<critical>This workflow creates or updates the next user story from epics/PRD and architecture context, saving to the configured stories directory and optionally invoking Story Context.</critical>
<critical>DOCUMENT OUTPUT: Concise, technical, actionable story specifications. Use tables/lists for acceptance criteria and tasks.</critical>

## 📚 Document Discovery - Selective Epic Loading

**Strategy**: This workflow needs only ONE specific epic and its stories, not all epics. This provides huge efficiency gains when epics are sharded.

**Epic Discovery Process (SELECTIVE OPTIMIZATION):**

1. **Determine which epic** you need (epic_num from story context - e.g., story "3-2-feature-name" needs Epic 3)
2. **Check for sharded version**: Look for `epics/index.md`
3. **If sharded version found**:
   - Read `index.md` to understand structure
   - **Load ONLY `epic-{epic_num}.md`** (e.g., `epics/epic-3.md` for Epic 3)
   - DO NOT load all epic files - only the one needed!
   - This is the key efficiency optimization for large multi-epic projects
4. **If whole document found**: Load the complete `epics.md` file and extract the relevant epic

**Other Documents (prd, architecture, ux-design) - Full Load:**

1. **Search for whole document first** - Use fuzzy file matching
2. **Check for sharded version** - If whole document not found, look for `{doc-name}/index.md`
3. **If sharded version found**:
   - Read `index.md` to understand structure
   - Read ALL section files listed in the index
   - Treat combined content as single document
4. **Brownfield projects**: The `document-project` workflow creates `{output_folder}/docs/index.md`

**Priority**: If both whole and sharded versions exist, use the whole document.

**UX-Heavy Projects**: Always check for ux-design documentation as it provides critical context for UI-focused stories.

<workflow>

  <step n="1" goal="Load config and initialize">
    <action>Resolve variables from config_source: story_dir (dev_story_location), output_folder, user_name, communication_language. If story_dir missing and {{non_interactive}} == false → ASK user to provide a stories directory and update variable. If {{non_interactive}} == true and missing, HALT with a clear message.</action>
    <action>Create {{story_dir}} if it does not exist</action>
    <action>Resolve installed component paths from workflow.yaml: template, instructions, validation</action>
    <action>Resolve recommended inputs if present: epics_file, prd_file, architecture_file</action>
  </step>

  <step n="2" goal="Discover and load source documents">
    <critical>PREVIOUS STORY CONTINUITY: Essential for maintaining context and learning from prior development</critical>

    <action>Find the previous completed story to extract dev agent learnings and review findings:
      1. Load {{output_folder}}/sprint-status.yaml COMPLETELY
      2. Find current {{story_key}} in development_status section
      3. Identify the story entry IMMEDIATELY ABOVE current story (previous row in file order)
      4. If previous story exists:
         - Extract {{previous_story_key}}
         - Check previous story status (done, in-progress, review, etc.)
         - If status is "done", "review", or "in-progress" (has some completion):
           * Construct path: {{story_dir}}/{{previous_story_key}}.md
           * Load the COMPLETE previous story file
           * Parse ALL sections comprehensively:

             A) Dev Agent Record → Completion Notes List:
                - New patterns/services created (to reuse, not recreate)
                - Architectural deviations or decisions made
                - Technical debt deferred to future stories
                - Warnings or recommendations for next story
                - Interfaces/methods created for reuse

             B) Dev Agent Record → Debug Log References:
                - Issues encountered and solutions
                - Gotchas or unexpected challenges
                - Workarounds applied

             C) Dev Agent Record → File List:
                - Files created (NEW) - understand new capabilities
                - Files modified (MODIFIED) - track evolving components
                - Files deleted (DELETED) - removed functionality

             D) Dev Notes:
                - Any "future story" notes or TODOs
                - Patterns established
                - Constraints discovered

             E) Senior Developer Review (AI) section (if present):
                - Review outcome (Approve/Changes Requested/Blocked)
                - Unresolved action items (unchecked [ ] items)
                - Key findings that might affect this story
                - Architectural concerns raised

             F) Senior Developer Review → Action Items (if present):
                - Check for unchecked [ ] items still pending
                - Note any systemic issues that apply to multiple stories

             G) Review Follow-ups (AI) tasks (if present):
                - Check for unchecked [ ] review tasks still pending
                - Determine if they're epic-wide concerns

             H) Story Status:
                - If "review" or "in-progress" - incomplete, note what's pending
                - If "done" - confirmed complete
           * Store ALL findings as {{previous_story_learnings}} with structure:
             - new_files: [list]
             - modified_files: [list]
             - new_services: [list with descriptions]
             - architectural_decisions: [list]
             - technical_debt: [list]
             - warnings_for_next: [list]
             - review_findings: [list if review exists]
             - pending_items: [list of unchecked action items]
         - If status is "backlog" or "drafted":
           * Set {{previous_story_learnings}} = "Previous story not yet implemented"
      5. If no previous story exists (first story in epic):
         - Set {{previous_story_learnings}} = "First story in epic - no predecessor context"
    </action>

    <action>Discover Tech Spec for Epic {{epic_num}} with sharded fallback support:

      **Tech Spec Discovery Process (SHARDED-AWARE):**

      0. **Convert epic number to letter** (for folder naming):
         - Epic 1 → 'a', Epic 2 → 'b', Epic 3 → 'c', etc.
         - Store as {{epic_letter}} (lowercase)
         - Example: epic_num=2 → epic_letter='b'

      1. **Search for WHOLE document first** (preferred):
         - Pattern: `tech-spec-epic-{{epic_num}}.md` OR `tech-spec-epic-{{epic_letter}}.md`
         - Search directory: {{tech_spec_search_dir}} (typically {{output_folder}})
         - Use fuzzy matching if exact name not found
         - Try both numbered and lettered filenames (e.g., tech-spec-epic-2.md, tech-spec-epic-b.md)
         - If multiple matches, pick most recent by modified time

      2. **If whole document NOT found, check for SHARDED version**:
         - Pattern: `tech-spec-epic-{{epic_letter}}/index.md` (e.g., tech-spec-epic-b/index.md)
         - Look in {{output_folder}}/tech-spec-epic-{{epic_letter}}/
         - CRITICAL: Use epic LETTER not number (e.g., 'b' not '2')
         - If index.md exists, proceed with sharded loading

      3. **If SHARDED version found**:
         - Read `index.md` to understand document structure
         - Parse index to extract list of section files (typically markdown files listed in index)
         - Read ALL section files referenced in index (full content, no truncation)
         - Combine all section contents in order to form complete tech spec
         - Store combined content as {{tech_spec_content}}
         - Store index path for citation: `tech-spec-epic-{{epic_letter}}/index.md` (e.g., tech-spec-epic-b/index.md)

      4. **If NEITHER found**:
         - Check for legacy patterns: `tech-spec.md`, `technical-specification.md`
         - If still not found: Set {{tech_spec_file}} = null and log warning
         - Story can still proceed with epics + PRD as fallback sources

      **Priority**: Whole document > Sharded document > Legacy patterns > Epics fallback

      **Result**: Store complete tech spec content in {{tech_spec_content}} and path in {{tech_spec_file}}
    </action>
    <action>Build a prioritized document set for this epic:
      1) tech_spec_file (epic-scoped)
      2) epics_file (acceptance criteria and breakdown)
      3) prd_file (business requirements and constraints)
      4) architecture_file (architecture constraints)
      5) Architecture docs under docs/ and output_folder/: tech-stack.md, unified-project-structure.md, coding-standards.md, testing-strategy.md, backend-architecture.md, frontend-architecture.md, data-models.md, database-schema.md, rest-api-spec.md, external-apis.md (include if present)
    </action>
    <action>READ COMPLETE FILES for all items found in the prioritized set. Store content and paths for citation.</action>
  </step>

  <step n="3" goal="Find next backlog story to draft" tag="sprint-status">
    <critical>MUST read COMPLETE sprint-status.yaml file from start to end to preserve order</critical>
    <action>Load the FULL file: {{output_folder}}/sprint-status.yaml</action>
    <action>Read ALL lines from beginning to end - do not skip any content</action>
    <action>Parse the development_status section completely to understand story order</action>

    <action>Find the FIRST story (by reading in order from top to bottom) where:
      - Key matches pattern: number-number-name (e.g., "1-2-user-auth")
      - NOT an epic key (epic-X) or retrospective (epic-X-retrospective)
      - Status value equals "backlog"
    </action>

    <check if="no backlog story found">
      <output>📋 No backlog stories found in sprint-status.yaml

All stories are either already drafted or completed.

**Options:**
1. Run sprint-planning to refresh story tracking
2. Load PM agent and run correct-course to add more stories
3. Check if current sprint is complete
      </output>
      <action>HALT</action>
    </check>

    <action>Extract from found story key (e.g., "1-2-user-authentication"):
      - epic_num: first number before dash (e.g., "1")
      - story_num: second number after first dash (e.g., "2")
      - story_title: remainder after second dash (e.g., "user-authentication")
    </action>
    <action>Set {{story_id}} = "{{epic_num}}.{{story_num}}"</action>
    <action>Store story_key for later use (e.g., "1-2-user-authentication")</action>

    <action>Verify story is enumerated in {{epics_file}}. If not found, HALT with message:</action>
    <action>"Story {{story_key}} not found in epics.md. Please load PM agent and run correct-course to sync epics, then rerun create-story."</action>

    <action>Check if story file already exists at expected path in {{story_dir}}</action>
    <check if="story file exists">
      <output>ℹ️ Story file already exists: {{story_file_path}}

Will update existing story file rather than creating new one.
      </output>
      <action>Set update_mode = true</action>
    </check>
  </step>

  <step n="3.5" goal="Detect platform and load UX specification indices">
    <action>Determine platform type from epic context and story scope:
      - Check epic title/description for platform keywords:
        * Mobile indicators: "mobile", "flutter", "dart", "app", "ios", "android"
        * Web indicators: "web", "next.js", "react", "dashboard", "admin", "portal"
      - Check epic frontmatter for explicit platform declaration: `platform: mobile` or `platform: web`
      - Precedence: Explicit declaration > keyword matching > ask user if ambiguous
      - May be both platforms if story spans mobile and web (mark as "cross-platform")
      - Set {{platform}} variable: "mobile", "web", or "cross-platform"
    </action>

    <action>Locate and read UX specification indices (canonical paths):
      - If {{platform}} includes "mobile": Read `docs/09-UX Spec/mobile/mobilespec_sharded/index.md` (if exists)
      - If {{platform}} includes "web": Read `docs/09-UX Spec/web/webspec_sharded/index.md` (if exists)
      - CRITICAL: Use exact path "docs/09-UX Spec" (NO space after hyphen)
      - If neither index found: Set {{ux_specs_available}} = false and skip remaining UX actions
      - If indices found: Set {{ux_specs_available}} = true and parse screen listings
    </action>

    <template-output file="{default_output_file}">platform_detection_summary</template-output>
  </step>

  <step n="4" goal="Extract requirements and derive story statement">
    <action>From tech_spec_file (preferred) or epics_file: extract epic {{epic_num}} title/summary, acceptance criteria for the next story, and any component references. If not present, fall back to PRD sections mapping to this epic/story.</action>
    <action>From architecture and architecture docs: extract constraints, patterns, component boundaries, and testing guidance relevant to the extracted ACs. ONLY capture information that directly informs implementation of this story.</action>
    <action>Derive a clear user story statement (role, action, benefit) grounded strictly in the above sources. If ambiguous and {{non_interactive}} == false → ASK user to clarify. If {{non_interactive}} == true → generate the best grounded statement WITHOUT inventing domain facts.</action>
    <template-output file="{default_output_file}">requirements_context_summary</template-output>
  </step>

  <step n="4.5" goal="Match story to relevant UX screens and load specifications">
    <check if="{{ux_specs_available}} == false">
      <action>Set {{ux_specs}} = "No UX specifications available for this project" and skip to next step</action>
    </check>

    <action>Match story to relevant screens using multi-strategy approach:
      PRIORITY 1 - Check epic for explicit screen references:
      1. Parse epic's "UX Specifications Reference" section (if present)
      2. Extract screen numbers mentioned for this specific story
      3. If explicit screens found: Use ONLY these (skip keyword matching)

      PRIORITY 2 - Keyword-based auto-discovery (fallback if no explicit references):
      1. Extract keywords from {{story_title}} and epic context
         - Apply stemming: "annotate" → "annotation", "capturing" → "capture"
         - Generate synonyms: "photo" → ["photo", "image", "picture", "camera"]
      2. Search index files for matching screen numbers/names
         - Use fuzzy matching (Levenshtein distance ≤3 for screen names)
         - Match screen number patterns: "5.11", "5.11A", "5-11"
      3. Rank matches by relevance (title match > description match)
      4. Select top 1-3 most relevant screens

      PRIORITY 3 - Cross-platform stories:
      1. If {{platform}} == "cross-platform": Load screens from BOTH mobile and web
      2. Clearly label which screens are mobile vs web in output

      NOTE: Some stories may have no matching UX specs (infrastructure, backend-only) - this is normal
    </action>

    <check if="no matching screens found">
      <action>Set {{ux_specs}} = "No matching UX specifications for this story (infrastructure/backend-only)" and continue</action>
    </check>

    <action>For each matched screen:
      1. Construct full file path (canonical format):
         - Mobile: `docs/09-UX Spec/mobile/mobilespec_sharded/detailed-screen-specifications/[screen-file].md`
         - Web: `docs/09-UX Spec/web/webspec_sharded/detailed-screen-specifications/[screen-file].md`
         - CRITICAL: No space after hyphen in "09-UX Spec"
      2. Verify file exists before attempting to read (use file existence check)
      3. Read COMPLETE screen specification file (all sections, no truncation)
      4. Extract key information:
         - Screen number and name (from filename and header)
         - Primary UI elements and components (3-5 key points)
         - User interactions and workflows
         - Validation rules and error states
         - Referenced reusable widgets/components
      5. Store as structured {{ux_specs}} data with metadata
    </action>

    <action>Check for reusable component libraries:
      - If {{platform}} includes "mobile": Check `docs/09-UX Spec/mobile/mobilespec_sharded/reusable-widget-library-flutter.md`
      - If {{platform}} includes "web": Check `docs/09-UX Spec/web/webspec_sharded/reusable-component-library.md`
      - If found and referenced by matched screens:
        * Read COMPLETE file
        * Extract sections relevant to matched screens
        * Store component names and descriptions
    </action>

    <action>Format {{ux_specs}} for inclusion in story document:
      CRITICAL: Populate "### UX Specifications Reference" section with EXPLICIT file paths

      For each screen:
      - List item format: "- Screen X.Y: Screen Name - docs/09-UX Spec/[platform]/mobilespec_sharded/detailed-screen-specifications/[filename].md"
      - Use PROJECT-RELATIVE paths (no absolute paths)
      - Include full path to specific screen file

      For reusable components (if any):
      - List item format: "- Reusable [Widgets/Components]: ComponentNames - docs/09-UX Spec/[platform]/[spec]_sharded/reusable-[widget|component]-library-[flutter|].md"
      - Include comma-separated list of specific components used

      After explicit references, add auto-discovered summary subsection with key details (3-5 bullet points per screen)
    </action>

    <template-output file="{default_output_file}">ux_specifications_summary</template-output>
  </step>

  <critical>⚠️ UPCOMING MANDATORY SUB-AGENT INVOCATION

  The next step (4.75) requires invoking the Schema Surveyor sub-agent for database-related stories.

  **YOU MUST:**
  - Use the Task tool to invoke "bmm-schema-surveyor"
  - Wait for the sub-agent to complete its analysis
  - Receive and parse the structured response
  - Store the response in {{schema_survey_json}}

  **YOU MUST NOT:**
  - Skip the invocation
  - Manually extract schema information from tech specs or other documents
  - Simulate, fake, or invent the response
  - Proceed without a valid response from Schema Surveyor

  **Validation:**
  Step 4.76 will validate that you properly invoked Schema Surveyor.
  If you skip this step, the workflow will HALT with an error.

  This sub-agent invocation is NON-NEGOTIABLE for database-related stories.
  </critical>

  <step n="4.75" goal="Database schema survey for database-related stories">
    <action>Determine if story involves database work:
      - Check {{story_title}} and epic context for database keywords:
        * Tables/entities: "table", "schema", "database", "model", "entity", "migration"
        * CRUD operations: "create", "read", "update", "delete", "insert", "select"
        * Database features: "FK", "foreign key", "index", "constraint", "RLS", "policy"
        * Supabase-specific: "supabase", "postgres", "SQL", "query"
      - Check acceptance criteria from tech_spec for database changes
      - Check previous story learnings for schema changes
      - Set {{requires_database_survey}} = true if ANY keyword match found
      - Set {{requires_database_survey}} = false for pure frontend/UI-only stories
    </action>

    <check if="{{requires_database_survey}} == false">
      <action>Set {{schema_survey}} = "No database changes required for this story" and skip to next step</action>
    </check>

    <action>Extract database-related information from requirements:
      1. Identify affected tables from:
         - Epic/story acceptance criteria mentioning table names
         - Tech spec database sections
         - Architecture data models documentation
         - Previous story schema changes
      2. Extract keywords for fuzzy table matching:
         - Nouns from story title (e.g., "equipment", "inspection", "user")
         - Entities mentioned in ACs
      3. Determine relationship depth needed:
         - Simple story (single table): depth = 0
         - Related tables (FK references): depth = 1
         - Complex relationships (multi-level FKs): depth = 2
      4. Check if RLS/security is relevant:
         - Auth-related stories: requires_rls = true
         - Public data access: requires_rls = false
         - Multi-tenant features: requires_rls = true
      5. Determine if migration generation needed:
         - Schema changes (ALTER TABLE, CREATE TABLE): generate_migration = true
         - Query-only stories: generate_migration = false
      6. Store as {{database_context}} for Schema Surveyor invocation
    </action>

    <action>Construct Schema Surveyor invocation XML:
      ```xml
      <schema-survey-request>
        <task>
          <id>{{story_key}}</id>
          <summary>{{story_title}}</summary>
          <description>{{extracted_requirements_summary}}</description>
        </task>
        <affected_entities>
          {{#each identified_tables}}
          <table>{{table_name}}</table>
          {{/each}}
        </affected_entities>
        <relationship_depth>{{determined_depth}}</relationship_depth>
        <requires_rls>{{requires_rls}}</requires_rls>
        <requires_auth>{{requires_auth}}</requires_auth>
        <refresh_cache>false</refresh_cache>
        <generate_migration>{{generate_migration}}</generate_migration>
        <run_security_audit>true</run_security_audit>
        <check_type_updates>true</check_type_updates>
        <keywords>
          {{#each extracted_keywords}}
          <keyword>{{keyword}}</keyword>
          {{/each}}
        </keywords>
      </schema-survey-request>
      ```
    </action>

    <action>YOU MUST NOW INVOKE Schema Surveyor using the Task tool. This is NOT optional.

      CRITICAL INSTRUCTION - READ CAREFULLY:
      1. Use the Task tool (not any other tool or method)
      2. Set subagent_type EXACTLY as: "bmm-schema-surveyor"
      3. Set model: "sonnet"
      4. Set description: "Survey database schema for {{story_key}}"
      5. Include the COMPLETE schema-survey-request XML in the prompt parameter
      6. WAIT for the Schema Surveyor to return its response
      7. DO NOT simulate, fake, manually extract, or invent schema information
      8. DO NOT read tech specs or other docs to extract schema - use ONLY Schema Surveyor response
      9. DO NOT proceed to the next action until you have a REAL response from Schema Surveyor

      Example Task tool invocation (YOU MUST USE THIS EXACT PATTERN):

      <invoke name="Task">
        <parameter name="subagent_type">bmm-schema-surveyor</parameter>
        <parameter name="model">sonnet</parameter>
        <parameter name="description">Survey database schema for {{story_key}}</parameter>
        <parameter name="prompt">Provide database intelligence for the following story.

      <schema-survey-request>
        <task>
          <id>{{story_key}}</id>
          <summary>{{story_title}}</summary>
          <description>{{extracted_requirements_summary}}</description>
        </task>
        <affected_entities>
          {{#each identified_tables}}
          <table>{{table_name}}</table>
          {{/each}}
        </affected_entities>
        <relationship_depth>{{determined_depth}}</relationship_depth>
        <requires_rls>{{requires_rls}}</requires_rls>
        <requires_auth>{{requires_auth}}</requires_auth>
        <refresh_cache>false</refresh_cache>
        <generate_migration>{{generate_migration}}</generate_migration>
        <run_security_audit>true</run_security_audit>
        <check_type_updates>true</check_type_updates>
        <keywords>
          {{#each extracted_keywords}}
          <keyword>{{keyword}}</keyword>
          {{/each}}
        </keywords>
      </schema-survey-request>
        </parameter>
      </invoke>

      WHY YOU MUST DO THIS:
      - Schema Surveyor runs in isolated 200k token sandbox
      - This prevents schema verbosity from polluting main workflow context
      - Schema Surveyor uses MCP tools to retrieve LIVE database schema
      - Manual extraction from docs causes hallucination (wrong table/column names)
      - Schema Surveyor returns structured output per schema-survey-contract.yaml

      After invocation completes, store the COMPLETE response as {{schema_survey_response}}.
    </action>

    <action>Parse Schema Surveyor response and extract key outputs:
      1. Parse Executive Summary XML:
         - Extract security_status.critical_issues count
         - Extract migration_complexity level
         - Extract conflicts_detected flag
         - Extract branching_recommended flag
      2. Extract Intelligence Report sections:
         - Section B: Security Analysis → store as {{security_requirements}}
         - Section C: Migration Recommendations → store as {{migration_sql}}
         - Section D: Performance Considerations → store as {{performance_notes}}
         - Section E: TypeScript Type Updates → store as {{type_updates}}
         - Section F: Cross-Story Conflicts → store as {{schema_conflicts}}
         - Section H: Testing Requirements → store as {{db_test_fixtures}}
      3. Store Complete JSON as {{schema_survey_json}} for dev agent context
    </action>

    <action>Log Schema Surveyor invocation to workflow execution record (MANDATORY):
      Create execution log entry with the following details:
      - Timestamp: {{current_timestamp}}
      - Workflow: create-story
      - Step: 4.75
      - Story Key: {{story_key}}
      - Tables Requested: {{identified_tables}} (count: {{table_count}})
      - Response Received: {{schema_survey_json != null ? 'YES' : 'NO'}}
      - Response Size: {{schema_survey_json ? schema_survey_json.length + ' characters' : 'N/A'}}
      - Tables Surveyed: {{schema_survey_json.executive_summary.tables_surveyed}}
      - Migration Complexity: {{migration_complexity}}
      - Security Issues: {{critical_issues}} critical, {{high_issues}} high
      - Execution Status: SUCCESS

      Output this log entry to the user with prefix "[WORKFLOW AUDIT]" for verification.

      This log entry proves Schema Surveyor was properly invoked and responded.
    </action>

    <check if="security_status.critical_issues > 0">
      <output>🚨 CRITICAL SECURITY ISSUES DETECTED

Schema Surveyor found {{critical_issues}} critical security issues.

**Immediate Action Required:**
{{security_requirements}}

**Recommendation:** Add security fix tasks to story BEFORE feature implementation.
      </output>
      <action>Prepend security fix tasks to story task list with priority markers</action>
    </check>

    <check if="schema_conflicts.detected == true">
      <output>⚠️ SCHEMA CONFLICTS DETECTED

Another story is modifying the same database tables.

**Conflicting Stories:**
{{schema_conflicts.conflicting_stories}}

**Recommendation:**
{{schema_conflicts.recommendation}}

**Options:**
1. Coordinate with other story to sequence migrations
2. Use Supabase branching for isolated testing
3. Defer this story until conflict resolved
      </output>
      <action>If {{non_interactive}} == false: Ask user how to proceed</action>
      <action>If {{non_interactive}} == true: Add conflict warning to Dev Notes</action>
    </check>

    <check if="migration_complexity in ['complex', 'high-risk']">
      <output>⚠️ COMPLEX MIGRATION DETECTED

Migration complexity: {{migration_complexity}}

**Recommendation:** This story may require architect review before implementation.
      </output>
      <action>Add "Requires Architect Review" tag to story metadata</action>
    </check>

    <check if="branching_recommended == true">
      <output>💡 SUPABASE BRANCHING RECOMMENDED

Schema Surveyor recommends using Supabase branching for this story.

**Reason:** {{branching_recommendation.reason}}

**Suggested Branch Name:** {{story_key}}-schema-test

**Workflow:**
1. Create Supabase branch before starting development
2. Test migrations in isolated branch database
3. Merge branch after validation
      </output>
      <action>Add branching workflow instructions to Dev Notes</action>
    </check>

    <action>Format {{schema_survey}} for inclusion in story document:
      CRITICAL: Populate "### Database Schema Reference" section with structured intelligence

      **Schema Intelligence Summary:**
      - Tables Affected: [list from Complete JSON]
      - Migration Complexity: {{migration_complexity}}
      - Security Issues: {{critical_issues}} critical, {{high_issues}} high
      - Conflicts: {{conflicts_detected ? 'YES - coordinate required' : 'None detected'}}

      **Migration SQL:**
      ```sql
      {{migration_sql}}
      ```

      **Security Requirements:**
      {{security_requirements}}

      **Performance Notes:**
      {{performance_notes}}

      **TypeScript Type Updates:**
      {{type_updates}}

      **Test Data Fixtures:**
      {{db_test_fixtures}}

      **Complete Schema Context:**
      Stored in story context file for dev agent reference.
      - File: docs/05-Epics-Stories/{{epic_folder}}/Story Context/{{story_key}}.context.xml
      - Contains: Full Schema Surveyor JSON output with table schemas, relationships, indexes, RLS policies
    </action>

    <action>Store Schema Surveyor Complete JSON for later story-context workflow:
      - Save {{schema_survey_json}} to memory variable
      - Will be included in story context XML during story-context workflow
      - Prevents need to re-query schema during dev phase
    </action>

    <template-output file="{default_output_file}">database_schema_summary</template-output>
  </step>

  <step n="4.76" goal="Validate Schema Surveyor invocation (MANDATORY GATE)">
    <critical>MANDATORY VALIDATION CHECKPOINT - Workflow CANNOT proceed without proof of invocation</critical>

    <output>🔍 SCHEMA SURVEYOR VALIDATION CHECKPOINT

    Verifying that Schema Surveyor was properly invoked in Step 4.75...
    </output>

    <check if="{{requires_database_survey}} == false">
      <output>✅ VALIDATION: SKIPPED (No database work required)

      Story does not involve database changes. Schema Surveyor invocation not required.
      Proceeding to next step...
      </output>
      <action>Skip remaining validation checks and proceed to Step 5</action>
    </check>

    <check if="{{requires_database_survey}} == true AND {{schema_survey_json}} is empty or undefined or null">
      <output>🚨 VALIDATION: FAILED - CRITICAL WORKFLOW VIOLATION

      Step 4.75 requires Schema Surveyor invocation for database-related stories, but NO response was found.

      **DIAGNOSIS:**
      - Story involves database work: YES ({{requires_database_survey}} = true)
      - Schema Surveyor response found: NO ({{schema_survey_json}} is empty/undefined)
      - This means Step 4.75 was NOT properly executed

      **ROOT CAUSE:**
      You likely:
      1. Skipped the Schema Surveyor invocation entirely
      2. Manually extracted schema from tech specs instead of invoking sub-agent
      3. Failed to store the response in {{schema_survey_json}}
      4. Simulated or faked the response without actual Task tool invocation

      **REQUIRED ACTION:**
      You MUST go back to Step 4.75 and properly invoke Schema Surveyor using the Task tool:

      <invoke name="Task">
        <parameter name="subagent_type">bmm-schema-surveyor</parameter>
        <parameter name="model">sonnet</parameter>
        <parameter name="description">Survey database schema for {{story_key}}</parameter>
        <parameter name="prompt">Provide database intelligence for the following story.

      [Include complete schema-survey-request XML here]
        </parameter>
      </invoke>

      **THIS IS NON-NEGOTIABLE.**

      DO NOT proceed to Step 5 until Schema Surveyor has been properly invoked and its response stored.
      </output>

      <action>HALT workflow execution immediately</action>
      <action>Display error message to user</action>
      <action>DO NOT continue to next step</action>
      <action>DO NOT mark this step as complete</action>
      <action>WAIT for user to acknowledge and re-run Step 4.75 properly</action>
    </check>

    <check if="{{requires_database_survey}} == true AND {{schema_survey_json}} exists">
      <output>✅ VALIDATION: Schema Surveyor response found

      Verifying response structure and completeness...
      </output>

      <action>Validate response structure (MANDATORY checks):
        1. Check {{schema_survey_json}} contains "executive_summary" section
        2. Check {{schema_survey_json}} contains "tables" array with at least 1 table
        3. Check {{schema_survey_json}} contains "migration_recommendations" if generate_migration=true
        4. Check {{schema_survey_json}} contains "security_audit" if run_security_audit=true
        5. Check response is properly structured JSON/XML per schema-survey-contract.yaml
      </action>

      <check if="response structure is INVALID">
        <output>🚨 VALIDATION: FAILED - MALFORMED RESPONSE

        Schema Surveyor returned data but it does not match expected structure.

        **DIAGNOSIS:**
        - Response received: YES
        - Response structure valid: NO
        - Expected structure: schema-survey-contract.yaml v3.0

        **MISSING OR INVALID SECTIONS:**
        {{list_of_validation_failures}}

        **POSSIBLE CAUSES:**
        1. Schema Surveyor agent has a bug
        2. Response was truncated during parsing
        3. Wrong version of Schema Surveyor invoked
        4. Response was manually created instead of generated by sub-agent

        **REQUIRED ACTION:**
        Re-invoke Schema Surveyor with explicit validation:
        - Set refresh_cache=true to force fresh data
        - Verify bmm-schema-surveyor agent version matches workflow expectations
        - Check Schema Surveyor agent logs for errors

        DO NOT proceed until valid response is received.
        </output>

        <action>HALT workflow execution</action>
        <action>Display validation failure details to user</action>
      </check>

      <check if="response structure is VALID">
        <output>✅ VALIDATION: PASSED

        Schema Surveyor invocation verified successfully.

        **Validation Results:**
        - Response received: YES
        - Response structure: VALID
        - Executive summary present: YES
        - Tables surveyed: {{schema_survey_json.executive_summary.tables_surveyed}}
        - Migration complexity: {{migration_complexity}}
        - Security issues detected: {{critical_issues}} critical, {{high_issues}} high
        - Response size: {{schema_survey_json.length}} characters
        - Timestamp: {{current_timestamp}}

        **Audit Log Entry Created:**
        [WORKFLOW AUDIT] Step 4.75 Schema Surveyor invocation - SUCCESS

        Proceeding to next step...
        </output>

        <action>Mark validation as PASSED</action>
        <action>Store validation timestamp for audit trail</action>
        <action>Continue to Step 5</action>
      </check>
    </check>
  </step>

  <step n="5" goal="Project structure alignment and lessons learned">
    <action>Review {{previous_story_learnings}} and extract actionable intelligence:
      - New patterns/services created → Note for reuse (DO NOT recreate)
      - Architectural deviations → Understand and maintain consistency
      - Technical debt items → Assess if this story should address them
      - Files modified → Understand current state of evolving components
      - Warnings/recommendations → Apply to this story's approach
      - Review findings → Learn from issues found in previous story
      - Pending action items → Determine if epic-wide concerns affect this story
    </action>

    <action>If unified-project-structure.md present: align expected file paths, module names, and component locations; note any potential conflicts.</action>

    <action>Cross-reference {{previous_story_learnings}}.new_files with project structure to understand where new capabilities are located.</action>

    <template-output file="{default_output_file}">structure_alignment_summary</template-output>
  </step>

  <step n="6" goal="Assemble acceptance criteria and tasks">
    <action>Assemble acceptance criteria list from tech_spec or epics. If gaps exist, derive minimal, testable criteria from PRD verbatim phrasing (NO invention).</action>
    <action>Create tasks/subtasks directly mapped to ACs. Include explicit testing subtasks per testing-strategy and existing tests framework. Cite architecture/source documents for any technical mandates.</action>
    <template-output file="{default_output_file}">acceptance_criteria</template-output>
    <template-output file="{default_output_file}">tasks_subtasks</template-output>
  </step>

  <step n="6.5" goal="Complexity analysis and story splitting (mandatory)">
    <critical>PREVENT DEV AGENT CONTEXT EXHAUSTION - Analyze story scope BEFORE document creation</critical>
    <critical>Goal: Break overly complex stories into smaller, sequential sub-stories that keep dev agent focused</critical>

    <action>Calculate story complexity metrics:
      1. **Task Count**: Count all tasks and subtasks (weight: 1 point per task over 8)
      2. **AC Count**: Count acceptance criteria (weight: 1.5 points per AC over 5)
      3. **UX Screen Count**: Count referenced UX screens (weight: 2 points per screen over 3)
      4. **Architectural Layer Span**: Count layers touched (weight: 2 points per layer over 2)
         - Layers: database, backend API, frontend/web, mobile
         - Example: database + backend + mobile = 3 layers
      5. **Database Complexity Bonus**: From Schema Surveyor {{migration_complexity}}
         - "low" or "medium" = 0 points
         - "high" or "complex" = +3 points
      6. **Cross-Platform Bonus**: {{platform}} == "cross-platform" = +3 points
      7. **File Estimate**: Estimate files to create/modify from tasks (weight: 0.5 points per file over 10)

      **Complexity Score Formula:**
      score = (tasks - 8) + (acs - 5) * 1.5 + (screens - 3) * 2 + (layers - 2) * 2 + db_bonus + platform_bonus + (files - 10) * 0.5

      **Complexity Levels:**
      - LOW: score ≤ 5 → Single story (no split)
      - MEDIUM: 6 ≤ score ≤ 10 → Recommended split
      - HIGH: score ≥ 11 → Mandatory split

      Store: {{complexity_score}}, {{complexity_level}}, {{task_count}}, {{ac_count}}, {{screen_count}}, {{layer_count}}, {{file_estimate}}
    </action>

    <check if="{{complexity_score}} <= 5">
      <output>✅ COMPLEXITY ANALYSIS: Story scope is dev-agent friendly

**Complexity Metrics:**
- Tasks: {{task_count}} (threshold: 8)
- Acceptance Criteria: {{ac_count}} (threshold: 5)
- UX Screens: {{screen_count}} (threshold: 3)
- Architectural Layers: {{layer_count}} (threshold: 3)
- Database Complexity: {{migration_complexity}}
- File Estimate: {{file_estimate}}
- **Complexity Score: {{complexity_score}} (LOW)**

✅ Story will proceed as single unit - no splitting required.
Continuing to story document creation...
      </output>
      <action>Set {{split_required}} = false</action>
      <action>Continue to Step 6.6 (Sequential Thinking validation)</action>
    </check>

    <check if="{{complexity_score}} > 5">
      <output>⚠️ COMPLEXITY ANALYSIS: Story scope exceeds dev agent comfort zone

**Complexity Metrics:**
- Tasks: {{task_count}} (threshold: 8)
- Acceptance Criteria: {{ac_count}} (threshold: 5)
- UX Screens: {{screen_count}} (threshold: 3)
- Architectural Layers: {{layer_count}} (database, backend, frontend, mobile)
- Database Complexity: {{migration_complexity}}
- Cross-Platform: {{platform}}
- File Estimate: {{file_estimate}} files
- **Complexity Score: {{complexity_score}} ({{complexity_level}})**

**⚠️ RECOMMENDATION:** Split into multiple interconnected sub-stories to:
- Prevent dev agent context exhaustion
- Reduce cognitive load per story
- Enable parallel development
- Simplify testing and review
- Improve error recovery
      </output>

      <action>Analyze natural split boundaries using priority order:

**Priority 1: Layer-Based Splits** (preferred for full-stack stories)
- Identify which layers are involved from tasks and ACs
- Typical sequence: database → backend → frontend → mobile
- Each layer becomes a sub-story with clear interface contract
- Example: "photo-capture" → (a) database-schema, (b) backend-api, (c) mobile-ui

**Priority 2: Feature-Based Splits** (for stories with multiple distinct features)
- Identify logically separable features within the story
- Look for feature boundaries in ACs (e.g., "authentication" vs "authorization")
- Split by user-facing capabilities
- Example: "user-management" → (a) registration, (b) profile, (c) permissions

**Priority 3: UX-Based Splits** (for UI-heavy stories with multiple screens)
- Split by screen or screen flow
- Each sub-story focuses on 1-2 related screens
- Example: "onboarding-flow" → (a) splash-welcome, (b) tutorial-screens, (c) signup-screen

**Analysis Output:**
- Determine which split strategy applies (may use combination)
- Identify 2-4 sub-stories that each have:
  * Clear scope boundary
  * 3-6 tasks maximum
  * 2-4 ACs maximum
  * Single layer focus (if layer-based split)
  * Sequential dependencies identified
      </action>

      <action>Generate sub-story breakdown using naming convention:

**Naming Format:** {{epic_num}}-{{story_num}}-{{sub_letter}}-{{sub_title}}

**Example:** Story "2-11-photo-capture-annotation" with 15 tasks →

Sub-stories:
1. Key: `2-11-a-database-schema`
   Title: "Database Schema for Photo Capture"
   Scope: Tables, migrations, RLS policies
   Tasks: 4 (from original story's DB tasks)
   ACs: 2 (schema-related ACs)
   Dependencies: None (foundation)

2. Key: `2-11-b-backend-api`
   Title: "Backend API for Photo Capture"
   Scope: REST endpoints, business logic, file upload
   Tasks: 5 (from original story's backend tasks)
   ACs: 3 (API-related ACs)
   Dependencies: 2-11-a-database-schema (requires schema)

3. Key: `2-11-c-mobile-ui`
   Title: "Mobile UI for Photo Capture"
   Scope: Flutter screens, camera integration, upload
   Tasks: 6 (from original story's mobile tasks)
   ACs: 4 (UI/UX-related ACs)
   Dependencies: 2-11-b-backend-api (requires API endpoints)

**Sub-letter assignment:** a, b, c, d, e (alphabetical, lowercase)

Store: {{sub_stories}} array with fields:
- sub_letter (a, b, c, etc.)
- story_key (e.g., "2-11-a-database-schema")
- title
- scope_summary (1-2 sentences)
- tasks (array extracted from parent story)
- acs (array extracted from parent story)
- ux_screens (array if applicable)
- schema_context (if database work)
- dependencies (array of prerequisite story_keys)
- layer (database/backend/frontend/mobile)
      </action>

      <check if="{{non_interactive}} == false">
        <output>**📋 Proposed Sub-Story Breakdown:**

{{#each sub_stories}}
**{{@index + 1}}. Story {{story_key}}: {{title}}**
- Scope: {{scope_summary}}
- Layer: {{layer}}
- Tasks: {{tasks.length}} tasks
- ACs: {{acs.length}} acceptance criteria
- Dependencies: {{#if dependencies.length > 0}}{{dependencies}}{{else}}None (foundation){{/if}}

{{/each}}

**Total:** {{sub_stories.length}} sub-stories will be created

**Options:**
1. ✅ Accept proposed split and create all sub-stories
2. 🔄 Adjust split boundaries (provide feedback)
3. ⚠️ Keep as single story (NOT recommended for {{complexity_level}} complexity)

Enter option number:
        </output>

        <action>Wait for user input</action>

        <check if="user selects option 1">
          <action>Set {{user_approved_split}} = true</action>
          <action>Proceed with sub-story creation</action>
        </check>

        <check if="user selects option 2">
          <action>Collect user feedback on adjustments</action>
          <action>Re-analyze split boundaries with user input</action>
          <action>Re-present adjusted sub-story breakdown</action>
          <action>Loop until user approves</action>
        </check>

        <check if="user selects option 3">
          <output>⚠️ User chose to keep as single story despite {{complexity_level}} complexity.

**Risks:**
- Dev agent may run out of context mid-implementation
- Increased debugging complexity
- Harder to review and test
- Longer cycle time

Proceeding with single story as requested...
          </output>
          <action>Set {{split_required}} = false</action>
          <action>Continue to Step 6.6</action>
        </check>
      </check>

      <check if="{{non_interactive}} == true">
        <check if="{{complexity_level}} == 'HIGH'">
          <output>🤖 AUTO-SPLIT: HIGH complexity detected in non-interactive mode

Automatically splitting story into {{sub_stories.length}} sub-stories to prevent dev agent context exhaustion.

{{#each sub_stories}}
- {{story_key}}: {{title}} ({{tasks.length}} tasks, {{acs.length}} ACs)
{{/each}}
          </output>
          <action>Set {{user_approved_split}} = true (auto-approved)</action>
          <action>Proceed with sub-story creation</action>
        </check>

        <check if="{{complexity_level}} == 'MEDIUM'">
          <output>⚠️ MEDIUM complexity detected in non-interactive mode

Complexity score ({{complexity_score}}) is in MEDIUM range. Auto-split is RECOMMENDED but not forced.

**Configuration:** Set workflow variable `auto_split_medium: true` in config to enable auto-split for MEDIUM complexity.

Proceeding with single story (default behavior for MEDIUM in non-interactive mode)...
          </output>
          <action>Set {{split_required}} = false</action>
          <action>Continue to Step 6.6</action>
        </check>
      </check>

      <check if="{{user_approved_split}} == true OR ({{non_interactive}} == true AND {{complexity_level}} == 'HIGH')">
        <action>**CREATE SUB-STORIES IN SPRINT-STATUS.YAML**

1. Load {{output_folder}}/sprint-status.yaml COMPLETELY
2. Parse development_status section to find {{story_key}} entry
3. Store current line number and indentation for insertion point
4. **Replace** single story entry with sub-story entries:

   ```yaml
   # Original entry: {{story_key}}: backlog
   # Replaced with:
   {{story_key}}-a: backlog  # {{sub_stories[0].title}}
   {{story_key}}-b: backlog  # {{sub_stories[1].title}} (depends on: {{story_key}}-a)
   {{story_key}}-c: backlog  # {{sub_stories[2].title}} (depends on: {{story_key}}-b)
   # ... etc for all sub-stories
   ```

5. Preserve chronological order (sub-stories appear in sequence at original position)
6. Add inline comments with dependencies and titles for human readability
7. Save file with ALL structure, comments, and STATUS DEFINITIONS preserved
8. Store {{sprint_status_updated}} = true
        </action>

        <action>**CREATE SUB-STORY FILES**

For each sub-story in {{sub_stories}} array (process in order: a, b, c, ...):

1. Set workflow context for sub-story:
   - {{current_story_key}} = sub-story.story_key
   - {{current_epic_num}} = {{epic_num}} (unchanged)
   - {{current_story_num}} = {{story_num}} (unchanged)
   - {{current_sub_letter}} = sub-story.sub_letter
   - {{current_story_title}} = sub-story.title
   - {{current_scope}} = sub-story.scope_summary
   - {{current_tasks}} = sub-story.tasks
   - {{current_acs}} = sub-story.acs
   - {{current_dependencies}} = sub-story.dependencies
   - {{current_layer}} = sub-story.layer

2. Extract relevant context for this sub-story:
   - UX specs: Filter {{ux_specs}} for screens relevant to this layer
   - Schema context: Include {{schema_survey_json}} only if sub-story.layer == "database"
   - Previous learnings: Include {{previous_story_learnings}} in first sub-story only
   - Architecture: Include layer-specific architecture docs

3. Generate story document using template.md with modifications:

   **Header additions:**
   ```markdown
   # Story {{epic_num}}.{{story_num}}({{sub_letter}}): {{title}}

   **Epic:** {{epic_num}} - {{epic_title}}
   **Story Series:** {{epic_num}}-{{story_num}} {{parent_story_title}} (Part {{sub_index}} of {{total_sub_stories}})
   **Layer Focus:** {{layer}}
   **Dependencies:** {{#if dependencies}}{{dependencies}}{{else}}None (foundation story){{/if}}

   **Sibling Sub-Stories:**
   {{#each sub_stories}}
   - {{#if @isCurrent}}[Current]{{/if}} {{story_key}}: {{title}}{{#if dependencies}} (depends on: {{dependencies}}){{/if}}
   {{/each}}
   ```

   **Dev Notes additions:**
   ```markdown
   ### Sub-Story Context

   This is part {{sub_index}} of {{total_sub_stories}} in the "{{parent_story_title}}" story series.

   **Scope Boundary:** {{scope_summary}}

   **Why this was split:**
   - Original story had {{parent_complexity_score}} complexity score ({{parent_task_count}} tasks, {{parent_ac_count}} ACs)
   - Split to prevent dev agent context exhaustion
   - This sub-story focuses exclusively on {{layer}} layer

   **Integration Points:**
   {{#if dependencies}}
   **Prerequisites:** This story DEPENDS on {{dependencies}} being completed first.
   - Review completed predecessor stories for interface contracts
   - Reuse services/components created in previous sub-stories
   {{/if}}

   {{#if has_successors}}
   **Successors:** The following sub-stories depend on THIS story:
   {{#each successors}}
   - {{story_key}}: {{title}}
   {{/each}}
   - Ensure clean interface contracts for successor stories
   - Document any public APIs or shared components created
   {{/if}}
   ```

4. Populate sections with filtered content:
   - User Story: Scoped to this layer/feature
   - Acceptance Criteria: {{current_acs}} only
   - Tasks: {{current_tasks}} only (with AC references maintained)
   - UX Specs: Relevant screens for this sub-story
   - Database Schema: Include ONLY if layer == "database"
   - Dev Notes: Add sub-story context, dependencies, integration points

5. Save sub-story file:
   - Path: {{story_dir}}/{{current_story_key}}.md
   - Example: docs/05-Epics-Stories/Epic-B/stories/2-11-a-database-schema.md

6. Log creation:
   ```
   ✅ Created sub-story {{sub_index}}/{{total_sub_stories}}: {{current_story_key}}
   ```

7. Repeat for next sub-story
        </action>

        <output>✅ **STORY SPLITTING COMPLETED SUCCESSFULLY**

**Sub-Stories Created:**
{{#each sub_stories}}
{{@index + 1}}. {{story_key}}: {{title}}
   - File: {{story_dir}}/{{story_key}}.md
   - Tasks: {{tasks.length}}
   - ACs: {{acs.length}}
   - Status: backlog
   - Dependencies: {{#if dependencies.length > 0}}{{dependencies}}{{else}}None{{/if}}
{{/each}}

**Sprint Status Updated:**
- File: {{output_folder}}/sprint-status.yaml
- Original story {{story_key}} replaced with {{sub_stories.length}} sub-stories
- All sub-stories marked as "backlog"

**Next Steps:**
1. Review sub-story files in {{story_dir}}/
2. Run `create-story` workflow again to draft first sub-story ({{sub_stories[0].story_key}})
3. Sub-stories will be drafted and implemented in sequence

**Note:** This workflow will now HALT. Re-run create-story to process first sub-story.
        </output>

        <action>HALT workflow - story splitting replaces current story creation</action>
        <action>Exit with success status</action>
      </check>
    </check>
  </step>

  <step n="6.6" goal="Validate story coherence with Sequential Thinking (conditional)">
    <check if="story has complex dependencies">
      <criteria>Trigger Sequential Thinking MCP if ANY of these conditions met:
        - Acceptance Criteria reference >3 different UX screens
        - Acceptance Criteria contain ambiguous or conflicting requirements
        - Story spans multiple platforms (cross-platform)
        - Tasks have unclear dependencies or ordering
        - Multiple component libraries referenced
      </criteria>

      <action>Call mcp__sequential-thinking__sequentialthinking with prompt:
        "Analyze the following story structure for coherence and clarity:

        Story: {{story_title}}
        Platform: {{platform}}
        UX Screens Referenced: [list screen numbers]
        Acceptance Criteria: [list all ACs]
        Proposed Tasks: [list all tasks]

        Evaluate:
        1. Are the ACs clear and testable?
        2. Do tasks properly map to ACs?
        3. Are there missing tasks or ACs?
        4. Are there conflicting requirements?
        5. Is the UX screen coverage appropriate?

        Provide:
        - Clarified AC list (if needed)
        - Refined task breakdown
        - Risk assessment
        - Rationale for changes"
      </action>

      <action>Review Sequential Thinking output and integrate recommendations:
        - Update {{acceptance_criteria}} with clarifications
        - Refine {{tasks_subtasks}} based on analysis
        - Add risk notes to Dev Notes section
        - Document reasoning in story metadata
      </action>

      <template-output file="{default_output_file}">sequential_thinking_analysis</template-output>
    </check>

    <check if="no complex dependencies">
      <action>Skip Sequential Thinking validation - story structure is straightforward</action>
    </check>
  </step>

  <step n="7" goal="Create or update story document">
    <action>Resolve output path: {default_output_file} using current {{epic_num}} and {{story_num}}. If targeting an existing story for update, use its path.</action>
    <action>Initialize from template.md if creating a new file; otherwise load existing file for edit.</action>
    <action>Compute a concise story_title from epic/story context; if missing, synthesize from PRD feature name and epic number.</action>
    <template-output file="{default_output_file}">story_header</template-output>
    <template-output file="{default_output_file}">story_body</template-output>
    <template-output file="{default_output_file}">dev_notes_with_citations</template-output>

    <action>If {{previous_story_learnings}} contains actionable items (not "First story" or "not yet implemented"):
      - Add "Learnings from Previous Story" subsection to Dev Notes
      - Include relevant completion notes, new files/patterns, deviations
      - Cite previous story file as reference [Source: stories/{{previous_story_key}}.md]
      - Highlight interfaces/services to REUSE (not recreate)
      - Note any technical debt to address in this story
      - List pending review items that affect this story (if any)
      - Reference specific files created: "Use {{file_path}} for {{purpose}}"
      - Format example:
        ```
        ### Learnings from Previous Story

        **From Story {{previous_story_key}} (Status: {{previous_status}})**

        - **New Service Created**: `AuthService` base class available at `src/services/AuthService.js` - use `AuthService.register()` method
        - **Architectural Change**: Switched from session-based to JWT authentication
        - **Schema Changes**: User model now includes `passwordHash` field, migration applied
        - **Technical Debt**: Email verification skipped, should be included in this or subsequent story
        - **Testing Setup**: Auth test suite initialized at `tests/integration/auth.test.js` - follow patterns established there
        - **Pending Review Items**: Rate limiting mentioned in review - consider for this story

        [Source: stories/{{previous_story_key}}.md#Dev-Agent-Record]
        ```
    </action>

    <template-output file="{default_output_file}">change_log</template-output>
  </step>

  <step n="7.5" goal="Sanity check validation">
    <action>Perform comprehensive sanity check on generated story:

      1. File Existence Validation:
         - Extract all file paths from "### UX Specifications Reference" section
         - Verify each referenced UX spec file exists
         - Verify component library files exist (if referenced)
         - Report: List of missing files (if any)

      2. Path Format Validation:
         - Verify all paths are project-relative (start with "docs/" or "src/")
         - Verify NO absolute paths present (no "/Users/", "C:\", etc.)
         - Verify canonical UX spec path format: "docs/09-UX Spec" (no space after hyphen)
         - Report: List of incorrectly formatted paths (if any)

      3. AC-to-Task Mapping Verification:
         - Parse all Acceptance Criteria (count total)
         - Parse all Tasks and check "(AC: #)" references
         - Verify every AC has at least one task
         - Report: List of unmapped ACs (if any)

      4. Task-to-UX Mapping Verification:
         - Extract UX screens from "### UX Specifications Reference"
         - Check that tasks reference relevant screens or components
         - Verify platform consistency (mobile tasks → mobile screens)
         - Report: List of tasks missing UX references (if appropriate)

      5. Cross-Reference Validation:
         - Check links between Dev Notes and References sections
         - Verify source citations exist and are well-formed
         - Check for broken internal links
         - Report: List of broken references (if any)
    </action>

    <check if="sanity check PASSED">
      <output>✅ SANITY CHECK: PASSED

Story validation successful:
- All referenced files exist
- All paths are project-relative
- All ACs mapped to tasks
- Platform consistency verified
- No broken references detected

Story ready for context generation.
      </output>
    </check>

    <check if="sanity check FAILED">
      <output>❌ SANITY CHECK: FAILED

Issues detected:
{{sanity_check_failures}}

**Actionable Fixes:**
{{suggested_fixes}}

Story saved but requires manual review before marking as drafted.
      </output>

      <action>If {{non_interactive}} == false: Ask user whether to proceed or abort</action>
      <action>If {{non_interactive}} == true: Proceed with warnings logged</action>
    </check>

    <template-output file="{default_output_file}">sanity_check_report</template-output>
  </step>

  <step n="8" goal="Validate, save, and mark story drafted" tag="sprint-status">
    <invoke-task>Validate against checklist at {installed_path}/checklist.md using bmad/core/tasks/validate-workflow.xml</invoke-task>
    <action>Save document unconditionally (non-interactive default). In interactive mode, allow user confirmation.</action>

    <!-- Mark story as drafted in sprint status -->
    <action>Update {{output_folder}}/sprint-status.yaml</action>
    <action>Load the FULL file and read all development_status entries</action>
    <action>Find development_status key matching {{story_key}}</action>
    <action>Verify current status is "backlog" (expected previous state)</action>
    <action>Update development_status[{{story_key}}] = "drafted"</action>
    <action>Save file, preserving ALL comments and structure including STATUS DEFINITIONS</action>

    <check if="story key not found in file">
      <output>⚠️ Could not update story status: {{story_key}} not found in sprint-status.yaml

Story file was created successfully, but sprint-status.yaml was not updated.
You may need to run sprint-planning to refresh tracking, or manually set the story row status to `drafted`.
      </output>
    </check>

    <action>Report created/updated story path</action>
    <output>**✅ Story Created Successfully, {user_name}!**

**Story Details:**

- Story ID: {{story_id}}
- Story Key: {{story_key}}
- File: {{story_file}}
- Status: drafted (was backlog)

**⚠️ Important:** The following workflows are context-intensive. It's recommended to clear context and restart the SM agent before running the next command.

**Next Steps:**

1. Review the drafted story in {{story_file}}
2. **[RECOMMENDED]** Run `story-context` to generate technical context XML and mark story ready for development (combines context + ready in one step)
3. Or run `story-ready` to manually mark the story ready without generating technical context
    </output>
  </step>

</workflow>
````
