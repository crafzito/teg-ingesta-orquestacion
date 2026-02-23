# Repository Guidelines

## How to Use This Guide

- This file provides cross-project norms and guidelines for AI agents.
- Skills are located in the `skills/` directory, each with detailed patterns.
- This AGENTS.md is the source of truth - edit it and re-run the setup script to propagate changes.

## Available Skills

Use these skills for detailed patterns on-demand:

### Project Skills
| Skill | Description | URL |
|-------|-------------|-----|
| `api-logging-guidelines` | Best practices and guidelines for using logger in API routes. Defines appropriate logging levels, what to log, and when to avoid logging. Use when implementing or reviewing API route logging, debugging strategies, or optimizing log output. | [SKILL.md](skills/api-logging-guidelines/SKILL.md) |
| `code-reviewer` | Comprehensive code review skill for TypeScript, JavaScript, Python, Swift, Kotlin, Go. Includes automated code analysis, best practice checking, security scanning, and review checklist generation. Use when reviewing pull requests, providing code feedback, identifying issues, or ensuring code quality standards. | [SKILL.md](skills/code-reviewer/SKILL.md) |
| `database-migration copy` | Execute database migrations across ORMs and platforms with zero-downtime strategies, data transformation, and rollback procedures. Use when migrating databases, changing schemas, performing data transformations, or implementing zero-downtime deployment strategies. | [SKILL.md](skills/database-migration copy/SKILL.md) |
| `database-schema-designer` | Design robust, scalable database schemas for SQL and NoSQL databases. Provides normalization guidelines, indexing strategies, migration patterns, constraint design, and performance optimization. Ensures data integrity, query performance, and maintainable data models. | [SKILL.md](skills/database-schema-designer/SKILL.md) |
| `excel-analysis` | Analyze Excel spreadsheets, create pivot tables, generate charts, and perform data analysis. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files. | [SKILL.md](skills/excel-analysis/SKILL.md) |
| `fastapi-templates copy` | Create production-ready FastAPI projects with async patterns, dependency injection, and comprehensive error handling. Use when building new FastAPI applications or setting up backend API projects. | [SKILL.md](skills/fastapi-templates copy/SKILL.md) |
| `frontend-code-review` | Trigger when the user requests a review of frontend files (e.g., `.tsx`, `.ts`, `.js`). Support both pending-change reviews and focused file reviews while applying the checklist rules. | [SKILL.md](skills/frontend-code-review/SKILL.md) |
| `python-expert` | Senior Python developer expertise for writing clean, efficient, and well-documented code. | [SKILL.md](skills/python-expert/SKILL.md) |
| `python-patterns` | Pythonic idioms, PEP 8 standards, type hints, and best practices for building robust, efficient, and maintainable Python applications. | [SKILL.md](skills/python-patterns/SKILL.md) |
| `react-modernization copy` | Upgrade React applications to latest versions, migrate from class components to hooks, and adopt concurrent features. Use when modernizing React codebases, migrating to React Hooks, or upgrading to latest React versions. | [SKILL.md](skills/react-modernization copy/SKILL.md) |
| `react-state-management copy` | Master modern React state management with Redux Toolkit, Zustand, Jotai, and React Query. Use when setting up global state, managing server state, or choosing between state management solutions. | [SKILL.md](skills/react-state-management copy/SKILL.md) |
| `reduce-unoptimized-query-oracle` | Reduce an unoptimized-query-oracle test failure log to the simplest possible reproduction case. Use when you have unoptimized-query-oracle*.log files from a failed roachtest and need to find the minimal SQL to reproduce the bug. | [SKILL.md](skills/reduce-unoptimized-query-oracle/SKILL.md) |
| `skill-sync` | Syncs skill metadata to AGENTS.md Auto-invoke sections. | [SKILL.md](skills/skill-sync/SKILL.md) |
| `sql-injection-testing` | This skill should be used when the user asks to "test for SQL injection vulnerabilities", "perform SQLi attacks", "bypass authentication using SQL injection", "extract database information through injection", "detect SQL injection flaws", or "exploit database query vulnerabilities". It provides comprehensive techniques for identifying, exploiting, and understanding SQL injection attack vectors across different database systems. | [SKILL.md](skills/sql-injection-testing/SKILL.md) |
| `strategy-advisor` | High-level strategic thinking and business decision guidance for planning and direction-setting. | [SKILL.md](skills/strategy-advisor/SKILL.md) |
| `tailwind-design-system copy` | Build scalable design systems with Tailwind CSS v4, design tokens, component libraries, and responsive patterns. Use when creating component libraries, implementing design systems, or standardizing UI patterns. | [SKILL.md](skills/tailwind-design-system copy/SKILL.md) |
| `typescript` | TypeScript code style and optimization guidelines. Use when writing TypeScript code (.ts, .tsx, .mts files), reviewing code quality, or implementing type-safe patterns. Triggers on TypeScript development, type safety questions, or code style discussions. | [SKILL.md](skills/typescript/SKILL.md) |
| `xlsx` | Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. When Claude needs to work with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc) for: (1) Creating new spreadsheets with formulas and formatting, (2) Reading or analyzing data, (3) Modify existing spreadsheets while preserving formulas, (4) Data analysis and visualization in spreadsheets, or (5) Recalculating formulas | [SKILL.md](skills/xlsx/SKILL.md) |

### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
| After creating/modifying a skill | `skill-sync` |
| Regenerate AGENTS.md Auto-invoke tables (sync.sh) | `skill-sync` |
| Troubleshoot why a skill is missing from AGENTS.md auto-invoke | `skill-sync` |

---

## Project Overview

This workspace contains AI agent skills following the [Agent Skills open standard](https://agentskills.io).

| Component | Location | Description |
|-----------|----------|-------------|
| Skills | `skills/` | AI agent skills catalog |

---

## Setup

Skills are configured for different AI assistants using setup scripts:

```powershell
# Windows
.\setup.ps1              # Interactive mode
.\setup.ps1 -All         # All AI assistants
.\setup.ps1 -Claude      # Only Claude Code
```

This creates symlinks and copies AGENTS.md to the appropriate locations for each AI assistant:
- Claude Code: `.claude/skills/` + CLAUDE.md
- Gemini CLI: `.gemini/skills/` + GEMINI.md
- Codex (OpenAI): `.codex/skills/` + AGENTS.md (native)
- GitHub Copilot: `.github/copilot-instructions.md`

---

## Commit & Pull Request Guidelines

Follow best practices for commits and pull requests:

1. Write clear, descriptive commit messages
2. Keep commits focused on a single change
3. Test your changes before committing
4. Document significant changes
5. Follow existing code patterns and conventions

---

## Code Quality

- Write clean, maintainable code
- Follow existing patterns and conventions
- Add comments for complex logic
- Ensure proper error handling
- Write tests for new functionality

---

*This file is automatically generated from skill metadata. The Auto-invoke Skills section is updated by the skill-sync tool.*