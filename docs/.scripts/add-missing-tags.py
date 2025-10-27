#!/usr/bin/env python3
"""
Procureline Vault Tag Remediation Tool
Automates Phase 3 tag additions to files with missing/incomplete frontmatter

Usage:
    python add-missing-tags.py --dry-run  # Preview changes
    python add-missing-tags.py            # Apply fixes
"""

import re
import os
import sys
import argparse
import yaml
from pathlib import Path
from typing import List, Dict, Tuple, Set
from dataclasses import dataclass
from collections import defaultdict
from datetime import datetime

@dataclass
class TagFix:
    """Represents a tag addition operation"""
    file_path: str
    current_tags: List[str]
    suggested_tags: List[str]
    confidence: str  # 'high', 'medium', 'low'
    has_frontmatter: bool

class VaultTagFixer:
    """Main class for adding missing tags to Obsidian vault files"""

    def __init__(self, vault_path: str, dry_run: bool = True):
        self.vault_path = Path(vault_path)
        self.dry_run = dry_run
        self.fixes: List[TagFix] = []
        self.stats = defaultdict(int)

        # Tag taxonomy based on BMAD v6 structure
        self.tag_rules = {
            '00-Vision-Exploration': ['vision', 'project-brief', 'vault-meta'],
            '0.5-Project-Briefs': ['project-brief', 'vision'],
            '01-Product': ['product', 'requirements', 'user-stories'],
            '02-Architecture': ['architecture', 'technical', 'infrastructure'],
            '06-UX': ['ux', 'design', 'prototypes', 'design-system'],
            '08-Research': ['research', 'analysis', 'university-analysis'],
            '99-Archive': ['archive', 'obsolete']
        }

        # File type patterns
        self.type_patterns = {
            'adr-': ['adr', 'architecture', 'decisions'],
            'screen-': ['screen-design', 'prototypes', 'ux'],
            'session-log': ['session-log', 'design-process'],
            'analysis': ['research', 'analysis'],
            'dashboard': ['dashboard', 'ux', 'design'],
            'component': ['design-system', 'components']
        }

        # Excluded directories
        self.excluded_dirs = {
            'vault-health-logs',
            '99-Archive',
            '.git',
            '.obsidian',
            'node_modules'
        }

    def _should_skip_file(self, file_path: Path) -> bool:
        """Check if file should be skipped"""
        for excluded in self.excluded_dirs:
            if excluded in file_path.parts:
                return True
        return False

    def _extract_frontmatter(self, content: str) -> Tuple[Dict, str, bool]:
        """
        Extract YAML frontmatter from markdown content

        Returns: (frontmatter_dict, remaining_content, has_frontmatter)
        """
        frontmatter_pattern = r'^---\n(.*?)\n---\n(.*)$'
        match = re.match(frontmatter_pattern, content, re.DOTALL)

        if match:
            try:
                yaml_content = match.group(1)
                remaining = match.group(2)
                frontmatter = yaml.safe_load(yaml_content) or {}
                return frontmatter, remaining, True
            except yaml.YAMLError:
                return {}, content, False

        return {}, content, False

    def _suggest_tags_for_file(self, file_path: Path, current_tags: List[str]) -> List[str]:
        """Suggest appropriate tags based on file location and name"""
        suggested = set(current_tags) if current_tags else set()

        # Add directory-based tags
        for dir_name, tags in self.tag_rules.items():
            if dir_name in file_path.parts:
                suggested.update(tags)

        # Add file pattern-based tags
        filename = file_path.stem.lower()
        for pattern, tags in self.type_patterns.items():
            if pattern in filename:
                suggested.update(tags)

        # Special rules
        if 'design-complete' in filename:
            suggested.add('production-ready')

        if 'procurement' in filename or 'po-' in filename:
            suggested.add('procurement')

        if 'departmental' in filename or 'du-' in filename:
            suggested.add('departmental-user')

        if 'blockly' in filename:
            suggested.add('blockly')

        if 'dashboard' in filename:
            suggested.add('dashboard')

        return sorted(list(suggested))

    def _create_frontmatter(self, file_path: Path, suggested_tags: List[str]) -> str:
        """Create new frontmatter block"""
        filename = file_path.stem
        today = datetime.now().strftime('%Y-%m-%d')

        # Infer document type from directory
        doc_type = 'documentation'
        if '06-UX' in file_path.parts:
            doc_type = 'design-specification'
        elif '02-Architecture' in file_path.parts:
            doc_type = 'architecture'
        elif '08-Research' in file_path.parts:
            doc_type = 'research-analysis'
        elif '01-Product' in file_path.parts:
            doc_type = 'product-specification'

        frontmatter = f"""---
title: "{filename.replace('-', ' ').title()}"
document-type: "{doc_type}"
project: "Procureline"

# Dates
created: "{today}"
last-updated: "{today}"

# Classification
tags:
"""
        for tag in suggested_tags:
            frontmatter += f"  - {tag}\n"

        frontmatter += "---\n"

        return frontmatter

    def _update_frontmatter_tags(self, frontmatter: Dict, suggested_tags: List[str]) -> Dict:
        """Update tags in existing frontmatter"""
        if 'tags' not in frontmatter:
            frontmatter['tags'] = []

        # Merge existing and suggested tags
        current = set(frontmatter.get('tags', []))
        suggested_set = set(suggested_tags)
        merged = sorted(list(current | suggested_set))

        frontmatter['tags'] = merged
        return frontmatter

    def scan_file(self, file_path: Path) -> TagFix:
        """Scan a single file and suggest tag additions"""
        if self._should_skip_file(file_path):
            return None

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            frontmatter, remaining, has_frontmatter = self._extract_frontmatter(content)

            # Get current tags
            current_tags = frontmatter.get('tags', []) if has_frontmatter else []

            # Suggest tags
            suggested_tags = self._suggest_tags_for_file(file_path, current_tags)

            # Only create fix if there are new tags to add
            new_tags = set(suggested_tags) - set(current_tags)
            if new_tags or not has_frontmatter:
                confidence = 'high' if len(new_tags) <= 3 else 'medium'

                fix = TagFix(
                    file_path=str(file_path.relative_to(self.vault_path)),
                    current_tags=current_tags,
                    suggested_tags=suggested_tags,
                    confidence=confidence,
                    has_frontmatter=has_frontmatter
                )

                self.stats['files_to_update'] += 1
                if not has_frontmatter:
                    self.stats['missing_frontmatter'] += 1
                self.stats['tags_to_add'] += len(new_tags)

                return fix

        except Exception as e:
            print(f"Error scanning {file_path}: {e}", file=sys.stderr)

        return None

    def scan_vault(self) -> None:
        """Scan entire vault for files needing tags"""
        print(f"{'[DRY RUN] ' if self.dry_run else ''}Scanning vault: {self.vault_path}")
        print()

        # Scan all markdown files
        for md_file in self.vault_path.rglob('*.md'):
            fix = self.scan_file(md_file)
            if fix:
                self.fixes.append(fix)

                if not self.dry_run:
                    self._apply_tag_fix(self.vault_path / fix.file_path, fix)

    def _apply_tag_fix(self, file_path: Path, fix: TagFix) -> None:
        """Apply tag fix to a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if fix.has_frontmatter:
                # Update existing frontmatter
                frontmatter, remaining, _ = self._extract_frontmatter(content)
                updated_fm = self._update_frontmatter_tags(frontmatter, fix.suggested_tags)

                # Serialize back to YAML
                yaml_str = yaml.dump(updated_fm, default_flow_style=False, allow_unicode=True, sort_keys=False)
                new_content = f"---\n{yaml_str}---\n{remaining}"
            else:
                # Create new frontmatter
                new_frontmatter = self._create_frontmatter(file_path, fix.suggested_tags)
                new_content = new_frontmatter + "\n" + content

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)

            print(f"✅ Updated tags in {file_path.relative_to(self.vault_path)}")

        except Exception as e:
            print(f"❌ Error applying tag fix to {file_path}: {e}", file=sys.stderr)

    def generate_report(self) -> str:
        """Generate detailed report of tag additions"""
        report_lines = []

        report_lines.append("=" * 80)
        report_lines.append("PROCURELINE VAULT TAG REMEDIATION REPORT")
        report_lines.append("=" * 80)
        report_lines.append("")

        # Summary statistics
        report_lines.append("SUMMARY")
        report_lines.append("-" * 80)
        report_lines.append(f"Files to update: {self.stats['files_to_update']}")
        report_lines.append(f"Missing frontmatter: {self.stats['missing_frontmatter']}")
        report_lines.append(f"Tags to add: {self.stats['tags_to_add']}")
        report_lines.append("")

        # Detailed fixes
        report_lines.append("DETAILED TAG ADDITIONS")
        report_lines.append("-" * 80)

        for fix in self.fixes:
            new_tags = set(fix.suggested_tags) - set(fix.current_tags)

            report_lines.append(f"\n📄 {fix.file_path}")
            report_lines.append(f"  Status: {'Missing frontmatter' if not fix.has_frontmatter else 'Has frontmatter'}")
            report_lines.append(f"  Confidence: {fix.confidence.upper()}")

            if fix.current_tags:
                report_lines.append(f"  Current tags: {', '.join(fix.current_tags)}")

            if new_tags:
                report_lines.append(f"  New tags: {', '.join(sorted(new_tags))}")

            report_lines.append(f"  Final tags: {', '.join(fix.suggested_tags)}")

        report_lines.append("")
        report_lines.append("=" * 80)

        return "\n".join(report_lines)

    def save_report(self, output_path: str) -> None:
        """Save report to file"""
        report = self.generate_report()
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n📊 Report saved: {output_path}")

def main():
    parser = argparse.ArgumentParser(
        description='Add missing tags to Procureline Obsidian vault files'
    )
    parser.add_argument(
        '--vault-path',
        default='/home/iamtyroon/Projects/Procureline/procureline obsidian docs',
        help='Path to Obsidian vault'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without applying them'
    )
    parser.add_argument(
        '--report',
        default='tag-remediation-report.txt',
        help='Output report filename'
    )

    args = parser.parse_args()

    # Initialize fixer
    fixer = VaultTagFixer(args.vault_path, dry_run=args.dry_run)

    # Scan vault
    fixer.scan_vault()

    # Print report to console
    print()
    print(fixer.generate_report())

    # Save report to file
    report_path = Path(args.vault_path) / '00-Vision-Exploration' / 'vault-health-logs' / args.report
    fixer.save_report(str(report_path))

    # Summary message
    if args.dry_run:
        print("\n⚠️  DRY RUN MODE - No changes applied")
        print(f"Run without --dry-run to update {fixer.stats['files_to_update']} files")
    else:
        print(f"\n✅ Successfully updated {fixer.stats['files_to_update']} files")

if __name__ == '__main__':
    main()
