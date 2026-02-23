# Setup AI Skills for development
# Configures AI coding assistants that follow agentskills.io standard:
#   - Claude Code: .claude/skills/ symlink + CLAUDE.md copies
#   - Gemini CLI: .gemini/skills/ symlink + GEMINI.md copies
#   - Codex (OpenAI): .codex/skills/ symlink + AGENTS.md (native)
#   - GitHub Copilot: .github/copilot-instructions.md copy
#
# Usage:
#   .\setup.ps1              # Interactive mode (select AI assistants)
#   .\setup.ps1 -All         # Configure all AI assistants
#   .\setup.ps1 -Claude      # Configure only Claude Code
#   .\setup.ps1 -Claude -Codex  # Configure multiple

param(
    [switch]$All,
    [switch]$Claude,
    [switch]$Gemini,
    [switch]$Codex,
    [switch]$Copilot,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# FIX 1 & 2: El script esta en la raiz del repo, NO dentro de skills/
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsSource = Join-Path $RepoRoot "skills"

# Selection flags
$Script:SetupClaude = $false
$Script:SetupGemini = $false
$Script:SetupCodex = $false
$Script:SetupCopilot = $false

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

function Show-Help {
    Write-Host "Usage: .\setup.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Configure AI coding assistants for development."
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -All       Configure all AI assistants"
    Write-Host "  -Claude    Configure Claude Code"
    Write-Host "  -Gemini    Configure Gemini CLI"
    Write-Host "  -Codex     Configure Codex (OpenAI)"
    Write-Host "  -Copilot   Configure GitHub Copilot"
    Write-Host "  -Help      Show this help message"
    Write-Host ""
    Write-Host "If no options provided, runs in interactive mode."
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\setup.ps1                      # Interactive selection"
    Write-Host "  .\setup.ps1 -All                 # All AI assistants"
    Write-Host "  .\setup.ps1 -Claude -Codex       # Only Claude and Codex"
    Write-Host ""
    Write-Host "Note: This script may require Administrator privileges to create symbolic links."
}

function Show-Menu {
    $options = @("Claude Code", "Gemini CLI", "Codex (OpenAI)", "GitHub Copilot")
    $selected = @($true, $false, $false, $false)

    while ($true) {
        Clear-Host
        Write-Host "AI Skills Setup" -ForegroundColor White
        Write-Host "==========================" -ForegroundColor White
        Write-Host ""
        Write-Host "Which AI assistants do you use?" -ForegroundColor White
        Write-Host "(Use numbers to toggle, Enter to confirm)" -ForegroundColor Cyan
        Write-Host ""

        for ($i = 0; $i -lt $options.Length; $i++) {
            if ($selected[$i]) {
                Write-Host "  [x] $($i+1). $($options[$i])" -ForegroundColor Green
            }
            else {
                Write-Host "  [ ] $($i+1). $($options[$i])"
            }
        }
        Write-Host ""
        Write-Host "  a. Select all" -ForegroundColor Yellow
        Write-Host "  n. Select none" -ForegroundColor Yellow
        Write-Host ""
        $choice = Read-Host "Toggle (1-4, a, n) or Enter to confirm"

        switch ($choice) {
            "1" { $selected[0] = -not $selected[0] }
            "2" { $selected[1] = -not $selected[1] }
            "3" { $selected[2] = -not $selected[2] }
            "4" { $selected[3] = -not $selected[3] }
            { $_ -in "a","A" } { $selected = @($true, $true, $true, $true) }
            { $_ -in "n","N" } { $selected = @($false, $false, $false, $false) }
            "" { break }
            default {
                Write-Host "Invalid option" -ForegroundColor Red
                Start-Sleep -Seconds 1
            }
        }

        if ($choice -eq "") { break }
    }

    $Script:SetupClaude = $selected[0]
    $Script:SetupGemini = $selected[1]
    $Script:SetupCodex = $selected[2]
    $Script:SetupCopilot = $selected[3]
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Extract-YamlField {
    param(
        [string]$FilePath,
        [string]$Field
    )

    $content = Get-Content $FilePath -Raw
    $pattern = "(?ms)^---\s*\r?\n(.*?)\r?\n---\s*\r?\n"
    if ($content -match $pattern) {
        $frontmatter = $matches[1]

        # Multiline value (folded or literal block)
        $fieldPattern = "(?ms)^$Field\s*:\s*[>|]?\s*\r?\n((?:\s+.+\r?\n?)*)"
        if ($frontmatter -match $fieldPattern) {
            $value = $matches[1]
            $value = ($value -split '\r?\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join ' '
            return $value.Trim()
        }

        # Single line value
        $fieldPattern = "(?m)^$Field\s*:\s*[>""]?\s*(.+?)(\r?\n|$)"
        if ($frontmatter -match $fieldPattern) {
            $value = $matches[1].Trim()
            $value = $value -replace '^["'']', ''
            $value = $value -replace '["'']$', ''
            return $value
        }
    }
    return ""
}

function Extract-MetadataField {
    param(
        [string]$FilePath,
        [string]$Field
    )

    $content = Get-Content $FilePath -Raw
    $pattern = "(?ms)^---\s*\r?\n(.*?)\r?\n---\s*\r?\n"
    if ($content -match $pattern) {
        $frontmatter = $matches[1]

        $inMetadata = $false
        $lines = $frontmatter -split '\r?\n'
        $result = @()
        $collectingList = $false

        foreach ($line in $lines) {
            if ($line -match '^\s*metadata\s*:') {
                $inMetadata = $true
                continue
            }

            if ($inMetadata) {
                if ($line -match "^\s*$Field\s*:\s*(.*)") {
                    $value = $matches[1].Trim()

                    # Inline array: [item1, item2]
                    if ($value -match '^\[.*\]$') {
                        $value = $value -replace '^\[|\]$', ''
                        $items = $value -split ',' | ForEach-Object { $_.Trim().Trim('"').Trim("'") }
                        return ($items -join '|')
                    }
                    elseif ($value) {
                        return $value -replace '^["'']|["'']$', ''
                    }
                    else {
                        # List follows on next lines
                        $collectingList = $true
                        continue
                    }
                }

                if ($collectingList -and $line -match '^\s+-\s+(.+)') {
                    $item = $matches[1].Trim() -replace '^["'']|["'']$', ''
                    $result += $item
                }
                elseif ($collectingList -and $line -match '^\s*\w+\s*:') {
                    # New field in metadata, stop collecting
                    break
                }
                elseif ($line -match '^\S') {
                    # Left-aligned = out of metadata block
                    break
                }
            }
        }

        if ($result.Count -gt 0) {
            return ($result -join '|')
        }
    }
    return ""
}

# FIX 5: Descubre skills de TODAS las fuentes (.agents/skills/ y .claude/skills/)
function Get-AllSkillFiles {
    $allSkills = @{}

    # Fuente principal: .agents/skills/
    if (Test-Path $SkillsSource) {
        $agentsSkills = Get-ChildItem -Path $SkillsSource -Filter "SKILL.md" -Recurse -File |
            Where-Object { $_.Directory.Parent.Name -eq "skills" }
        foreach ($sf in $agentsSkills) {
            $allSkills[$sf.Directory.Name] = $sf
        }
    }

    # Fuente adicional: .claude/skills/ (para skills como skill-sync que solo estan ahi)
    $claudeSkillsDir = Join-Path $RepoRoot ".claude\skills"
    if (Test-Path $claudeSkillsDir) {
        $claudeSkills = Get-ChildItem -Path $claudeSkillsDir -Filter "SKILL.md" -Recurse -File |
            Where-Object { $_.Directory.Parent.Name -eq "skills" }
        foreach ($sf in $claudeSkills) {
            if (-not $allSkills.ContainsKey($sf.Directory.Name)) {
                $allSkills[$sf.Directory.Name] = $sf
            }
        }
    }

    return $allSkills.Values | Sort-Object { $_.Directory.Name }
}

# FIX 3: Genera AGENTS.md CON la tabla auto-invoke poblada
function Generate-AgentsMd {
    Write-Host "  Generating AGENTS.md from skills..." -ForegroundColor Cyan

    $skillFiles = Get-AllSkillFiles

    # --- Build Project Skills table ---
    $skillsTable = ""
    foreach ($skillFile in $skillFiles) {
        $skillName = $skillFile.Directory.Name
        $description = Extract-YamlField -FilePath $skillFile.FullName -Field "description"

        if ($description) {
            $description = $description -replace "(?s)\s*Trigger:.*$", ""
            $description = $description -replace "\s*Use when:.*$", ""
            $description = $description.Trim()
        }
        else {
            $description = ""
        }

        $relativePath = "skills/$skillName/SKILL.md"
        $skillsTable += "| ``$skillName`` | $description | [SKILL.md]($relativePath) |`n"
    }

    # --- Build Auto-invoke table ---
    $autoInvokeRows = @()
    foreach ($skillFile in $skillFiles) {
        $skillName = Extract-YamlField -FilePath $skillFile.FullName -Field "name"
        if (-not $skillName) { $skillName = $skillFile.Directory.Name }

        $autoInvokeRaw = Extract-MetadataField -FilePath $skillFile.FullName -Field "auto_invoke"
        if (-not $autoInvokeRaw) { continue }

        $actions = $autoInvokeRaw -split '\|' | ForEach-Object { $_.Trim() }
        foreach ($action in $actions) {
            if ($action) {
                $autoInvokeRows += [PSCustomObject]@{ Action = $action; Skill = $skillName }
            }
        }
    }

    $autoInvokeTable = ""
    if ($autoInvokeRows.Count -gt 0) {
        $sorted = $autoInvokeRows | Sort-Object Action
        foreach ($row in $sorted) {
            $autoInvokeTable += "| $($row.Action) | ``$($row.Skill)`` |`n"
        }
    }

    $agentsMdContent = @"
# Repository Guidelines

## How to Use This Guide

- This file provides cross-project norms and guidelines for AI agents.
- Skills are located in the ``skills/`` directory, each with detailed patterns.
- This AGENTS.md is the source of truth - edit it and re-run the setup script to propagate changes.

## Available Skills

Use these skills for detailed patterns on-demand:

### Project Skills
| Skill | Description | URL |
|-------|-------------|-----|
$skillsTable
### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
$autoInvokeTable
---

## Project Overview

This workspace contains AI agent skills following the [Agent Skills open standard](https://agentskills.io).

| Component | Location | Description |
|-----------|----------|-------------|
| Skills | ``skills/`` | AI agent skills catalog |

---

## Setup

Skills are configured for different AI assistants using setup scripts:

``````powershell
# Windows
.\setup.ps1              # Interactive mode
.\setup.ps1 -All         # All AI assistants
.\setup.ps1 -Claude      # Only Claude Code
``````

This creates symlinks and copies AGENTS.md to the appropriate locations for each AI assistant:
- Claude Code: ``.claude/skills/`` + CLAUDE.md
- Gemini CLI: ``.gemini/skills/`` + GEMINI.md
- Codex (OpenAI): ``.codex/skills/`` + AGENTS.md (native)
- GitHub Copilot: ``.github/copilot-instructions.md``

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
"@

    $agentsMdPath = Join-Path $RepoRoot "AGENTS.md"
    Set-Content -Path $agentsMdPath -Value $agentsMdContent -Encoding UTF8 -NoNewline
    Write-Host "  OK Generated AGENTS.md with $($skillFiles.Count) skills ($($autoInvokeRows.Count) auto-invoke rules)" -ForegroundColor Green
}

function Remove-ExistingLink {
    param([string]$Path, [string]$BackupBase)

    if (-not (Test-Path $Path)) { return }

    $item = Get-Item $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) { return }

    if ($item.LinkType -eq "SymbolicLink" -or $item.Attributes -match "ReparsePoint") {
        Remove-Item $Path -Force -ErrorAction SilentlyContinue
    }
    elseif ($item.PSIsContainer) {
        $timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
        Move-Item $Path "$BackupBase.backup.$timestamp" -Force
    }
}

function Setup-SkillsSymlink {
    param(
        [string]$AssistantDir,
        [string]$Label
    )

    $targetDir = Join-Path $RepoRoot "$AssistantDir\skills"
    $parentDir = Join-Path $RepoRoot $AssistantDir

    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    Remove-ExistingLink -Path $targetDir -BackupBase (Join-Path $parentDir "skills")

    New-Item -ItemType SymbolicLink -Path $targetDir -Target $SkillsSource -Force | Out-Null
    Write-Host "  OK $AssistantDir/skills -> skills/" -ForegroundColor Green
}

function Setup-Claude {
    Setup-SkillsSymlink -AssistantDir ".claude" -Label "Claude Code"

    # Copiar skills adicionales que solo estan en .claude/skills/ (como skill-sync)
    $claudeOnlySkills = Join-Path $RepoRoot ".claude\skills"
    if (Test-Path $claudeOnlySkills) {
        $existingExtra = Get-ChildItem -Path $claudeOnlySkills -Directory -ErrorAction SilentlyContinue |
            Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint) }
        if ($existingExtra) {
            Write-Host "  OK Preserved $($existingExtra.Count) Claude-only skill(s): $($existingExtra.Name -join ', ')" -ForegroundColor Green
        }
    }

    Copy-AgentsMd "CLAUDE.md"
}

function Setup-Gemini {
    Setup-SkillsSymlink -AssistantDir ".gemini" -Label "Gemini CLI"
    Copy-AgentsMd "GEMINI.md"
}

function Setup-Codex {
    Setup-SkillsSymlink -AssistantDir ".codex" -Label "Codex"
    Write-Host "  OK Codex uses AGENTS.md natively" -ForegroundColor Green
}

function Setup-Copilot {
    $agentsFile = Join-Path $RepoRoot "AGENTS.md"
    if (Test-Path $agentsFile) {
        $githubDir = Join-Path $RepoRoot ".github"
        if (-not (Test-Path $githubDir)) {
            New-Item -ItemType Directory -Path $githubDir -Force | Out-Null
        }
        Copy-Item $agentsFile (Join-Path $githubDir "copilot-instructions.md") -Force
        Write-Host "  OK AGENTS.md -> .github/copilot-instructions.md" -ForegroundColor Green
    }
}

# FIX 4: Copy-AgentsMd maneja correctamente strings y FileInfo
function Copy-AgentsMd {
    param([string]$TargetName)

    $agentsFilePath = Join-Path $RepoRoot "AGENTS.md"

    if (-not (Test-Path $agentsFilePath)) {
        Write-Host "  Warning: AGENTS.md not found, skipping copy" -ForegroundColor Yellow
        return
    }

    $count = 0

    # Copiar el AGENTS.md raiz
    $targetPath = Join-Path $RepoRoot $TargetName
    Copy-Item $agentsFilePath $targetPath -Force
    $count++

    # Buscar AGENTS.md adicionales en subdirectorios
    $additionalAgents = Get-ChildItem -Path $RepoRoot -Filter "AGENTS.md" -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -ne $agentsFilePath -and
            $_.FullName -notmatch '[\\/]node_modules[\\/]' -and
            $_.FullName -notmatch '[\\/]\.git[\\/]' -and
            $_.FullName -notmatch '[\\/]\.agents[\\/]' -and
            $_.FullName -notmatch '[\\/]\.claude[\\/]' -and
            $_.FullName -notmatch '[\\/]\.gemini[\\/]' -and
            $_.FullName -notmatch '[\\/]\.codex[\\/]'
        }

    foreach ($agentsFileItem in $additionalAgents) {
        $destPath = Join-Path $agentsFileItem.DirectoryName $TargetName
        Copy-Item $agentsFileItem.FullName $destPath -Force
        $count++
    }

    Write-Host "  OK Copied $count AGENTS.md -> $TargetName" -ForegroundColor Green
}

