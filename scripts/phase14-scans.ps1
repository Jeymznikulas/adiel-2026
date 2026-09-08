[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repositoryRoot
try {
    $repositoryFiles = @(git ls-files --cached --others --exclude-standard)
    $secretFiles = @($repositoryFiles | Select-String -Pattern '(^|/)(\.env($|\.)|appsettings\.(Development|Production)\.json$|.*\.(pfx|p12|pem|key)$)' | ForEach-Object { $_.Line } | Where-Object { $_ -notmatch '\.example($|\.)' })
    if ($secretFiles.Count -gt 0) {
        Write-Error ('Secret-bearing file types would be committed: ' + ($secretFiles -join ', '))
    }

    $secretPattern = 'sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
    $trackedCandidates = @(git grep -Il -E $secretPattern -- . ':!src/web/package-lock.json' 2>$null)
    $untrackedFiles = @(git ls-files --others --exclude-standard)
    $untrackedCandidates = if ($untrackedFiles.Count -gt 0) { @(& rg -l $secretPattern -- @untrackedFiles 2>$null) } else { @() }
    $secretCandidates = @($trackedCandidates + $untrackedCandidates | Sort-Object -Unique)
    if ($secretCandidates.Count -gt 0) {
        Write-Error ('Possible committed secret values found in: ' + ($secretCandidates -join ', '))
    }

    $businessStorageMatches = @(rg -l 'localStorage' src/web/src --glob '*.ts' --glob '*.tsx')
    $allowedPreferenceFiles = @(
        'src/web/src/components/layout/AppShell.tsx',
        'src/web/src/components/ui/usePersistentState.ts'
    )
    $unexpectedStorage = @($businessStorageMatches | ForEach-Object { $_ -replace '\\', '/' } | Where-Object { $_ -notin $allowedPreferenceFiles })
    if ($unexpectedStorage.Count -gt 0) {
        Write-Error ('Unexpected localStorage use found in: ' + ($unexpectedStorage -join ', '))
    }

    Write-Output 'Secret scan: passed (tracked and untracked repository files; values were not printed).'
    Write-Output 'Business localStorage scan: passed (only UI preference files use localStorage).'
}
finally {
    Pop-Location
}
