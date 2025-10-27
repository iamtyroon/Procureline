#!/bin/bash

# Comprehensive Vault Validation Audit
# Validates ALL aspects of the Procureline Obsidian vault
# Generated: 2025-10-07

VAULT_ROOT="/home/iamtyroon/Projects/Procureline/procureline obsidian docs"
REPORT_FILE="$VAULT_ROOT/00-Vision-Exploration/vault-health-logs/comprehensive-audit-$(date +%Y-%m-%d).md"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
P0_ISSUES=0
P1_ISSUES=0
P2_ISSUES=0

echo "# Comprehensive Vault Validation Audit" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Generated**: $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
echo "**Vault Path**: $VAULT_ROOT" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Function to log issue
log_issue() {
    local severity=$1
    local category=$2
    local message=$3

    echo "- **[$severity]** [$category] $message" >> "$REPORT_FILE"

    case $severity in
        P0) ((P0_ISSUES++)) ;;
        P1) ((P1_ISSUES++)) ;;
        P2) ((P2_ISSUES++)) ;;
    esac
}

echo "## 1. File Existence Verification" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check for documented files that don't exist
echo "### 1.1 Documented Files That Don't Exist" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Critical file from refactoring-plan-v3.md that doesn't exist
if [ ! -f "$VAULT_ROOT/00-Project-Briefs/Procureline-Project-Brief.md" ]; then
    log_issue "P0" "File Missing" "\`00-Project-Briefs/Procureline-Project-Brief.md\` documented in refactoring-plan-v3.md but does not exist"
fi

# Check actual file exists
if [ -f "$VAULT_ROOT/00-Vision-Exploration/procureline-vision-brief.md" ]; then
    log_issue "P1" "Naming Inconsistency" "File exists as \`00-Vision-Exploration/procureline-vision-brief.md\` but is referenced as \`00-Project-Briefs/Procureline-Project-Brief.md\` in documentation"
fi

echo "" >> "$REPORT_FILE"
echo "### 1.2 File Count Summary" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

TOTAL_FILES=$(find "$VAULT_ROOT" -type f -name "*.md" | wc -l)
echo "- **Total Markdown Files**: $TOTAL_FILES" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# List all directories
echo "### 1.3 Directory Structure" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
find "$VAULT_ROOT" -type d | grep -v ".obsidian" | sort >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## 2. Cross-Reference Integrity" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Extract all wiki links from all files
echo "### 2.1 Wiki Link Validation" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

BROKEN_LINKS=0
TOTAL_LINKS=0

# Find all wiki links and check if target exists
while IFS= read -r file; do
    # Extract wiki links from file
    grep -oP '\[\[.*?\]\]' "$file" 2>/dev/null | while read -r link; do
        ((TOTAL_LINKS++))

        # Remove [[ and ]]
        target=$(echo "$link" | sed 's/\[\[\(.*\)\]\]/\1/')

        # Handle aliases (text|link)
        if [[ "$target" == *"|"* ]]; then
            target=$(echo "$target" | cut -d'|' -f2)
        fi

        # Check if file exists (search entire vault)
        if ! find "$VAULT_ROOT" -type f -name "${target}.md" | grep -q .; then
            log_issue "P1" "Broken Link" "In \`${file#$VAULT_ROOT/}\`: Link to \`$target\` not found"
            ((BROKEN_LINKS++))
        fi
    done
done < <(find "$VAULT_ROOT" -type f -name "*.md")

echo "- **Total Wiki Links Found**: $TOTAL_LINKS" >> "$REPORT_FILE"
echo "- **Broken Links**: $BROKEN_LINKS" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## 3. Metadata Consistency" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 3.1 YAML Frontmatter Validation" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

FILES_WITHOUT_FRONTMATTER=0
FILES_WITH_FRONTMATTER=0

while IFS= read -r file; do
    # Skip README and index files in root
    basename=$(basename "$file")
    if [[ "$basename" == "README.md" || "$basename" == "vault-index.md" ]]; then
        continue
    fi

    # Check if file starts with ---
    if ! head -n 1 "$file" | grep -q "^---$"; then
        log_issue "P2" "Missing Frontmatter" "\`${file#$VAULT_ROOT/}\` has no YAML frontmatter"
        ((FILES_WITHOUT_FRONTMATTER++))
    else
        ((FILES_WITH_FRONTMATTER++))
    fi
done < <(find "$VAULT_ROOT" -type f -name "*.md" -not -path "*/.obsidian/*")

echo "- **Files with Frontmatter**: $FILES_WITH_FRONTMATTER" >> "$REPORT_FILE"
echo "- **Files without Frontmatter**: $FILES_WITHOUT_FRONTMATTER" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## 4. Directory Structure Compliance (BMAD v6)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 4.1 Expected Directory Structure" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Define expected directories
declare -a EXPECTED_DIRS=(
    "00-Project-Briefs"
    "00-Vision-Exploration"
    "01-Product"
    "02-Architecture"
    "03-Stories"
    "04-Development"
    "05-Quality"
    "06-UX"
    "07-Management"
    "08-Research"
    "99-Archive"
)

MISSING_DIRS=0
for dir in "${EXPECTED_DIRS[@]}"; do
    if [ ! -d "$VAULT_ROOT/$dir" ]; then
        log_issue "P0" "Missing Directory" "Expected directory \`$dir\` does not exist"
        ((MISSING_DIRS++))
    fi
done

echo "- **Expected Directories**: ${#EXPECTED_DIRS[@]}" >> "$REPORT_FILE"
echo "- **Missing Directories**: $MISSING_DIRS" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## 5. Summary" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Issue Count by Severity" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "- **P0 (Critical)**: $P0_ISSUES" >> "$REPORT_FILE"
echo "- **P1 (High)**: $P1_ISSUES" >> "$REPORT_FILE"
echo "- **P2 (Medium)**: $P2_ISSUES" >> "$REPORT_FILE"
echo "- **Total Issues**: $((P0_ISSUES + P1_ISSUES + P2_ISSUES))" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Calculate vault health score
TOTAL_CHECKS=$((TOTAL_FILES + FILES_WITH_FRONTMATTER + 11))
PASSED_CHECKS=$((TOTAL_CHECKS - P0_ISSUES - P1_ISSUES - P2_ISSUES))
HEALTH_SCORE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo "### Vault Health Score" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Score**: $HEALTH_SCORE/100" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ $HEALTH_SCORE -ge 95 ]; then
    echo "**Status**: ✅ Excellent (Production Ready)" >> "$REPORT_FILE"
elif [ $HEALTH_SCORE -ge 85 ]; then
    echo "**Status**: ✅ Good (Minor Issues)" >> "$REPORT_FILE"
elif [ $HEALTH_SCORE -ge 70 ]; then
    echo "**Status**: ⚠️ Fair (Needs Attention)" >> "$REPORT_FILE"
else
    echo "**Status**: ❌ Poor (Requires Immediate Action)" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Audit Complete**: $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"

# Print summary to console
echo -e "${GREEN}Vault Audit Complete!${NC}"
echo -e "Report saved to: $REPORT_FILE"
echo ""
echo -e "Issues Found:"
echo -e "  ${RED}P0 (Critical): $P0_ISSUES${NC}"
echo -e "  ${YELLOW}P1 (High): $P1_ISSUES${NC}"
echo -e "  P2 (Medium): $P2_ISSUES"
echo ""
echo -e "Vault Health Score: $HEALTH_SCORE/100"

exit 0
