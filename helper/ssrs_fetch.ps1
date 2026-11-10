# Fixed read-only report render. Runs as the current Windows user (integrated sign-in); no credentials are saved.
# The helper sends one JSON request on standard input: the complete report URL it built from the verified release
# allowlist, a timeout and a size limit. Nothing from the request is ever run as code.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$operation = 'initialize'
try {
    $operation = 'read_request'
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $url = [string]$request.url
    $timeout = 0
    if (-not [int]::TryParse([string]$request.timeoutSeconds, [ref]$timeout) -or $timeout -lt 5 -or $timeout -gt 300) { $timeout = 60 }
    $limit = 0
    if (-not [int]::TryParse([string]$request.maxBytes, [ref]$limit) -or $limit -lt 1024) { $limit = 20971520 }
    if (-not $url.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) { throw 'SSRS_URL' }
    # Windows PowerShell 5.1 may default to TLS 1.0/1.1, which the report server refuses.
    $operation = 'configure_tls'
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.ServicePointManager]::SecurityProtocol } catch {}
    $operation = 'render_report'
    $response = Invoke-WebRequest -Uri $url -UseDefaultCredentials -UseBasicParsing -MaximumRedirection 0 -TimeoutSec $timeout -ErrorAction Stop
    $operation = 'read_report'
    $bytes = $response.RawContentStream.ToArray()
    if ($bytes.Length -gt $limit) { throw 'SSRS_LIMIT' }
    $contentType = [string]$response.Headers['Content-Type']
    $out = @{ok=$true; status=[int]$response.StatusCode; contentType=$contentType; body=[Convert]::ToBase64String($bytes)} | ConvertTo-Json -Compress
    [Console]::Out.Write($out)
} catch {
    $errorRecord = $_
    $exception = $_.Exception
    $category = 'other'
    $httpStatus = $null
    $ssrsCode = $null
    $webStatus = $null
    while ($exception) {
        if ($exception.Message -eq 'SSRS_LIMIT') { $category = 'limit' }
        if ($exception.Message -eq 'SSRS_URL') { $category = 'request' }
        if ($exception -is [System.Net.WebException]) {
            $webStatus = [string]$exception.Status
            if ($exception.Response -ne $null) {
                try { $httpStatus = [int]$exception.Response.StatusCode } catch {}
                # SSRS names its error in the page, for example (rsAccessDenied). Only that code is kept.
                try {
                    $reader = New-Object System.IO.StreamReader($exception.Response.GetResponseStream())
                    $buffer = New-Object char[] 65536
                    $count = $reader.Read($buffer, 0, $buffer.Length)
                    $page = New-Object string($buffer, 0, $count)
                    $reader.Dispose()
                    if ($page -match '\((rs[A-Za-z]{2,60})\)') { $ssrsCode = $Matches[1] }
                } catch {}
            }
        }
        $exception = $exception.InnerException
    }
    if ($category -eq 'other') {
        if ($httpStatus -ne $null) { $category = 'http' }
        elseif ($webStatus -eq 'Timeout') { $category = 'timeout' }
        elseif ($webStatus -match '^(TrustFailure|SecureChannelFailure)$') { $category = 'tls' }
        elseif ($webStatus -match '^(NameResolutionFailure|ConnectFailure|ProxyNameResolutionFailure|ConnectionClosed|ReceiveFailure|SendFailure|KeepAliveFailure)$') { $category = 'network' }
        elseif ($errorRecord.Exception.Message -match '(?i)redirect') { $category = 'redirect' }
        elseif ($errorRecord.Exception.Message -match '(?i)running scripts is disabled|execution policy|not digitally signed|blocked by group policy') { $category = 'script_policy' }
    }
    # Full details stay in this user's profile; they may name the server or account and never reach the page.
    $diagnosticFile = $null
    try {
        $diagnosticDirectory = Join-Path $env:LOCALAPPDATA 'MadisonDocWriter'
        [void][IO.Directory]::CreateDirectory($diagnosticDirectory)
        $diagnosticFile = Join-Path $diagnosticDirectory 'case-lookup-diagnostic.txt'
        $diagnosticText = @"
Madison Document Writer report lookup diagnostic
Captured UTC: $([DateTime]::UtcNow.ToString('o'))
Operation: $operation
Category: $category
HTTP status: $httpStatus
Report server code: $ssrsCode
Web status: $webStatus

Full exception (may include server, account, or local path details):
$($errorRecord.Exception.ToString())

PowerShell script stack:
$($errorRecord.ScriptStackTrace)
"@
        [IO.File]::WriteAllText($diagnosticFile, $diagnosticText, (New-Object System.Text.UTF8Encoding($false)))
    } catch {
        $diagnosticFile = $null
    }
    [Console]::Out.Write((@{ok=$false; category=$category; httpStatus=$httpStatus; ssrsCode=$ssrsCode; operation=$operation; diagnosticFile=$diagnosticFile} | ConvertTo-Json -Compress))
    exit 1
}
