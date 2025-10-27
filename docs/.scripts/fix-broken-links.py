#!/usr/bin/env python3
"""
Procureline Vault Link Remediation Tool
Automates Phase 2 & 3 broken link fixes

Handles three broken link patterns:
- Pattern A (78%): Section anchor links [[file#section]] → [[file|display]]
- Pattern B (15%): Path-based links [[directory/file]] → [[file]]
- Pattern C (7%): ADR short-form [[ADR-004]] → [[adr-index|ADR-004]]

Usage:
    python fix-broken-links.py --dry-run  # Preview changes
    python fix-broken-links.py            # Apply fixes
    python fix-broken-links.py --pattern A  # Fix only Pattern A
"""

import re
import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Tuple, Set
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class LinkFix:
    """Represents a single link fix operation"""
    file_path: str
    line_number: int
    old_link: str
    new_link: str
    pattern: str
    confidence: str  # 'high', 'medium', 'low'

class VaultLinkFixer:
    """Main class for fixing broken wiki links in Obsidian vault"""

    def __init__(self, vault_path: str, dry_run: bool = True):
        self.vault_path = Path(vault_path)
        self.dry_run = dry_run
        self.fixes: List[LinkFix] = []
        self.stats = defaultdict(int)

        # Build index of all markdown files (for validation)
        self.file_index = self._build_file_index()

        # Excluded directories (audit logs, archives)
        self.excluded_dirs = {
            'vault-health-logs',
            '99-Archive',
            '.git',
            '.obsidian',
            'node_modules'
        }

    def _build_file_index(self) -> Dict[str, Path]:
        """Build index of all markdown files for link validation"""
        index = {}
        for md_file in self.vault_path.rglob('*.md'):
            # Store both with and without .md extension
            filename = md_file.stem
            index[filename] = md_file
            index[md_file.name] = md_file
        return index

    def _should_skip_file(self, file_path: Path) -> bool:
        """Check if file should be skipped"""
        # Skip if in excluded directory
        for excluded in self.excluded_dirs:
            if excluded in file_path.parts:
                return True
        return False

    def _extract_display_text(self, link_content: str) -> str:
        """Extract meaningful display text from link"""
        # If already has pipe syntax, return as-is
        if '|' in link_content:
            return link_content.split('|', 1)[1]

        # For section anchors, extract section name
        if '#' in link_content:
            section = link_content.split('#', 1)[1]
            # Convert kebab-case or snake_case to Title Case
            return section.replace('-', ' ').replace('_', ' ').title()

        # For path-based, extract filename
        if '/' in link_content:
            return link_content.split('/')[-1]

        return link_content

    def _fix_pattern_a_section_anchor(self, link_content: str) -> Tuple[str, str]:
        """
        Fix Pattern A: Section anchor links
        [[file#section]] → [[file|section text]]

        Returns: (new_link, confidence)
        """
        if '#' not in link_content:
            return link_content, 'n/a'

        file_part, section_part = link_content.split('#', 1)

        # Validate file exists
        if file_part not in self.file_index:
            return link_content, 'low'  # Don't fix if file doesn't exist

        # Extract display text from section
        display_text = self._extract_display_text(section_part)

        # Return new link with pipe syntax
        new_link = f"{file_part}|{display_text}"
        return new_link, 'high'

    def _fix_pattern_b_path_based(self, link_content: str) -> Tuple[str, str]:
        """
        Fix Pattern B: Path-based links
        [[directory/file]] → [[file]]

        Returns: (new_link, confidence)
        """
        if '/' not in link_content:
            return link_content, 'n/a'

        # Extract filename
        filename = link_content.split('/')[-1]

        # Validate file exists
        if filename not in self.file_index:
            return link_content, 'low'  # Don't fix if file doesn't exist

        return filename, 'high'

    def _fix_pattern_c_adr_shortform(self, link_content: str) -> Tuple[str, str]:
        """
        Fix Pattern C: ADR short-form
        [[ADR-004]] → [[adr-index|ADR-004]]

        Returns: (new_link, confidence)
        """
        adr_pattern = r'^ADR-\d{3}$'
        if not re.match(adr_pattern, link_content):
            return link_content, 'n/a'

        # Validate adr-index exists
        if 'adr-index' not in self.file_index:
            return link_content, 'low'

        new_link = f"adr-index|{link_content}"
        return new_link, 'high'

    def _fix_link(self, link_content: str, pattern: str = 'auto') -> Tuple[str, str, str]:
        """
        Apply appropriate fix based on pattern

        Returns: (new_link, applied_pattern, confidence)
        """
        original = link_content

        # Try Pattern C (ADR) first (most specific)
        if pattern in ['auto', 'C']:
            new_link, confidence = self._fix_pattern_c_adr_shortform(link_content)
            if new_link != original:
                return new_link, 'C', confidence

        # Try Pattern A (section anchors)
        if pattern in ['auto', 'A']:
            new_link, confidence = self._fix_pattern_a_section_anchor(link_content)
            if new_link != original:
                return new_link, 'A', confidence

        # Try Pattern B (path-based)
        if pattern in ['auto', 'B']:
            new_link, confidence = self._fix_pattern_b_path_based(link_content)
            if new_link != original:
                return new_link, 'B', confidence

        return link_content, 'none', 'n/a'

    def scan_file(self, file_path: Path, pattern: str = 'auto') -> List[LinkFix]:
        """Scan a single file for broken links and generate fixes"""
        fixes = []

        if self._should_skip_file(file_path):
            return fixes

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Regex to match wiki links [[content]]
            wiki_link_pattern = r'\[\[([^\]]+)\]\]'

            for line_num, line in enumerate(lines, start=1):
                for match in re.finditer(wiki_link_pattern, line):
                    link_content = match.group(1)

                    # Apply fix
                    new_content, applied_pattern, confidence = self._fix_link(link_content, pattern)

                    # Only record if actually changed
                    if new_content != link_content and confidence in ['high', 'medium']:
                        fix = LinkFix(
                            file_path=str(file_path.relative_to(self.vault_path)),
                            line_number=line_num,
                            old_link=f"[[{link_content}]]",
                            new_link=f"[[{new_content}]]",
                            pattern=applied_pattern,
                            confidence=confidence
                        )
                        fixes.append(fix)
                        self.stats[f'pattern_{applied_pattern}'] += 1

        except Exception as e:
            print(f"Error scanning {file_path}: {e}", file=sys.stderr)

        return fixes

    def scan_vault(self, pattern: str = 'auto') -> None:
        """Scan entire vault for broken links"""
        print(f"{'[DRY RUN] ' if self.dry_run else ''}Scanning vault: {self.vault_path}")
        print(f"Pattern filter: {pattern}")
        print()

        # Scan all markdown files
        for md_file in self.vault_path.rglob('*.md'):
            file_fixes = self.scan_file(md_file, pattern)
            self.fixes.extend(file_fixes)

            if file_fixes and not self.dry_run:
                # Apply fixes to this file
                self._apply_fixes_to_file(md_file, file_fixes)

        self.stats['total_fixes'] = len(self.fixes)
        self.stats['files_affected'] = len(set(fix.file_path for fix in self.fixes))

    def _apply_fixes_to_file(self, file_path: Path, fixes: List[LinkFix]) -> None:
        """Apply all fixes to a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Apply fixes (in reverse order to preserve line numbers)
            for fix in sorted(fixes, key=lambda x: x.line_number, reverse=True):
                content = content.replace(fix.old_link, fix.new_link, 1)

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            print(f"✅ Fixed {len(fixes)} links in {file_path.relative_to(self.vault_path)}")

        except Exception as e:
            print(f"❌ Error applying fixes to {file_path}: {e}", file=sys.stderr)

    def generate_report(self) -> str:
        """Generate detailed report of fixes"""
        report_lines = []

        report_lines.append("=" * 80)
        report_lines.append("PROCURELINE VAULT LINK REMEDIATION REPORT")
        report_lines.append("=" * 80)
        report_lines.append("")

        # Summary statistics
        report_lines.append("SUMMARY")
        report_lines.append("-" * 80)
        report_lines.append(f"Total fixes: {self.stats['total_fixes']}")
        report_lines.append(f"Files affected: {self.stats['files_affected']}")
        report_lines.append(f"Pattern A (section anchors): {self.stats.get('pattern_A', 0)}")
        report_lines.append(f"Pattern B (path-based): {self.stats.get('pattern_B', 0)}")
        report_lines.append(f"Pattern C (ADR short-form): {self.stats.get('pattern_C', 0)}")
        report_lines.append("")

        # Group fixes by file
        fixes_by_file = defaultdict(list)
        for fix in self.fixes:
            fixes_by_file[fix.file_path].append(fix)

        # Detailed fixes
        report_lines.append("DETAILED FIXES")
        report_lines.append("-" * 80)

        for file_path in sorted(fixes_by_file.keys()):
            file_fixes = fixes_by_file[file_path]
            report_lines.append(f"\n📄 {file_path} ({len(file_fixes)} fixes)")

            for fix in file_fixes:
                report_lines.append(f"  Line {fix.line_number} [Pattern {fix.pattern}] {fix.confidence.upper()}")
                report_lines.append(f"    OLD: {fix.old_link}")
                report_lines.append(f"    NEW: {fix.new_link}")

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
        description='Fix broken wiki links in Procureline Obsidian vault'
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
        '--pattern',
        choices=['auto', 'A', 'B', 'C'],
        default='auto',
        help='Which pattern to fix (A=section anchors, B=path-based, C=ADR short-form, auto=all)'
    )
    parser.add_argument(
        '--report',
        default='link-remediation-report.txt',
        help='Output report filename'
    )

    args = parser.parse_args()

    # Initialize fixer
    fixer = VaultLinkFixer(args.vault_path, dry_run=args.dry_run)

    # Scan vault
    fixer.scan_vault(pattern=args.pattern)

    # Print report to console
    print()
    print(fixer.generate_report())

    # Save report to file
    report_path = Path(args.vault_path) / '00-Vision-Exploration' / 'vault-health-logs' / args.report
    fixer.save_report(str(report_path))

    # Summary message
    if args.dry_run:
        print("\n⚠️  DRY RUN MODE - No changes applied")
        print(f"Run without --dry-run to apply {fixer.stats['total_fixes']} fixes")
    else:
        print(f"\n✅ Successfully applied {fixer.stats['total_fixes']} fixes to {fixer.stats['files_affected']} files")

if __name__ == '__main__':
    main()