# =============================================================================
# PARSE ARGUMENTS
# =============================================================================

if ($Help) {
    Show-Help
    exit 0
}

if ($All) {
    $Script:SetupClaude = $true
    $Script:SetupGemini = $true
    $Script:SetupCodex = $true
    $Script:SetupCopilot = $true
}
else {
    if ($Claude) { $Script:SetupClaude = $true }
    if ($Gemini) { $Script:SetupGemini = $true }
    if ($Codex) { $Script:SetupCodex = $true }
    if ($Copilot) { $Script:SetupCopilot = $true }
}

# =============================================================================
# MAIN
# =============================================================================

Write-Host ""
Write-Host "AI Skills Setup" -ForegroundColor White
Write-Host "==========================" -ForegroundColor White
Write-Host ""

if (-not (Test-Administrator)) {
    Write-Host "Warning: This script may require Administrator privileges to create symbolic links." -ForegroundColor Yellow
    Write-Host "If you encounter errors, run PowerShell as Administrator." -ForegroundColor Yellow
    Write-Host ""
}

# Validar que existe el directorio de skills
if (-not (Test-Path $SkillsSource)) {
    Write-Host "No skills directory found at $SkillsSource" -ForegroundColor Red
    Write-Host "Expected .skills/ directory in the repo root." -ForegroundColor Red
    exit 1
}

