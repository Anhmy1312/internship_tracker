#requires -Version 5.1
<#
.SYNOPSIS
    Kiem tra may Windows da san sang lam trial infra chua (truoc 16/11).
.DESCRIPTION
    Khong can VPS. Chi kiem tra cong cu local, SSH key va entry ssh config.
.EXAMPLE
    powershell -File infra\scripts\preflight.ps1
.EXAMPLE
    powershell -File infra\scripts\preflight.ps1 -KeyPath "$env:USERPROFILE\.ssh\id_ed25519_it"
#>
[CmdletBinding()]
param(
    [string]$KeyPath = "$env:USERPROFILE\.ssh\id_ed25519_it",
    [string]$SshAlias = 'it-staging'
)

$rows = @()
function Add-Row {
    param([string]$Muc, [bool]$Ok, [string]$GhiChu, [string]$GoiY = '')
    $script:rows += [pscustomobject]@{
        Muc    = $Muc
        TrangThai = $(if ($Ok) { 'OK' } else { 'THIEU' })
        GhiChu = $GhiChu
        GoiY   = $GoiY
    }
}

foreach ($t in @(
        @{ n = 'ssh';     hint = 'co san tren Windows 10/11' },
        @{ n = 'curl.exe'; hint = 'co san tren Windows 10/11' },
        @{ n = 'git';     hint = 'winget install --id Git.Git -e' },
        @{ n = 'code';    hint = 'winget install --id Microsoft.VisualStudioCode -e' },
        @{ n = 'gh';      hint = 'winget install --id GitHub.cli -e' }
    )) {
    $p = Get-Command $t.n -ErrorAction SilentlyContinue
    Add-Row "Tool $($t.n)" ([bool]$p) $(if ($p) { 'tim thay' } else { 'khong thay trong PATH' }) $t.hint
}

Add-Row 'SSH private key' (Test-Path $KeyPath) $KeyPath 'ssh-keygen -t ed25519 -a 100 -f <path>'
Add-Row 'SSH public key' (Test-Path "$KeyPath.pub") "$KeyPath.pub" 'thieu .pub = key tao loi, tao lai'

$cfg = "$env:USERPROFILE\.ssh\config"
$hasAlias = (Test-Path $cfg) -and (Select-String -Path $cfg -Pattern "^\s*Host\s+$([regex]::Escape($SshAlias))\s*$" -Quiet)
Add-Row "ssh config co Host $SshAlias" ([bool]$hasAlias) $cfg 'them block Host/ HostName/ User/ IdentityFile'

Add-Row 'Windows Terminal' ([bool](Get-Command wt.exe -ErrorAction SilentlyContinue)) 'mo nhieu tab SSH' 'co san tren Windows 11'
Add-Row 'PowerShell 7 (tuy chon)' ([bool](Get-Command pwsh -ErrorAction SilentlyContinue)) 'khong bat buoc' 'winget install --id Microsoft.PowerShell -e'

Write-Host ""
Write-Host "== Preflight may local (truoc 16/11) ==" -ForegroundColor Cyan
$rows | Format-Table -AutoSize -Wrap

$missing = @($rows | Where-Object {
        $_.TrangThai -eq 'THIEU' -and $_.GoiY -ne '' -and
        $_.Muc -notlike 'PowerShell*' -and $_.Muc -ne 'SSH public key'
    })
if ($missing.Count -eq 0) {
    Write-Host "OK - may san sang. Con lai chi la tai khoan/VPS." -ForegroundColor Green
    exit 0
}

Write-Host "Con thieu $($missing.Count) muc co the cai them:" -ForegroundColor Yellow
$missing | ForEach-Object { Write-Host "  - $($_.Muc): $($_.GoiY)" }
exit 1