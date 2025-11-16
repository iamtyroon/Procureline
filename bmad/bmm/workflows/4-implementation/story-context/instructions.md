<!-- BMAD BMM Story Context Assembly Instructions (v6) -->

```xml
<critical>The workflow execution engine is governed by: {project-root}/bmad/core/tasks/workflow.xml</critical>
<critical>You MUST have already loaded and processed: {installed_path}/workflow.yaml</critical>
<critical>Communicate all responses in {communication_language}</critical>
<critical>Generate all documents in {document_output_language}</critical>
<critical>This workflow assembles a Story Context file for a single drafted story by extracting acceptance criteria, tasks, relevant docs/code, interfaces, constraints, and testing guidance.</critical>
<critical>If story_path is provided, use it. Otherwise, find the first story with status "drafted" in sprint-status.yaml. If none found, HALT.</critical>
<critical>Check if context file already exists. If it does, ask user if they want to replace it, verify it, or cancel.</critical>

<critical>DOCUMENT OUTPUT: Technical context file (.context.xml). Concise, structured, project-relative paths only.</critical>

## 📚 Document Discovery - Selective Epic Loading

**Strategy**: This workflow needs only ONE specific epic and its stories, not all epics. This provides huge efficiency gains when epics are sharded.

**Epic Discovery Process (SELECTIVE OPTIMIZATION):**

1. **Determine which epic** you need (epic_num from story key - e.g., story "3-2-feature-name" needs Epic 3)
2. **Check for sharded version**: Look for `epics/index.md`
3. **If sharded version found**:
   - Read `index.md` to understand structure
   - **Load ONLY `epic-{epic_num}.md`** (e.g., `epics/epic-3.md` for Epic 3)
   - DO NOT load all epic files - only the one needed!
   - This is the key efficiency optimization for large multi-epic projects
4. **If whole document found**: Load the complete `epics.md` file and extract the relevant epic

**Tech-Spec Documents (Epic-Specific) - Selective Load:**

1. **Determine which epic** you need (epic_num from story key - e.g., story "B-2-feature-name" needs Epic B)
2. **Check for sharded version**: Look for `tech-spec-epic-{epic_id}/index.md`
3. **If sharded version found**:
   - Read `index.md` to understand structure
   - Read ALL section files listed in the index
   - Treat combined content as single tech spec document
4. **If whole document found**: Load the complete `tech-spec-epic-{epic_id}.md` file
5. **Priority**: If both whole and sharded versions exist, use the whole document

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
  <step n="1" goal="Find drafted story and check for existing context" tag="sprint-status">
    <check if="{{story_path}} is provided">
      <action>Use {{story_path}} directly</action>
      <action>Read COMPLETE story file and parse sections</action>
      <action>Extract story_key from filename or story metadata</action>
      <action>Verify Status is "drafted" - if not, HALT with message: "Story status must be 'drafted' to generate context"</action>
    </check>

    <check if="{{story_path}} is NOT provided">
      <critical>MUST read COMPLETE sprint-status.yaml file from start to end to preserve order</critical>
      <action>Load the FULL file: {{output_folder}}/sprint-status.yaml</action>
      <action>Read ALL lines from beginning to end - do not skip any content</action>
      <action>Parse the development_status section completely</action>

      <action>Find FIRST story (reading in order from top to bottom) where:
        - Key matches pattern: number-number-name (e.g., "1-2-user-auth")
        - NOT an epic key (epic-X) or retrospective (epic-X-retrospective)
        - Status value equals "drafted"
      </action>

      <check if="no story with status 'drafted' found">
        <output>📋 No drafted stories found in sprint-status.yaml

All stories are either still in backlog or already marked ready/in-progress/done.

**Next Steps:**
1. Run `create-story` to draft more stories
2. Run `sprint-planning` to refresh story tracking
        </output>
        <action>HALT</action>
      </check>

      <action>Use the first drafted story found</action>
      <action>Find matching story file in {{story_dir}} using story_key pattern</action>
      <action>Read the COMPLETE story file</action>
    </check>

    <action>Extract {{epic_id}}, {{story_id}}, {{story_title}}, {{story_status}} from filename/content</action>
    <action>Parse sections: Story, Acceptance Criteria, Tasks/Subtasks, Dev Notes</action>
    <action>Extract user story fields (asA, iWant, soThat)</action>
    <template-output file="{default_output_file}">story_tasks</template-output>
    <template-output file="{default_output_file}">acceptance_criteria</template-output>

    <!-- Check if context file already exists -->
    <action>Check if file exists at {default_output_file}</action>

    <check if="context file already exists">
      <output>⚠️ Context file already exists: {default_output_file}

**What would you like to do?**
1. **Replace** - Generate new context file (overwrites existing)
2. **Verify** - Validate existing context file
3. **Cancel** - Exit without changes
      </output>
      <ask>Choose action (replace/verify/cancel):</ask>

      <check if="user chooses verify">
        <action>GOTO validation_step</action>
      </check>

      <check if="user chooses cancel">
        <action>HALT with message: "Context generation cancelled"</action>
      </check>

      <check if="user chooses replace">
        <action>Continue to generate new context file</action>
      </check>
    </check>

    <action>Store project root path for relative path conversion: extract from {project-root} variable</action>
    <action>Define path normalization function: convert any absolute path to project-relative by removing project root prefix</action>
    <action>Initialize output by writing template to {default_output_file}</action>
    <template-output file="{default_output_file}">as_a</template-output>
    <template-output file="{default_output_file}">i_want</template-output>
    <template-output file="{default_output_file}">so_that</template-output>
  </step>

  <step n="1.25" goal="Detect sub-story and load sibling/predecessor context">
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
         - parent_story_base = "{epic_num}-{story_num}"
         - Set {{is_sub_story}} = true
      3. Otherwise:
         - This is a STANDARD story
         - epic_num = parts[0]
         - story_num = parts[1]
         - story_title = parts[2+]
         - Set {{is_sub_story}} = false

      Store: {{is_sub_story}}, {{epic_num}}, {{story_num}}, {{sub_letter}}, {{parent_story_base}}
    </action>

    <check if="{{is_sub_story}} == false">
      <output>ℹ️ Standard story format detected</output>
      <action>Set {{sub_story_context}} = null</action>
      <action>Skip to next step (1.5)</action>
    </check>

    <check if="{{is_sub_story}} == true">
      <output>📑 Sub-story detected: {{story_key}}

**Sub-Story Context:**
- Epic: {{epic_num}}
- Story Series: {{epic_num}}-{{story_num}}
- Sub-story Part: {{sub_letter}}

Discovering sibling sub-stories in the same series...
      </output>

      <action>Discover all sibling sub-stories:
        1. List all story files in {{story_dir}}
        2. Filter for files matching pattern: {{parent_story_base}}-*-*.md
           - Example: For "2-11-a-database-schema", find all "2-11-*-*.md" files
        3. Parse each matching filename:
           - Extract sub_letter (3rd component after splitting by dash)
           - Extract title (4th+ components)
           - Store as sibling if sub_letter is a-z
        4. Sort siblings alphabetically by sub_letter (a, b, c, d, ...)
        5. Store as {{sibling_stories}} array with:
           - sub_letter
           - story_key
           - title
           - file_path
           - is_current (true if sub_letter matches {{sub_letter}})
        6. Store total count as {{total_sub_stories}}
      </action>

      <output>✅ Discovered {{total_sub_stories}} sub-stories in series {{parent_story_base}}:

{{#each sibling_stories}}
{{@index + 1}}. {{story_key}}{{#if is_current}} [CURRENT]{{/if}}
   - Title: {{title}}
   - Part: {{sub_letter}}
{{/each}}
      </output>

      <action>Determine predecessor and successor sub-stories:

        **Predecessor Logic:**
        - Sub-letter sequence: a, b, c, d, e, f, g, h, ...
        - If {{sub_letter}} == 'a': No predecessor (foundation story)
        - Otherwise: predecessor_letter = {{sub_letter}} - 1

        **Successor Logic:**
        - If {{sub_letter}} == last letter in {{sibling_stories}}: No successor
        - Otherwise: successor_letter = {{sub_letter}} + 1

        Store:
        - {{has_predecessor}} (boolean)
        - {{predecessor_story}} (from sibling_stories if exists)
        - {{has_successor}} (boolean)
        - {{successor_stories}} (array of all successors from sibling_stories)
      </action>

      <check if="{{has_predecessor}} == true">
        <output>🔍 Loading predecessor context: {{predecessor_story.story_key}}

Reading predecessor story file to extract integration contracts...
        </output>

        <action>Load predecessor story for context:
          1. Read COMPLETE predecessor story file
          2. Extract key sections:

             A) Dev Agent Record → Completion Notes:
                - Extract completion notes that describe deliverables
                - Focus on: interfaces created, services defined, contracts established

             B) Dev Agent Record → File List:
                - Extract files created (NEW)
                - Map files to their purposes

             C) Dev Notes → Sub-Story Context → Integration Points → Successors:
                - Look for explicitly documented integration contracts
                - Extract any "Successors:" section content

          3. Store as {{predecessor_deliverables}} for inclusion in context XML
        </action>

        <output>✅ Predecessor context loaded: {{predecessor_story.story_key}}

Key deliverables that THIS sub-story should integrate with:
{{#each predecessor_deliverables}}
- {{deliverable}}
{{/each}}
        </output>
      </check>

      <action>Prepare sub-story metadata for context XML:

        Structure to include in context file:

        ```xml
        <subStoryContext>
          <isSubStory>true</isSubStory>
          <storySeriesBase>{{parent_story_base}}</storySeriesBase>
          <currentSubLetter>{{sub_letter}}</currentSubLetter>
          <totalSubStories>{{total_sub_stories}}</totalSubStories>
          <positionInSeries>{{position_index}} of {{total_sub_stories}}</positionInSeries>

          <siblingSummary>
            {{#each sibling_stories}}
            <sibling current="{{is_current}}">
              <key>{{story_key}}</key>
              <title>{{title}}</title>
              <subLetter>{{sub_letter}}</subLetter>
            </sibling>
            {{/each}}
          </siblingSummary>

          {{#if has_predecessor}}
          <predecessor>
            <key>{{predecessor_story.story_key}}</key>
            <title>{{predecessor_story.title}}</title>
            <deliverables>
              {{#each predecessor_deliverables}}
              <deliverable>{{deliverable}}</deliverable>
              {{/each}}
            </deliverables>
            <integrationGuidance>
              REUSE components and interfaces from predecessor.
              DO NOT recreate functionality already implemented.
              Review predecessor's Dev Agent Record for implementation details.
            </integrationGuidance>
          </predecessor>
          {{/if}}

          {{#if has_successor}}
          <successors>
            {{#each successor_stories}}
            <successor>
              <key>{{story_key}}</key>
              <title>{{title}}</title>
            </successor>
            {{/each}}
            <guidance>
              Document all public APIs and integration contracts.
              These will be consumed by successor sub-stories.
              Ensure clean separation of concerns.
            </guidance>
          </successors>
          {{/if}}

          <scopeBoundary>
            This sub-story focuses exclusively on: {{scope_from_story_dev_notes}}

            Stay within this layer/feature boundary.
            Integration with other layers handled by sibling sub-stories.
          </scopeBoundary>
        </subStoryContext>
        ```

        Store: {{sub_story_xml}} for insertion into context file
      </action>

      <output>📝 Sub-story context prepared for inclusion in context file

Context will include:
- Position in series: Part {{sub_letter}} of {{total_sub_stories}}
- Sibling sub-stories: {{sibling_stories.length}} total
{{#if has_predecessor}}
- Predecessor deliverables: {{predecessor_deliverables.length}} integration points
{{/if}}
{{#if has_successor}}
- Successor guidance: {{successor_stories.length}} dependent sub-stories
{{/if}}

This metadata will help dev agent understand sub-story boundaries.
      </output>

      <action>Write sub-story context to context file:
        Insert {{sub_story_xml}} into the context XML file
      </action>

      <template-output file="{default_output_file}">sub_story_context_xml</template-output>
    </check>
  </step>

  <step n="1.5" goal="Parse explicit UX references from story file">
    <action>Extract platform from story file or epic context:
      - Check story Dev Notes for platform indicators
      - Check epic title/description for keywords (same logic as create-story)
      - Set {{platform}} variable: "mobile", "web", or "cross-platform"
    </action>

    <action>Parse "### UX Specifications Reference" section from story file:
      PRIORITY 1 - Explicit References (use these if present):
      1. Locate "### UX Specifications Reference" section in story
      2. Extract list items matching patterns:
         - "- Screen X.Y: Name - path/to/file.md" → Screen reference
         - "- Reusable [Widgets/Components]: Names - path/to/file.md" → Component library reference
      3. Store as {{explicit_ux_refs}} with structure:
         - screen_refs: [{number, name, path}, ...]
         - component_refs: [{type, components, path}, ...]
      4. If explicit references found: Set {{use_explicit_refs}} = true
      5. Validate all referenced files exist before proceeding
    </action>

    <check if="explicit references found">
      <output>ℹ️ Using explicit UX references from story file ({{explicit_ux_refs.length}} references found)</output>
      <action>Skip keyword-based auto-discovery - use explicit paths only</action>
    </check>

    <check if="no explicit references found">
      <output>ℹ️ No explicit UX references in story - will use keyword-based auto-discovery</output>
      <action>Set {{use_explicit_refs}} = false and proceed to auto-discovery</action>
    </check>
  </step>

  <step n="2" goal="Collect relevant documentation">
    <action>Scan docs and src module docs for items relevant to this story's domain: search keywords from story title, ACs, and tasks.</action>
    <action>Prefer authoritative sources: PRD, Tech-Spec, Architecture, Front-end Spec, Testing standards, module-specific docs.</action>
    <action>Note: Tech-Spec is used for Level 0-1 projects (instead of PRD). It contains comprehensive technical context, brownfield analysis, framework details, existing patterns, and implementation guidance.</action>
    <action>For each discovered document: convert absolute paths to project-relative format by removing {project-root} prefix. Store only relative paths (e.g., "docs/prd.md" not "/Users/.../docs/prd.md").</action>
    <template-output file="{default_output_file}">
      Add artifacts.docs entries with {path, title, section, snippet}:
      - path: PROJECT-RELATIVE path only (strip {project-root} prefix)
      - title: Document title
      - section: Relevant section name
      - snippet: Brief excerpt (2-3 sentences max, NO invention)
    </template-output>
  </step>

  <step n="2.5" goal="Load matched UX specifications with priority system">
    <check if="{{use_explicit_refs}} == true">
      <action>Load UX specs using explicit references from story:
        FOR EACH screen in {{explicit_ux_refs.screen_refs}}:
        1. Verify file exists at specified path
        2. Read COMPLETE file (all sections, no truncation)
        3. Store with metadata:
           - screen_number: Screen identifier (e.g., "5.11")
           - screen_name: Screen title
           - file_path: PROJECT-RELATIVE path
           - content: COMPLETE markdown content

        FOR EACH component library in {{explicit_ux_refs.component_refs}}:
        1. Verify file exists at specified path
        2. Read COMPLETE file
        3. Extract ONLY sections relevant to components listed in reference
        4. Store with metadata:
           - library_type: "Reusable Widgets" or "Reusable Components"
           - components: [list of component names]
           - file_path: PROJECT-RELATIVE path
           - content: COMPLETE relevant sections
      </action>
    </check>

    <check if="{{use_explicit_refs}} == false">
      <action>Load UX specs using keyword-based auto-discovery (fallback):
        1. Read UX spec indices (canonical paths):
           - Mobile: `docs/09-UX Spec/mobile/mobilespec_sharded/index.md`
           - Web: `docs/09-UX Spec/web/webspec_sharded/index.md`

        2. Extract keywords from story title, ACs, and tasks:
           - Apply stemming: "annotation" → "annotate", "capturing" → "capture"
           - Generate synonyms using semantic matching

        3. Search index files for matching screen numbers/names:
           - Use fuzzy matching (Levenshtein distance ≤3)
           - Match screen number patterns: "5.11", "5.11A", "5-11"
           - Rank by relevance (title match > description match)

        4. Select top 1-3 most relevant screens

        5. Load matched screens using same process as explicit refs

        NOTE: Some stories may have no UX specs (infrastructure, backend-only)
      </action>
    </check>

    <action>Format {{ux_specifications_content}} for XML output:
      Create structured XML format with <screens> and optional <componentLibrary> sections

      FOR EACH screen:
      - Include screen number, name, and PROJECT-RELATIVE file path
      - Embed COMPLETE file content in CDATA section to preserve formatting
      - Normalize paths: strip any absolute path prefixes, use canonical "docs/09-UX Spec" format

      FOR EACH component library (if applicable):
      - Include library type and PROJECT-RELATIVE file path
      - Embed COMPLETE relevant content in CDATA section

      Example structure:
      <uxSpecifications>
        <platform>{{platform}}</platform>
        <discoveryMethod>{{use_explicit_refs ? 'explicit' : 'auto-discovery'}}</discoveryMethod>
        <screens>
          <screen>
            <number>5.11</number>
            <name>Photo Capture Workflow</name>
            <filePath>docs/09-UX Spec/mobile/mobilespec_sharded/detailed-screen-specifications/5.11-photo-capture-workflow-with-section-association-mobile-technician-p0.md</filePath>
            <content><![CDATA[
              [COMPLETE FILE CONTENT HERE]
            ]]></content>
          </screen>
        </screens>
        <componentLibrary>
          <type>Reusable Widgets</type>
          <components>PhotoCaptureScreen, CameraPreview, PhotoPairGallery</components>
          <filePath>docs/09-UX Spec/mobile/mobilespec_sharded/reusable-widget-library-flutter.md</filePath>
          <content><![CDATA[
            [COMPLETE RELEVANT SECTIONS]
          ]]></content>
        </componentLibrary>
      </uxSpecifications>
    </action>

    <template-output file="{default_output_file}">ux_specifications_content</template-output>
  </step>

  <critical>⚠️ UPCOMING MANDATORY SUB-AGENT INVOCATIONS (DATABASE STORIES)

  The next step (2.75) may require invoking the Schema Surveyor sub-agent up to TWO times:
  1. Fresh survey generation (if no stored survey from create-story)
  2. Schema drift validation (if stored survey exists)

  **YOU MUST (when required):**
  - Use the Task tool to invoke "bmm-schema-surveyor"
  - Wait for the sub-agent to complete its analysis
  - Receive and parse the structured response
  - Store the response in {{schema_survey_response}}

  **YOU MUST NOT:**
  - Skip the invocation
  - Manually extract schema information from story files or tech specs
  - Simulate, fake, or invent the response
  - Proceed without a valid response from Schema Surveyor

  **Validation:**
  Step 2.76 will validate that you properly invoked Schema Surveyor.
  If you skip this step, the workflow will HALT with an error.

  This sub-agent invocation is NON-NEGOTIABLE for database-related stories.
  </critical>

  <step n="2.75" goal="Database schema validation and context inclusion">
    <action>Check if story involves database work (same logic as create-story Step 4.75):
      - Parse story file for "### Database Schema Reference" section
      - If section exists: Set {{has_database_context}} = true
      - If section missing: Check for database keywords in story title/ACs
      - Set {{requires_database_validation}} based on findings
    </action>

    <check if="{{requires_database_validation}} == false">
      <action>Set {{schema_survey_context}} = "No database validation required" and skip to next step</action>
    </check>

    <action>Parse existing schema survey from story file:
      1. Locate "### Database Schema Reference" section in story file
      2. Extract schema intelligence summary:
         - Tables Affected
         - Migration Complexity
         - Security Issues
         - Migration SQL
      3. Check if Complete Schema Context file reference exists
      4. If referenced file exists:
         - Load the stored schema survey JSON (from create-story workflow)
         - Store as {{stored_schema_survey}}
      5. If no stored schema or file missing:
         - Set {{needs_fresh_survey}} = true
    </action>

    <check if="{{needs_fresh_survey}} == true">
      <output>⚠️ No stored schema survey found - generating fresh database intelligence

This may happen if:
1. Story was created before Schema Surveyor integration
2. Schema survey file was deleted
3. Story was manually created without using create-story workflow

Invoking Schema Surveyor now...
      </output>
      <action>YOU MUST NOW INVOKE Schema Surveyor to generate fresh database intelligence. This is NOT optional.

        CRITICAL INSTRUCTION - READ CAREFULLY:
        1. Use the Task tool (not any other tool or method)
        2. Set subagent_type EXACTLY as: "bmm-schema-surveyor"
        3. Set model: "sonnet"
        4. Set description: "Generate fresh schema survey for {{story_key}}"
        5. Include the COMPLETE schema-survey-request XML in the prompt parameter
        6. WAIT for the Schema Surveyor to return its response
        7. DO NOT simulate, fake, manually extract, or invent schema information
        8. DO NOT read story files or tech specs to extract schema - use ONLY Schema Surveyor response
        9. DO NOT proceed to the next action until you have a REAL response from Schema Surveyor

        Steps to execute:
        a) Extract affected tables from story ACs
        b) Construct schema-survey-request XML with refresh_cache=true
        c) Invoke Schema Surveyor sub-agent using Task tool (example below)
        d) Parse response and store as {{schema_survey_response}}

        Example Task tool invocation (YOU MUST USE THIS EXACT PATTERN):

        <invoke name="Task">
          <parameter name="subagent_type">bmm-schema-surveyor</parameter>
          <parameter name="model">sonnet</parameter>
          <parameter name="description">Generate fresh schema survey for {{story_key}}</parameter>
          <parameter name="prompt">Provide database intelligence for the following story.

        <schema-survey-request>
          <validation_mode>false</validation_mode>
          <task>
            <id>{{story_key}}</id>
            <summary>{{story_title}}</summary>
            <description>Story requires fresh schema survey</description>
          </task>
          <affected_entities>
            [extracted tables from story ACs]
          </affected_entities>
          <relationship_depth>1</relationship_depth>
          <requires_rls>true</requires_rls>
          <requires_auth>false</requires_auth>
          <refresh_cache>true</refresh_cache>
          <generate_migration>true</generate_migration>
          <run_security_audit>true</run_security_audit>
          <check_type_updates>true</check_type_updates>
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
    </check>

    <check if="{{needs_fresh_survey}} == false">
      <output>ℹ️ Found stored schema survey from create-story workflow

Validating schema hasn't changed since story creation...
      </output>
      <action>YOU MUST NOW INVOKE Schema Surveyor to validate schema for drift. This is NOT optional.

        CRITICAL INSTRUCTION - READ CAREFULLY:
        1. Use the Task tool (not any other tool or method)
        2. Set subagent_type EXACTLY as: "bmm-schema-surveyor"
        3. Set model: "sonnet"
        4. Set description: "Validate schema for drift - {{story_key}}"
        5. Include the COMPLETE schema-survey-request XML in the prompt parameter
        6. WAIT for the Schema Surveyor to return its response
        7. DO NOT simulate, fake, manually extract, or invent schema information
        8. DO NOT skip this validation - drift detection is critical
        9. DO NOT proceed to the next action until you have a REAL response from Schema Surveyor

        Steps to execute:
        a) Extract affected_entities from stored survey
        b) Construct schema-survey-request XML with validation_mode=true
        c) Invoke Schema Surveyor sub-agent using Task tool (example below)
        d) Parse response and compare against stored survey
        e) Detect drift and set {{schema_drift_detected}} flag

        Example Task tool invocation (YOU MUST USE THIS EXACT PATTERN):

        <invoke name="Task">
          <parameter name="subagent_type">bmm-schema-surveyor</parameter>
          <parameter name="model">sonnet</parameter>
          <parameter name="description">Validate schema for drift - {{story_key}}</parameter>
          <parameter name="prompt">Validate database schema and check for drift since story creation.

        <schema-survey-request>
          <validation_mode>true</validation_mode>
          <validation_type>schema_drift_check</validation_type>
          <task>
            <id>{{story_key}}-drift-validation</id>
            <summary>Check for schema drift since story creation</summary>
          </task>
          <affected_entities>
            [extracted from stored survey]
          </affected_entities>
          <relationship_depth>1</relationship_depth>
          <requires_rls>true</requires_rls>
          <requires_auth>false</requires_auth>
          <refresh_cache>true</refresh_cache>
          <generate_migration>false</generate_migration>
          <run_security_audit>true</run_security_audit>
          <check_type_updates>false</check_type_updates>
          <compare_against>{{stored_schema_survey}}</compare_against>
        </schema-survey-request>
          </parameter>
        </invoke>

        WHY YOU MUST DO THIS:
        - Schema Surveyor runs in isolated 200k token sandbox
        - This prevents schema verbosity from polluting main workflow context
        - Schema Surveyor uses MCP tools to retrieve LIVE database schema
        - Manual extraction from docs causes hallucination (wrong table/column names)
        - Schema Surveyor returns structured output per schema-survey-contract.yaml
        - Drift detection ensures dev agent has CURRENT schema, not stale data

        After invocation completes:
        1. Parse validation response
        2. Compare new survey vs stored survey:
           - Check if tables.columns match (no unexpected schema drift)
           - Check if new migrations applied since story creation
           - Check if security issues changed
        3. If differences detected:
           - Set {{schema_drift_detected}} = true
           - Log specific differences to {{schema_drift_details}}
        4. If no differences:
           - Set {{schema_drift_detected}} = false
           - Use stored survey as-is
      </action>
    </check>

    <check if="{{schema_drift_detected}} == true">
      <output>🚨 SCHEMA DRIFT DETECTED

Database schema has changed since story was created.

**Changes Detected:**
{{schema_drift_details}}

**Recommendation:**
1. Review schema changes to ensure story is still valid
2. Update story acceptance criteria if needed
3. Consider re-running create-story to refresh requirements

**Options:**
1. Continue with updated schema context (recommended)
2. Halt and review manually
      </output>
      <action>Ask user whether to continue or halt</action>
      <action>If continue: Use updated schema survey in context</action>
      <action>If halt: STOP with message to review schema changes</action>
    </check>

    <action>Prepare schema survey for context XML inclusion:
      1. Extract Complete JSON from schema survey (either stored or fresh)
      2. Format for XML embedding:
         - Wrap JSON in CDATA section to preserve structure
         - Include metadata: survey timestamp, cache status, drift detected
      3. Extract actionable intelligence:
         - Migration SQL (for dev agent reference)
         - Security requirements (critical/high priority)
         - Performance notes (indexes, optimizations)
         - TypeScript type updates
         - Test data fixtures
      4. Store as {{schema_survey_xml_content}}
    </action>

    <action>Include schema survey in story context XML:
      Create structured XML format in <databaseContext> section

      Structure:
      <databaseContext>
        <surveyMetadata>
          <timestamp>{{survey_timestamp}}</timestamp>
          <source>{{needs_fresh_survey ? 'fresh' : 'stored-and-validated'}}</source>
          <driftDetected>{{schema_drift_detected}}</driftDetected>
          <projectId>xsrimymebzinenvzyblz</projectId>
        </surveyMetadata>

        <tablesAffected>
          {{#each tables}}
          <table>
            <name>{{table.name}}</name>
            <schema>{{table.schema}}</schema>
            <primaryKey>{{table.primaryKey}}</primaryKey>
          </table>
          {{/each}}
        </tablesAffected>

        <migrationGuidance>
          <complexity>{{migration_complexity}}</complexity>
          <sql><![CDATA[
            {{migration_sql}}
          ]]></sql>
          <rollbackSql><![CDATA[
            {{rollback_sql}}
          ]]></rollbackSql>
          <testingChecklist>
            {{#each testing_checklist}}
            <item>{{item}}</item>
            {{/each}}
          </testingChecklist>
        </migrationGuidance>

        <securityRequirements>
          {{#each security_audit.critical}}
          <critical>
            <type>{{type}}</type>
            <table>{{table}}</table>
            <issue>{{issue}}</issue>
            <remediationUrl>{{remediation_url}}</remediationUrl>
          </critical>
          {{/each}}
        </securityRequirements>

        <performanceNotes>
          {{#each performance_analysis.missing_indexes}}
          <missingIndex>
            <table>{{table}}</table>
            <column>{{column}}</column>
            <reason>{{reason}}</reason>
            <recommendation>{{recommendation}}</recommendation>
          </missingIndex>
          {{/each}}
        </performanceNotes>

        <typeScriptUpdates>
          {{#each typescript_updates.changed_interfaces}}
          <interface>
            <name>{{interface}}</name>
            <file>{{file}}</file>
            <changes>{{changes}}</changes>
          </interface>
          {{/each}}
          <breakingChanges>{{typescript_updates.breaking_changes}}</breakingChanges>
        </typeScriptUpdates>

        <testDataRequirements>
          {{#each test_data_requirements.fixtures_needed}}
          <fixture>
            <table>{{table}}</table>
            <records>{{records}}</records>
            <purpose>{{purpose}}</purpose>
          </fixture>
          {{/each}}
        </testDataRequirements>

        <completeSchemaJson><![CDATA[
          {{schema_survey_json}}
        ]]></completeSchemaJson>
      </databaseContext>
    </action>

    <check if="security_audit contains critical issues">
      <output>🚨 CRITICAL DATABASE SECURITY ISSUES

{{critical_issues_count}} critical security issues detected.

**Issues:**
{{security_requirements}}

**IMPORTANT:** Dev agent MUST address these security issues during implementation.
      </output>
      <action>Add security issue warnings to context file metadata</action>
    </check>

    <action>Log Schema Surveyor invocation(s) to workflow execution record (MANDATORY):
      Create execution log entry with the following details:
      - Timestamp: {{current_timestamp}}
      - Workflow: story-context
      - Step: 2.75
      - Story Key: {{story_key}}
      - Survey Type: {{needs_fresh_survey ? 'Fresh Generation' : 'Drift Validation'}}
      - Tables Validated: {{affected_tables}} (count: {{table_count}})
      - Response Received: {{schema_survey_response != null ? 'YES' : 'NO'}}
      - Drift Detected: {{schema_drift_detected ? 'YES' : 'NO'}}
      - Security Issues: {{critical_issues}} critical, {{high_issues}} high
      - Execution Status: SUCCESS

      Output this log entry to the user with prefix "[WORKFLOW AUDIT]" for verification.

      This log entry proves Schema Surveyor was properly invoked and responded.
    </action>

    <template-output file="{default_output_file}">database_context_content</template-output>
  </step>

  <step n="2.76" goal="Validate Schema Surveyor invocation (MANDATORY GATE)">
    <critical>MANDATORY VALIDATION CHECKPOINT - Workflow CANNOT proceed without proof of invocation</critical>

    <output>🔍 SCHEMA SURVEYOR VALIDATION CHECKPOINT

    Verifying that Schema Surveyor was properly invoked in Step 2.75...
    </output>

    <check if="{{requires_database_validation}} == false">
      <output>✅ VALIDATION: SKIPPED (No database work required)

      Story does not involve database changes. Schema Surveyor invocation not required.
      Proceeding to next step...
      </output>
      <action>Skip remaining validation checks and proceed to Step 3</action>
    </check>

    <check if="{{requires_database_validation}} == true AND {{schema_survey_response}} is empty or undefined or null">
      <output>🚨 VALIDATION: FAILED - CRITICAL WORKFLOW VIOLATION

      Step 2.75 requires Schema Surveyor invocation for database-related stories, but NO response was found.

      **DIAGNOSIS:**
      - Story involves database work: YES ({{requires_database_validation}} = true)
      - Schema Surveyor response found: NO ({{schema_survey_response}} is empty/undefined)
      - This means Step 2.75 was NOT properly executed

      **ROOT CAUSE:**
      You likely:
      1. Skipped the Schema Surveyor invocation entirely
      2. Manually extracted schema from story file instead of invoking sub-agent
      3. Failed to store the response in {{schema_survey_response}}
      4. Simulated or faked the response without actual Task tool invocation

      **REQUIRED ACTION:**
      You MUST go back to Step 2.75 and properly invoke Schema Surveyor using the Task tool.
      Follow the explicit instructions in Step 2.75 for either:
      - Fresh survey generation (if no stored survey)
      - Drift validation (if stored survey exists)

      **THIS IS NON-NEGOTIABLE.**

      DO NOT proceed to Step 3 until Schema Surveyor has been properly invoked and its response stored.
      </output>

      <action>HALT workflow execution immediately</action>
      <action>Display error message to user</action>
      <action>DO NOT continue to next step</action>
      <action>DO NOT mark this step as complete</action>
      <action>WAIT for user to acknowledge and re-run Step 2.75 properly</action>
    </check>

    <check if="{{requires_database_validation}} == true AND {{schema_survey_response}} exists">
      <output>✅ VALIDATION: Schema Surveyor response found

      Verifying response structure and completeness...
      </output>

      <action>Validate response structure (MANDATORY checks):
        1. Check {{schema_survey_response}} contains database context sections
        2. Check {{schema_survey_response}} contains tables array with at least 1 table
        3. Check {{schema_survey_response}} contains security_audit if run_security_audit=true
        4. Check response is properly structured JSON/XML per schema-survey-contract.yaml
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
        - Survey type: {{needs_fresh_survey ? 'Fresh Generation' : 'Drift Validation'}}
        - Tables validated: {{table_count}}
        - Drift detected: {{schema_drift_detected ? 'YES' : 'NO'}}
        - Security issues detected: {{critical_issues}} critical, {{high_issues}} high
        - Timestamp: {{current_timestamp}}

        **Audit Log Entry Created:**
        [WORKFLOW AUDIT] Step 2.75 Schema Surveyor invocation - SUCCESS

        Proceeding to next step...
        </output>

        <action>Mark validation as PASSED</action>
        <action>Store validation timestamp for audit trail</action>
        <action>Continue to Step 3</action>
      </check>
    </check>
  </step>

  <step n="3" goal="Analyze existing code, interfaces, and constraints">
    <action>Search source tree for modules, files, and symbols matching story intent and AC keywords (controllers, services, components, tests).</action>
    <action>Identify existing interfaces/APIs the story should reuse rather than recreate.</action>
    <action>Extract development constraints from Dev Notes and architecture (patterns, layers, testing requirements).</action>
    <action>For all discovered code artifacts: convert absolute paths to project-relative format (strip {project-root} prefix).</action>
    <template-output file="{default_output_file}">
      Add artifacts.code entries with {path, kind, symbol, lines, reason}:
      - path: PROJECT-RELATIVE path only (e.g., "src/services/api.js" not full path)
      - kind: file type (controller, service, component, test, etc.)
      - symbol: function/class/interface name
      - lines: line range if specific (e.g., "45-67")
      - reason: brief explanation of relevance to this story

      Populate interfaces with API/interface signatures:
      - name: Interface or API name
      - kind: REST endpoint, GraphQL, function signature, class interface
      - signature: Full signature or endpoint definition
      - path: PROJECT-RELATIVE path to definition

      Populate constraints with development rules:
      - Extract from Dev Notes and architecture
      - Include: required patterns, layer restrictions, testing requirements, coding standards
    </template-output>
  </step>

  <step n="4" goal="Gather dependencies and frameworks">
    <action>Detect dependency manifests and frameworks in the repo:
      - Node: package.json (dependencies/devDependencies)
      - Python: pyproject.toml/requirements.txt
      - Go: go.mod
      - Unity: Packages/manifest.json, Assets/, ProjectSettings/
      - Other: list notable frameworks/configs found</action>
    <template-output file="{default_output_file}">
      Populate artifacts.dependencies with keys for detected ecosystems and their packages with version ranges where present
    </template-output>
  </step>

  <step n="5" goal="Testing standards and ideas">
    <action>From Dev Notes, architecture docs, testing docs, and existing tests, extract testing standards (frameworks, patterns, locations).</action>
    <template-output file="{default_output_file}">
      Populate tests.standards with a concise paragraph
      Populate tests.locations with directories or glob patterns where tests live
      Populate tests.ideas with initial test ideas mapped to acceptance criteria IDs
    </template-output>
  </step>

  <step n="6" goal="Validate and save">
    <anchor id="validation_step" />
    <action>Validate output context file structure and content</action>
    <invoke-task>Validate against checklist at {installed_path}/checklist.md using bmad/core/tasks/validate-workflow.xml</invoke-task>
  </step>

  <step n="6.5" goal="Sanity check validation for context file">
    <action>Perform comprehensive sanity check on generated context:

      1. UX Spec File Validation:
         - Extract all file paths from <uxSpecifications> section
         - Verify each referenced file actually exists
         - Report: List of missing files (if any)

      2. Path Format Validation:
         - Verify all paths in context XML are project-relative
         - Verify NO absolute paths present
         - Verify canonical format: "docs/09-UX Spec" (no space after hyphen)
         - Report: List of incorrectly formatted paths (if any)

      3. Content Completeness:
         - Verify <content> sections are not empty or truncated
         - Check that CDATA sections contain actual markdown content
         - Verify screen metadata matches file content (number, name)
         - Report: List of incomplete content sections (if any)

      4. Platform Consistency:
         - Verify platform matches UX spec paths (mobile → mobile specs, web → web specs)
         - Check for cross-platform stories (should have both mobile and web sections)
         - Report: Platform mismatches (if any)

      5. Reference Integrity:
         - Verify all component library references are valid
         - Check that components listed actually exist in library file
         - Report: Invalid component references (if any)
    </action>

    <check if="sanity check PASSED">
      <output>✅ CONTEXT SANITY CHECK: PASSED

Context validation successful:
- All UX spec files exist and loaded completely
- All paths are project-relative and canonical
- Platform consistency verified
- Content completeness verified
- No reference integrity issues

Context file ready for development.
      </output>
    </check>

    <check if="sanity check FAILED">
      <output>❌ CONTEXT SANITY CHECK: FAILED

Issues detected:
{{sanity_check_failures}}

**Actionable Fixes:**
{{suggested_fixes}}

Context file saved but requires manual review.
      </output>

      <action>Ask user whether to proceed marking story ready-for-dev or abort</action>
    </check>

    <template-output file="{default_output_file}">context_sanity_check_report</template-output>
  </step>

  <step n="7" goal="Update story file and mark ready for dev" tag="sprint-status">
    <action>Open {{story_path}}</action>
    <action>Find the "Status:" line (usually at the top)</action>
    <action>Update story file: Change Status to "ready-for-dev"</action>
    <action>Under 'Dev Agent Record' → 'Context Reference' (create if missing), add or update a list item for {default_output_file}.</action>
    <action>Save the story file.</action>

    <!-- Update sprint status to mark ready-for-dev -->
    <action>Load the FULL file: {{output_folder}}/sprint-status.yaml</action>
    <action>Find development_status key matching {{story_key}}</action>
    <action>Verify current status is "drafted" (expected previous state)</action>
    <action>Update development_status[{{story_key}}] = "ready-for-dev"</action>
    <action>Save file, preserving ALL comments and structure including STATUS DEFINITIONS</action>

    <check if="story key not found in file">
      <output>⚠️ Story file updated, but could not update sprint-status: {{story_key}} not found

You may need to run sprint-planning to refresh tracking.
      </output>
    </check>

    <output>✅ Story context generated successfully, {user_name}!

**Story Details:**

- Story: {{epic_id}}.{{story_id}} - {{story_title}}
- Story Key: {{story_key}}
- Context File: {default_output_file}
- Status: drafted → ready-for-dev

**Context Includes:**

- Documentation artifacts and references
- Existing code and interfaces
- Dependencies and frameworks
- Testing standards and ideas
- Development constraints

**Next Steps:**

1. Review the context file: {default_output_file}
2. Run `dev-story` to implement the story
3. Generate context for more drafted stories if needed
    </output>
  </step>

</workflow>
```