$skillFiles = Get-AllSkillFiles
$skillCount = @($skillFiles).Count

if ($skillCount -eq 0) {
    Write-Host "No skills found in $SkillsSource" -ForegroundColor Red
    exit 1
}

Write-Host "Found $skillCount skills to configure" -ForegroundColor Blue
Write-Host ""

# Interactive mode if no flags provided
if (-not $Script:SetupClaude -and -not $Script:SetupGemini -and -not $Script:SetupCodex -and -not $Script:SetupCopilot) {
    Show-Menu
    Write-Host ""
    Write-Host "AI Skills Setup" -ForegroundColor White
    Write-Host "==========================" -ForegroundColor White
    Write-Host ""
}

if (-not $Script:SetupClaude -and -not $Script:SetupGemini -and -not $Script:SetupCodex -and -not $Script:SetupCopilot) {
    Write-Host "No AI assistants selected. Nothing to do." -ForegroundColor Yellow
    exit 0
}

# Generate AGENTS.md first
Write-Host "Generating AGENTS.md..." -ForegroundColor Yellow
Generate-AgentsMd
Write-Host ""

# Run selected setups
$step = 1
$total = 0
if ($Script:SetupClaude) { $total++ }
if ($Script:SetupGemini) { $total++ }
if ($Script:SetupCodex) { $total++ }
if ($Script:SetupCopilot) { $total++ }

