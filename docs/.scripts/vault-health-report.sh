#!/bin/bash
# Procureline Vault - Overall Health Report Generator
# Generates comprehensive vault health report

VAULT_DIR="/home/iamtyroon/Projects/Procureline/procureline obsidian docs"
REPORT_FILE="$VAULT_DIR/00-Vision-Exploration/vault-health-logs/vault-health-report-$(date '+%Y-%m-%d').md"

echo "Generating Procureline Vault Health Report..."

# Run all validation scripts
bash "$VAULT_DIR/00-Vision-Exploration/scripts/validate-frontmatter.sh" > /tmp/frontmatter.log
bash "$VAULT_DIR/00-Vision-Exploration/scripts/validate-wiki-links.sh" > /tmp/wikilinks.log
bash "$VAULT_DIR/00-Vision-Exploration/scripts/validate-tags.sh" > /tmp/tags.log

# Generate comprehensive report
cat > "$REPORT_FILE" << 'EOFSTART'
---
title: "Vault Health Report"
document-type: "health-report"
project: "Procureline"
EOFSTART

echo "report-date: \"$(date '+%Y-%m-%d')\"" >> "$REPORT_FILE"
echo "generated-by: \"vault-health-report.sh\"" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << 'EOF'
---

# Procureline Vault Health Report

EOF

echo "**Generated**: $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
echo "**Vault Location**: \`$(basename "$VAULT_DIR")\`" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << 'EOF'

---

## 📊 Overall Health Score

EOF

# Extract health scores from individual logs
FRONTMATTER_SCORE=$(grep "Frontmatter Health Score:" /tmp/frontmatter.log | awk '{print $5}' | cut -d'/' -f1)
WIKILINK_SCORE=$(grep "Wiki Link Health Score:" /tmp/wikilinks.log | awk '{print $5}' | cut -d'/' -f1)
TAG_SCORE=$(grep "Tag Health Score:" /tmp/tags.log | awk '{print $4}' | cut -d'/' -f1)

# Calculate overall average
if [ -n "$FRONTMATTER_SCORE" ] && [ -n "$WIKILINK_SCORE" ] && [ -n "$TAG_SCORE" ]; then
    OVERALL_SCORE=$(( (FRONTMATTER_SCORE + WIKILINK_SCORE + TAG_SCORE) / 3 ))

    cat >> "$REPORT_FILE" << EOF

**Overall Health Score**: $OVERALL_SCORE/100

| Category | Score | Status |
|----------|-------|--------|
| Frontmatter Completeness | $FRONTMATTER_SCORE/100 | $([ $FRONTMATTER_SCORE -ge 90 ] && echo "✅ Excellent" || echo "⚠️ Needs Attention") |
| Wiki Link Integrity | $WIKILINK_SCORE/100 | $([ $WIKILINK_SCORE -ge 90 ] && echo "✅ Excellent" || echo "⚠️ Needs Attention") |
| Tag Consistency | $TAG_SCORE/100 | $([ $TAG_SCORE -ge 90 ] && echo "✅ Excellent" || echo "⚠️ Needs Attention") |

---

## 📝 Detailed Findings

### **Frontmatter Validation**

\`\`\`
$(cat /tmp/frontmatter.log)
\`\`\`

### **Wiki Link Validation**

\`\`\`
$(cat /tmp/wikilinks.log)
\`\`\`

### **Tag Validation**

\`\`\`
$(cat /tmp/tags.log)
\`\`\`

---

## 🎯 Recommended Actions

$(if [ $FRONTMATTER_SCORE -lt 95 ]; then echo "- [ ] Complete Phase 10 implementation: Add frontmatter to all documents"; fi)
$(if [ $WIKILINK_SCORE -lt 95 ]; then echo "- [ ] Execute Phase 13: Fix all broken wiki links"; fi)
$(if [ $TAG_SCORE -lt 95 ]; then echo "- [ ] Standardize all tags according to tag-index.md taxonomy"; fi)

---

*Report generated automatically by vault-health-report.sh*
EOF
fi

echo "Vault Health Report generated: $REPORT_FILE"
cat "$REPORT_FILE"
