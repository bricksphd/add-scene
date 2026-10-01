# Launches an Extension Development Host whose extension host inspector is
# exposed on 127.0.0.1:$Port, and waits until the inspector answers.
#
# Workaround for https://github.com/microsoft/vscode/issues/338110: on
# VS Code 1.139.x the built-in debugger cannot attach to the paused extension
# host that a normal F5 launch creates, so the extension host never starts.
# Launching the host with --inspect-extensions (no pause) and attaching to
# 127.0.0.1 explicitly still works.
#
# Used by the "Attach to Extension Host (VS Code 1.139 workaround)" launch
# configuration as its preLaunchTask.

param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionPath,
    [int]$Port = 9230
)

$extensionPath = (Resolve-Path $ExtensionPath).Path

Write-Host "Launching Extension Development Host for: $extensionPath"
Write-Host "Extension host inspector will listen on 127.0.0.1:$Port"

$code = Get-Command code.cmd -ErrorAction SilentlyContinue
if (-not $code) {
    $code = Get-Command code -ErrorAction Stop
}

Start-Process -FilePath $code.Source -ArgumentList @(
    '--new-window',
    "--inspect-extensions=$Port",
    "--extensionDevelopmentPath=`"$extensionPath`""
)

$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 | Out-Null
        Write-Host "Extension host inspector is reachable at http://127.0.0.1:$Port"
        exit 0
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

Write-Error "Timed out waiting for the extension host inspector on 127.0.0.1:$Port. Close any previous development host window that may still hold this port."
exit 1