if ($Script:SetupClaude) {
    Write-Host "[$step/$total] Setting up Claude Code..." -ForegroundColor Yellow
    Setup-Claude
    $step++
}

if ($Script:SetupGemini) {
    Write-Host "[$step/$total] Setting up Gemini CLI..." -ForegroundColor Yellow
    Setup-Gemini
    $step++
}

if ($Script:SetupCodex) {
    Write-Host "[$step/$total] Setting up Codex (OpenAI)..." -ForegroundColor Yellow
    Setup-Codex
    $step++
}

if ($Script:SetupCopilot) {
    Write-Host "[$step/$total] Setting up GitHub Copilot..." -ForegroundColor Yellow
    Setup-Copilot
}

# =============================================================================
# SUMMARY
# =============================================================================
Write-Host ""
Write-Host "Successfully configured $skillCount AI skills!" -ForegroundColor Green
Write-Host ""
Write-Host "Configured:"
if ($Script:SetupClaude) { Write-Host "  - Claude Code:    .claude/skills/ + CLAUDE.md" }
if ($Script:SetupCodex) { Write-Host "  - Codex (OpenAI): .codex/skills/ + AGENTS.md (native)" }
if ($Script:SetupGemini) { Write-Host "  - Gemini CLI:     .gemini/skills/ + GEMINI.md" }
if ($Script:SetupCopilot) { Write-Host "  - GitHub Copilot: .github/copilot-instructions.md" }
Write-Host ""
Write-Host "Note: Restart your AI assistant to load the skills." -ForegroundColor Blue
Write-Host "      AGENTS.md is the source of truth - edit it, then re-run this script." -ForegroundColor Blue
Write-Host ""
