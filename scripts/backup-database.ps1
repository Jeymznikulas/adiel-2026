[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $BackupRoot
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedRoot = [IO.Path]::GetFullPath($BackupRoot)
if ($resolvedRoot.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Database backups must be written to encrypted storage outside the repository.'
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$destination = Join-Path $resolvedRoot $stamp
New-Item -ItemType Directory -Path $destination -Force | Out-Null

Push-Location $repositoryRoot
try {
    & npx --yes supabase db dump --linked --role-only --file (Join-Path $destination 'roles.sql')
    if ($LASTEXITCODE -ne 0) { throw 'Role export failed.' }
    & npx --yes supabase db dump --linked --schema public --file (Join-Path $destination 'schema.sql')
    if ($LASTEXITCODE -ne 0) { throw 'Schema export failed.' }
    & npx --yes supabase db dump --linked --schema public --data-only --use-copy --file (Join-Path $destination 'data.sql')
    if ($LASTEXITCODE -ne 0) { throw 'Business-data export failed.' }

    Get-ChildItem -LiteralPath $destination -File | Get-FileHash -Algorithm SHA256 |
        Select-Object @{ Name = 'file'; Expression = { $_.Path.Substring($destination.Length + 1) } }, Algorithm, Hash |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
    Write-Output "Database export completed at $destination. Encrypt and retain it according to the production policy."
}
finally {
    Pop-Location
}
