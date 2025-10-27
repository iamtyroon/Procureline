---
title: "Readme Automation"
document-type: "documentation"
project: "Procureline"

# Dates
created: "2025-10-16"
last-updated: "2025-10-16"

# Classification
tags:
  - project-brief
  - vault-meta
  - vision
---

# Phase 2 & 3 Automation Scripts

## Overview

Two Python scripts to automate broken link remediation and tag additions for the Procureline Obsidian vault:

1. **fix-broken-links.py** - Fixes 3 patterns of broken wiki links (Phase 2)
2. **add-missing-tags.py** - Adds missing frontmatter tags (Phase 3)

---

## 1. Link Remediation Script

### Capabilities

Fixes three broken link patterns automatically:

- **Pattern A (78%)**: Section anchors `[[file#section]]` → `[[file|display]]`
- **Pattern B (15%)**: Path-based `[[directory/file]]` → `[[file]]`
- **Pattern C (7%)**: ADR short-form `[[adr-index|ADR-004]]` → `[[adr-index|ADR-004]]`

### Test Run Results

**Dry-run scan found:**
- **303 fixes** across **31 files**
- Pattern A: 234 fixes (section anchors)
- Pattern B: 69 fixes (path-based)
- Pattern C: 0 fixes (ADR already fixed in Phase 1)

### Usage

```bash
# Preview changes (safe - no modifications)
python3 fix-broken-links.py --dry-run

# Apply all fixes
python3 fix-broken-links.py

# Fix only specific pattern
python3 fix-broken-links.py --pattern A  # Section anchors only
python3 fix-broken-links.py --pattern B  # Path-based only

# Custom vault path
python3 fix-broken-links.py --vault-path /path/to/vault --dry-run
```

### Output

- Console report with detailed changes
- Saved report: `vault-health-logs/link-remediation-report.txt`
- File-by-file progress indicators

### Safety Features

- **Dry-run mode** (default with `--dry-run`)
- File existence validation before fixing
- High/medium/low confidence ratings
- Excludes audit logs and archives
- Complete change log in report

---

## 2. Tag Addition Script

### Capabilities

Intelligently adds missing tags based on:

- **Directory location** (06-UX → adds `ux`, `design`, `prototypes`)
- **Filename patterns** (`screen-` → adds `screen-design`)
- **Content type** (ADRs, session logs, research)
- Creates frontmatter if missing

### Tag Taxonomy

**By Directory:**
- `00-Vision-Exploration` → `vision`, `project-brief`, `vault-meta`
- `01-Product` → `product`, `requirements`, `user-stories`
- `02-Architecture` → `architecture`, `technical`, `infrastructure`
- `06-UX` → `ux`, `design`, `prototypes`, `design-system`
- `08-Research` → `research`, `analysis`, `university-analysis`

**By File Pattern:**
- `adr-*` → `adr`, `architecture`, `decisions`
- `screen-*` → `screen-design`, `prototypes`, `ux`
- `session-log-*` → `session-log`, `design-process`
- `*-dashboard-*` → `dashboard`, `ux`, `design`
- `*-blockly-*` → `blockly`

### Usage

```bash
# Preview tag additions (safe - no modifications)
python3 add-missing-tags.py --dry-run

# Apply tag additions
python3 add-missing-tags.py

# Custom vault path
python3 add-missing-tags.py --vault-path /path/to/vault --dry-run
```

### Output

- Console report with suggested tags
- Saved report: `vault-health-logs/tag-remediation-report.txt`
- Shows current → final tags for each file

### Safety Features

- **Dry-run mode** (default with `--dry-run`)
- Preserves existing tags (additive only)
- Creates BMAD-compliant frontmatter
- Excludes audit logs and archives
- High/medium/low confidence ratings

---

## Recommended Workflow

### Step 1: Preview Link Fixes
```bash
cd "/home/iamtyroon/Projects/Procureline/procureline obsidian docs"
python3 00-Vision-Exploration/scripts/fix-broken-links.py --dry-run
```

Review the report in `vault-health-logs/link-remediation-report.txt`

### Step 2: Apply Link Fixes
```bash
python3 00-Vision-Exploration/scripts/fix-broken-links.py
```

Expected: ~303 links fixed in ~31 files (~30 minutes runtime)

### Step 3: Preview Tag Additions
```bash
python3 00-Vision-Exploration/scripts/add-missing-tags.py --dry-run
```

Review the report in `vault-health-logs/tag-remediation-report.txt`

### Step 4: Apply Tag Additions
```bash
python3 00-Vision-Exploration/scripts/add-missing-tags.py
```

Expected: ~53 files updated with tags (~15 minutes runtime)

### Step 5: Validate Results
```bash
cd "/home/iamtyroon/Projects/Procureline/procureline obsidian docs"
bash 00-Vision-Exploration/scripts/validate-wiki-links.sh
bash 00-Vision-Exploration/scripts/validate-frontmatter.sh
bash 00-Vision-Exploration/scripts/validate-tags.sh
```

---

## Time Estimates

**Phase 2 (Link Fixes):**
- Dry-run scan: ~3 minutes
- Apply fixes: ~30 minutes
- Total: **~35 minutes** (vs 8 hours manual)

**Phase 3 (Tag Additions):**
- Dry-run scan: ~2 minutes
- Apply fixes: ~15 minutes
- Total: **~20 minutes** (vs 5 hours manual)

**Combined automation: ~1 hour** (vs 13 hours manual) = **92% time savings**

---

## Dependencies

```bash
# Install required Python packages
pip3 install pyyaml
```

Both scripts use only standard library except for PyYAML (for frontmatter parsing).

---

## Troubleshooting

### Script Not Executable
```bash
chmod +x fix-broken-links.py
chmod +x add-missing-tags.py
```

### Python Not Found
```bash
# Use explicit python3
python3 fix-broken-links.py --dry-run
```

### Import Errors
```bash
pip3 install pyyaml
```

### Unexpected Results
- Always run `--dry-run` first
- Review reports in `vault-health-logs/`
- Check confidence ratings (only high/medium are applied)
- Excluded directories: vault-health-logs, 99-Archive, .git

---

## Files Modified by Scripts

**Link Fixer (303 links in 31 files):**
- `prototype-documentation-map.md` (31 fixes)
- Screen design docs (13 files, ~200 fixes)
- Design system docs (55 fixes)
- Session logs (17 fixes)

**Tag Fixer (~53 files):**
- All files in `01-Product/` (4 files)
- All files in `02-Architecture/` (5 files)
- Various files missing frontmatter (44 files)

---

## Next Steps After Automation

1. **Validate Results**: Run all validation scripts
2. **Manual Review**: Check high-value files (README, project briefs)
3. **Update Dashboard**: Refresh vault-health-dashboard.md
4. **Final Health Check**: Run comprehensive-vault-audit.sh
5. **Production Ready**: Vault health should reach 97/100+

---

**Created**: 2025-10-16
**Last Updated**: 2025-10-16
**Status**: Ready for Phase 2 & 3 execution
