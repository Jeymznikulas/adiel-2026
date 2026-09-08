[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $BackupRoot,
    [string] $Bucket = 'business-images'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedRoot = [IO.Path]::GetFullPath($BackupRoot)
if ($resolvedRoot.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Storage backups must be written to encrypted storage outside the repository.'
}
$projectUrl = $env:ADIEL_SUPABASE_URL
$serviceKey = $env:ADIEL_STORAGE_SERVICE_KEY
if ([string]::IsNullOrWhiteSpace($projectUrl) -or [string]::IsNullOrWhiteSpace($serviceKey)) {
    throw 'ADIEL_SUPABASE_URL and ADIEL_STORAGE_SERVICE_KEY must come from the external backup-job secret store.'
}

$headers = @{ Authorization = "Bearer $serviceKey"; apikey = $serviceKey }
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$destination = Join-Path $resolvedRoot $stamp
$objectRoot = Join-Path $destination 'objects'
New-Item -ItemType Directory -Path $objectRoot -Force | Out-Null
$manifest = [Collections.Generic.List[object]]::new()

function Backup-Prefix([string] $Prefix) {
    $offset = 0
    do {
        $body = @{ prefix = $Prefix; limit = 100; offset = $offset; sortBy = @{ column = 'name'; order = 'asc' } } | ConvertTo-Json -Compress
        $entries = @(Invoke-RestMethod -Method Post -Uri "$projectUrl/storage/v1/object/list/$Bucket" -Headers $headers -ContentType 'application/json' -Body $body)
        foreach ($entry in $entries) {
            $path = if ($Prefix) { "$Prefix/$($entry.name)" } else { [string]$entry.name }
            if ($null -eq $entry.metadata) {
                Backup-Prefix $path
                continue
            }
            $relativePath = $path -replace '/', [IO.Path]::DirectorySeparatorChar
            $target = Join-Path $objectRoot $relativePath
            New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
            $escaped = (($path -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
            Invoke-WebRequest -Uri "$projectUrl/storage/v1/object/$Bucket/$escaped" -Headers $headers -OutFile $target
            $file = Get-Item -LiteralPath $target
            $manifest.Add([PSCustomObject]@{ path = $path; bytes = $file.Length; contentType = $entry.metadata.mimetype; sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash; backedUpAtUtc = (Get-Date).ToUniversalTime().ToString('O') })
        }
        $offset += $entries.Count
    } while ($entries.Count -eq 100)
}

try {
    Backup-Prefix ''
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'storage-manifest.json') -Encoding utf8
    Write-Output "Storage-object backup completed at $destination with $($manifest.Count) objects. Encrypt and retain it according to the production policy."
}
finally {
    $serviceKey = $null
    $headers = $null
}
