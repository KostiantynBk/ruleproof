<#
.SYNOPSIS
    Loads a DPAPI-encrypted Bob API key and runs a command with BOB_API_KEY set.

.DESCRIPTION
    Decrypts the key stored at -KeyFile using Windows DPAPI (ConvertFrom-SecureString),
    injects it into $env:BOB_API_KEY for the child process only, runs the remaining
    command-line arguments, then removes the variable. The key is never echoed.

.PARAMETER KeyFile
    Path to the encrypted key XML file produced by Export-Clixml on a SecureString.
    Defaults to $env:LOCALAPPDATA\CraftAgentBobBridge\bob-key-event.xml

.EXAMPLE
    scripts\with-bob-key.ps1 node runner.mjs --rules R1,R2 --repeats 3 --max-cost 0.3

.EXAMPLE
    scripts\with-bob-key.ps1 -KeyFile C:\keys\my-key.xml node runner.mjs --rules R1 --fake
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$KeyFile = (Join-Path $env:LOCALAPPDATA 'CraftAgentBobBridge\bob-key-event.xml'),

    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$CommandAndArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Validate key file ─────────────────────────────────────────────────────────
if (-not (Test-Path -LiteralPath $KeyFile)) {
    Write-Error "Key file not found: $KeyFile"
    exit 1
}

if ($CommandAndArgs.Count -eq 0) {
    Write-Error 'No command provided. Usage: with-bob-key.ps1 [-KeyFile <path>] <command> [args...]'
    exit 1
}

# ── Decrypt the key ───────────────────────────────────────────────────────────
try {
    $secureKey = Import-Clixml -LiteralPath $KeyFile
    if ($secureKey -isnot [System.Security.SecureString]) {
        Write-Error "Key file does not contain a SecureString: $KeyFile"
        exit 1
    }
} catch {
    Write-Error "Failed to load key file: $_"
    exit 1
}

# Convert SecureString to plain text in memory only — never assign to a variable
# that could be logged or displayed
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $env:BOB_API_KEY = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

# ── Run the command ───────────────────────────────────────────────────────────
$exe  = $CommandAndArgs[0]
$rest = if ($CommandAndArgs.Count -gt 1) { $CommandAndArgs[1..($CommandAndArgs.Count - 1)] } else { @() }

try {
    & $exe @rest
    $exitCode = $LASTEXITCODE
} finally {
    # Always clear the key from the environment
    $env:BOB_API_KEY = $null
    Remove-Item Env:\BOB_API_KEY -ErrorAction SilentlyContinue
}

exit $exitCode
