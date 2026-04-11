<#
.SYNOPSIS
    Session Auto-Loader — SessionStart hook that detects and announces available handoffs.

.DESCRIPTION
    Runs on Claude Code "SessionStart" event. Scans the project's memory directory
    for recent handoff files and outputs a short notice so the new session knows
    prior context is available without loading the full content into context.

.NOTES
    Hook type: SessionStart (command)
    Timeout: 3s
    Non-blocking, fail-open, adds <100 tokens to context
#>

$ErrorActionPreference = 'SilentlyContinue'

try {
    # Read hook input from stdin
    if (-not [Console]::IsInputRedirected) { exit 0 }

    $raw = [Console]::In.ReadToEnd()
    if (-not $raw) { exit 0 }

    $hookInput = $raw | ConvertFrom-Json
    if (-not $hookInput) { exit 0 }

    $cwd = $hookInput.cwd
    if (-not $cwd) { exit 0 }

    # Find project memory directory (try multiple slug patterns)
    $slugs = @(
        ($cwd -replace '[:\\\/]', '-' -replace '^-+', '' -replace '-+$', ''),
        ($cwd -replace '\\', '-' -replace ':', '' -replace '^-+', ''),
        ($cwd.ToLower() -replace '[:\\\/]', '-' -replace '^-+', '' -replace '-+$', '')
    )

    $memoryDir = $null
    foreach ($slug in $slugs) {
        $candidate = Join-Path $env:USERPROFILE ".claude\projects\$slug\memory"
        if (Test-Path $candidate) {
            $memoryDir = $candidate
            break
        }
    }

    if (-not $memoryDir) { exit 0 }

    # Find handoff files (auto + manual) modified in last 24 hours
    $cutoff = (Get-Date).AddHours(-24)
    $handoffs = Get-ChildItem -Path $memoryDir -Filter "session_handoff*" -File |
        Where-Object { $_.LastWriteTime -gt $cutoff } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 3

    if (-not $handoffs -or $handoffs.Count -eq 0) { exit 0 }

    # Build concise notice (minimal tokens)
    $newest = $handoffs[0]
    $age = [math]::Round(((Get-Date) - $newest.LastWriteTime).TotalHours, 1)
    $sizeKB = [math]::Round($newest.Length / 1024, 1)

    $notice = "[Session Auto-Loader] Handoff available from ${age}h ago: $($newest.FullName) (${sizeKB}KB). Read it if you need prior session context."

    # Output as plain text (SessionStart hooks output to stderr/stdout)
    Write-Output $notice

} catch {
    # Fail-open
    exit 0
}
