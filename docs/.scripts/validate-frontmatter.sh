#!/bin/bash
# Procureline Vault - Frontmatter Validation Script
# Validates frontmatter consistency across all vault documents

VAULT_DIR="/home/iamtyroon/Projects/Procureline/procureline obsidian docs"
LOG_FILE="$VAULT_DIR/00-Vision-Exploration/vault-health-logs/frontmatter-validation.log"

echo "=== Procureline Vault Frontmatter Validation ===" > "$LOG_FILE"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

MISSING_COUNT=0
INVALID_COUNT=0
VALID_COUNT=0

# Check 1: Missing frontmatter
echo "--- Check 1: Missing Frontmatter ---" >> "$LOG_FILE"
while IFS= read -r file; do
    if ! head -1 "$file" | grep -q "^---$"; then
        echo "❌ Missing frontmatter: ${file#$VAULT_DIR/}" >> "$LOG_FILE"
        ((MISSING_COUNT++))
    else
        ((VALID_COUNT++))
    fi
done < <(find "$VAULT_DIR" -name "*.md" -type f)

# Check 2: Required fields
echo "" >> "$LOG_FILE"
echo "--- Check 2: Required Fields ---" >> "$LOG_FILE"
REQUIRED_FIELDS=("title" "document-type" "project" "created" "last-updated" "tags")

while IFS= read -r file; do
    if head -1 "$file" | grep -q "^---$"; then
        for field in "${REQUIRED_FIELDS[@]}"; do
            if ! grep -q "^$field:" "$file"; then
                echo "❌ Missing field '$field': ${file#$VAULT_DIR/}" >> "$LOG_FILE"
                ((INVALID_COUNT++))
            fi
        done
    fi
done < <(find "$VAULT_DIR" -name "*.md" -type f)

# Check 3: Date format validation
echo "" >> "$LOG_FILE"
echo "--- Check 3: Date Format Validation ---" >> "$LOG_FILE"
while IFS= read -r file; do
    while IFS= read -r line; do
        echo "❌ Invalid date format in ${file#$VAULT_DIR/}: $line" >> "$LOG_FILE"
        ((INVALID_COUNT++))
    done < <(grep -E "^(created|last-updated|session-date|completion-date):" "$file" | grep -v -E "[0-9]{4}-[0-9]{2}-[0-9]{2}")
done < <(find "$VAULT_DIR" -name "*.md" -type f)

# Summary
echo "" >> "$LOG_FILE"
echo "--- Validation Summary ---" >> "$LOG_FILE"
echo "✅ Valid documents: $VALID_COUNT" >> "$LOG_FILE"
echo "❌ Missing frontmatter: $MISSING_COUNT" >> "$LOG_FILE"
echo "⚠️  Invalid fields: $INVALID_COUNT" >> "$LOG_FILE"

# Calculate health score
TOTAL=$((VALID_COUNT + MISSING_COUNT))
if [ $TOTAL -gt 0 ]; then
    HEALTH_SCORE=$(( (VALID_COUNT * 100) / TOTAL ))
    echo "" >> "$LOG_FILE"
    echo "📊 Frontmatter Health Score: $HEALTH_SCORE/100" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
echo "=== Validation Complete ===" >> "$LOG_FILE"

# Display results
cat "$LOG_FILE"
