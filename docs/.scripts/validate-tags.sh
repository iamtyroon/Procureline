#!/bin/bash
# Procureline Vault - Tag Consistency Validation Script
# Validates tag format and taxonomy compliance

VAULT_DIR="/home/iamtyroon/Projects/Procureline/procureline obsidian docs"
TAG_INDEX="$VAULT_DIR/00-Vision-Exploration/tag-index.md"
LOG_FILE="$VAULT_DIR/00-Vision-Exploration/vault-health-logs/tag-validation.log"

echo "=== Procureline Vault Tag Validation ===" > "$LOG_FILE"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

TOTAL_TAGS=0
VALID_TAGS=0
INVALID_TAGS=0

# Check 1: Tag format validation (kebab-case, category/tag structure)
echo "--- Check 1: Tag Format Validation ---" >> "$LOG_FILE"
while IFS= read -r file; do
    # Extract tags from frontmatter
    while IFS= read -r tag; do
        ((TOTAL_TAGS++))

        # Validate format: category/subcategory/tag or category/tag (all kebab-case)
        if echo "$tag" | grep -qE "^[a-z0-9-]+(/[a-z0-9-]+)*$"; then
            ((VALID_TAGS++))
        else
            echo "❌ Invalid tag format in ${file#$VAULT_DIR/}: $tag" >> "$LOG_FILE"
            ((INVALID_TAGS++))
        fi
    done < <(sed -n '/^tags:/,/^[a-zA-Z]/p' "$file" 2>/dev/null | grep '^\s*-' | sed 's/^\s*-\s*//')
done < <(find "$VAULT_DIR" -name "*.md" -type f)

# Check 2: Tag taxonomy compliance (tag exists in tag-index.md)
echo "" >> "$LOG_FILE"
echo "--- Check 2: Tag Taxonomy Compliance ---" >> "$LOG_FILE"
ORPHANED_TAGS=0

while IFS= read -r file; do
    while IFS= read -r tag; do
        # Check if tag documented in tag-index.md
        if ! grep -q "\`$tag\`" "$TAG_INDEX" 2>/dev/null; then
            echo "⚠️  Orphaned tag (not in tag-index): $tag in ${file#$VAULT_DIR/}" >> "$LOG_FILE"
            ((ORPHANED_TAGS++))
        fi
    done < <(sed -n '/^tags:/,/^[a-zA-Z]/p' "$file" 2>/dev/null | grep '^\s*-' | sed 's/^\s*-\s*//')
done < <(find "$VAULT_DIR" -name "*.md" -type f)

# Summary
echo "" >> "$LOG_FILE"
echo "--- Validation Summary ---" >> "$LOG_FILE"
echo "📊 Total tags found: $TOTAL_TAGS" >> "$LOG_FILE"
echo "✅ Valid tag format: $VALID_TAGS" >> "$LOG_FILE"
echo "❌ Invalid tag format: $INVALID_TAGS" >> "$LOG_FILE"
echo "⚠️  Orphaned tags: $ORPHANED_TAGS" >> "$LOG_FILE"

# Calculate health score
if [ $TOTAL_TAGS -gt 0 ]; then
    HEALTH_SCORE=$(( (VALID_TAGS * 100) / TOTAL_TAGS ))
    echo "" >> "$LOG_FILE"
    echo "📊 Tag Health Score: $HEALTH_SCORE/100" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
echo "=== Validation Complete ===" >> "$LOG_FILE"

# Display results
cat "$LOG_FILE"
