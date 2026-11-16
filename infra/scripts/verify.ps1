#requires -Version 5.1
<#
.SYNOPSIS
    Kiem tra mot luot: DNS, redirect 80->443, /health, TLS, security headers, SSH.
.DESCRIPTION
    Dung tren Windows (khong can dig/openssl). Mac dinh kiem tra host that.
    Exit code 0 = tat ca PASS, 1 = co FAIL.
.EXAMPLE
    powershell -File infra\scripts\verify.ps1 -TargetHost staging.example.com
.EXAMPLE
    powershell -File infra\scripts\verify.ps1 -TargetHost staging.example.com -ExpectedIP 203.0.113.10
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TargetHost,
    [string]$ExpectedIP,
    [int]$TimeoutSec = 15
)

$ErrorActionPreference = 'Continue'
$script:checks = @()

function Add-Check {
    param([string]$Name, [bool]$Ok, [string]$Detail)
    $script:checks += [pscustomobject]@{
        Check   = $Name
        KetQua  = $(if ($Ok) { 'PASS' } else { 'FAIL' })
        ChiTiet = $Detail
    }
}

function Get-Head {
    param([string]$Url)
    $lines = @(& curl.exe -sS -I --max-time $TimeoutSec $Url 2>&1)
    $exit = $LASTEXITCODE
    $status = $null
    $headers = @{}
    foreach ($line in $lines) {
        if ($line -match '^HTTP/\S+\s+(\d{3})') { $status = [int]$Matches[1]; $headers = @{}; continue }
        if ($status -and $line -match '^([^:]+):\s*(.*)$') {
            $k = $Matches[1].Trim().ToLower()
            $v = $Matches[2].Trim()
            if ($headers.ContainsKey($k)) { $headers[$k] = "$($headers[$k]), $v" } else { $headers[$k] = $v }
        }
    }
    [pscustomobject]@{ Status = $status; Headers = $headers; ExitCode = $exit; Raw = ($lines -join ' / ') }
}

function Get-CertInfo {
    param([string]$Name)
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($Name, 443)
    $cb = [System.Net.Security.RemoteCertificateValidationCallback] { param($s, $c, $ch, $e) $true }
    $ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, $cb)
    $ssl.AuthenticateAsClient($Name)
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
    $dns = $cert.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::DnsName, $false)
    $info = [pscustomobject]@{
        DnsName  = $dns
        Issuer   = $cert.Issuer
        NotAfter = $cert.NotAfter
        Days     = [int][math]::Floor(($cert.NotAfter - (Get-Date)).TotalDays)
        Protocol = $ssl.SslProtocol
    }
    $ssl.Dispose()
    $tcp.Close()
    $info
}

Write-Host ""
Write-Host "== Kiem tra edge cho $TargetHost ==" -ForegroundColor Cyan
Write-Host ""

# --- 0. Cong cu local -------------------------------------------------------
foreach ($t in @('ssh', 'curl.exe', 'git')) {
    $p = Get-Command $t -ErrorAction SilentlyContinue
    Add-Check "Tool $t" ([bool]$p) $(if ($p) { $p.Source } else { 'khong thay trong PATH' })
}

# --- 1. DNS -----------------------------------------------------------------
try {
    $dns = @(Resolve-DnsName -Name $TargetHost -Type A -DnsOnly -ErrorAction Stop |
            Where-Object { $_.IPAddress } |
            Select-Object -ExpandProperty IPAddress |
            Sort-Object -Unique)
    $ips = $dns -join ', '
    if ($ExpectedIP) {
        Add-Check 'DNS A record' ($ips -match [regex]::Escape($ExpectedIP)) "ra: $ips | mong doi: $ExpectedIP"
    }
    else {
        Add-Check 'DNS A record' ([bool]$ips) "ra: $ips"
    }
}
catch {
    Add-Check 'DNS A record' $false $_.Exception.Message
}

# --- 2. HTTP -> HTTPS -------------------------------------------------------
$h80 = Get-Head "http://$TargetHost/health"
Add-Check 'HTTP :80 tra 301' ($h80.Status -eq 301) "status=$($h80.Status) exit=$($h80.ExitCode)"
$loc = $h80.Headers['location']
Add-Check 'Location sang https' ([bool]($loc -like 'https://*')) "$loc"

# --- 3. HTTPS /health -------------------------------------------------------
$h443 = Get-Head "https://$TargetHost/health"
Add-Check 'HTTPS /health 200' ($h443.Status -eq 200) "status=$($h443.Status) exit=$($h443.ExitCode)"

$body = (& curl.exe -sS --max-time $TimeoutSec "https://$TargetHost/health" 2>$null) -join ''
Add-Check 'Body co status ok' ($body -match '"status"\s*:\s*"ok"') $body.Trim()

# --- 4. Security headers ----------------------------------------------------
$need = @('strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy')
$missing = @($need | Where-Object { -not $h443.Headers.ContainsKey($_) })
Add-Check 'Headers tren 200' ($missing.Count -eq 0) ("thieu: " + ($missing -join ', '))

$h404 = Get-Head "https://$TargetHost/"
Add-Check 'Root tra 404' ($h404.Status -eq 404) "status=$($h404.Status)"
$missing404 = @($need | Where-Object { -not $h404.Headers.ContainsKey($_) })
Add-Check 'Headers tren 404' ($missing404.Count -eq 0) ("thieu: " + ($missing404 -join ', '))

# --- 5. TLS -----------------------------------------------------------------
try {
    $cert = Get-CertInfo -Name $TargetHost
    Add-Check 'TLS handshake' ($null -ne $cert.Protocol) "protocol=$($cert.Protocol)"

    # Chap nhan cert chinh xac hoac wildcard 1 cap (*.domain.com)
    $certHost = $cert.DnsName
    $hostOk = $false
    if ($certHost -and $certHost.Equals($TargetHost, 'OrdinalIgnoreCase')) { $hostOk = $true }
    if (-not $hostOk -and $certHost -like '*.*') {
        if ($certHost.StartsWith('*.') -and $TargetHost -match ('^[^.]+\.' + [regex]::Escape($certHost.Substring(2)) + '$')) { $hostOk = $true }
    }
    Add-Check 'Cert dung host' $hostOk "cert: $certHost"
    Add-Check 'Cert con han > 14 ngay' ($cert.Days -gt 14) "$($cert.Days) ngay (het han $($cert.NotAfter.ToString('yyyy-MM-dd')))"
    Write-Host ("Issuer: " + $cert.Issuer) -ForegroundColor DarkGray
}
catch {
    Add-Check 'TLS handshake' $false $_.Exception.Message
}

# --- 6. SSH -----------------------------------------------------------------
$sshOk = Test-NetConnection -ComputerName $TargetHost -Port 22 -InformationLevel Quiet -WarningAction SilentlyContinue
Add-Check 'SSH :22 mo' ([bool]$sshOk) 'Test-NetConnection'

# --- Ket qua ----------------------------------------------------------------
Write-Host ""
$script:checks | Format-Table -AutoSize -Wrap

$fail = @($script:checks | Where-Object { $_.KetQua -eq 'FAIL' })
$pass = @($script:checks | Where-Object { $_.KetQua -eq 'PASS' })

if ($fail.Count -eq 0) {
    Write-Host "PASS $($pass.Count)/$($script:checks.Count) - edge dat acceptance." -ForegroundColor Green
    exit 0
}
else {
    Write-Host "FAIL $($fail.Count)/$($script:checks.Count) - xem bang tren, sua tu lop NGOAI cung vao." -ForegroundColor Red
    exit 1
}