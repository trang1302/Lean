param(
    [string]$Message = "Claude Code",
    [string]$Title = "Claude Code",
    [string]$Topic = $env:NTFY_TOPIC,
    [string]$Tags = "white_check_mark"
)

# Push a notification to the user's phone via ntfy.sh (no account needed).
# Used by Claude Code Stop / Notification hooks. See .claude/settings.local.json.
# Subscribe to the same topic in the ntfy mobile app to receive these.

if ([string]::IsNullOrWhiteSpace($Topic)) { exit 0 }

try {
    Invoke-RestMethod -Uri "https://ntfy.sh/$Topic" -Method Post `
        -Body $Message `
        -Headers @{ Title = $Title; Priority = "default"; Tags = $Tags } | Out-Null
    "SENT OK"
} catch {
    "FAILED: " + $_.Exception.Message
}
