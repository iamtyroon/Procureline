#!/bin/bash
# Procureline Vault - Wiki Link Validation Script
# Validates all [[wiki-links]] throughout the vault

VAULT_DIR="/home/iamtyroon/Projects/Procureline/procureline obsidian docs"
LOG_FILE="$VAULT_DIR/00-Vision-Exploration/vault-health-logs/wiki-link-validation.log"

echo "=== Procureline Vault Wiki Link Validation ===" > "$LOG_FILE"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

TOTAL_LINKS=0
VALID_LINKS=0
BROKEN_LINKS=0

# Extract all wiki links and validate
echo "--- Validating Wiki Links ---" >> "$LOG_FILE"
while IFS= read -r file; do
    # Extract [[wiki-links]] from file
    while IFS= read -r link; do
        ((TOTAL_LINKS++))

        # Clean link (remove alias and anchor if present)
        clean_link=$(echo "$link" | cut -d'|' -f1 | cut -d'#' -f1)

        # Extract just the basename if path is included
        basename_link=$(basename "$clean_link")

        # Check if target file exists (search entire vault)
        if find "$VAULT_DIR" -name "${basename_link}.md" -type f | grep -q .; then
            ((VALID_LINKS++))
        else
            echo "❌ Broken link in ${file#$VAULT_DIR/}: [[${link}]]" >> "$LOG_FILE"
            ((BROKEN_LINKS++))
        fi
    done < <(grep -o '\[\[.*\]\]' "$file" 2>/dev/null | sed 's/\[\[\(.*\)\]\]/\1/')
done < <(find "$VAULT_DIR" -name "*.md" -type f)

# Summary
echo "" >> "$LOG_FILE"
echo "--- Validation Summary ---" >> "$LOG_FILE"
echo "📊 Total wiki links found: $TOTAL_LINKS" >> "$LOG_FILE"
echo "✅ Valid links: $VALID_LINKS" >> "$LOG_FILE"
echo "❌ Broken links: $BROKEN_LINKS" >> "$LOG_FILE"

# Calculate health score
if [ $TOTAL_LINKS -gt 0 ]; then
    HEALTH_SCORE=$(( (VALID_LINKS * 100) / TOTAL_LINKS ))
    echo "" >> "$LOG_FILE"
    echo "📊 Wiki Link Health Score: $HEALTH_SCORE/100" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
echo "=== Validation Complete ===" >> "$LOG_FILE"

# Display results
cat "$LOG_FILE"
