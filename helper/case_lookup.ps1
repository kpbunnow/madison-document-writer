# Fixed read-only RDL query. Runs as the current Windows user; no credentials saved.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$conn = $null
$cmd = $null
$reader = $null
$operation = 'initialize'
try {
    $operation = 'load_sql_provider'
    Add-Type -AssemblyName System.Data
    $operation = 'read_request'
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $operation = 'create_connection_string_builder'
    $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $operation = 'set_server'
    $builder['Data Source'] = [string]$request.server
    $operation = 'set_database'
    if ($request.database) { $builder['Initial Catalog'] = [string]$request.database }
    $operation = 'configure_connection_security'
    $builder['Integrated Security'] = $true
    $builder['Encrypt'] = $true
    $builder['TrustServerCertificate'] = [bool]$request.trustServerCertificate
    $builder['Connect Timeout'] = 8
    $builder['Application Name'] = 'Madison Document Writer Case Lookup'
    $builder['Pooling'] = $false
    $operation = 'create_sql_connection'
    $conn = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
    $operation = 'open_sql_connection'
    $conn.Open()
    $operation = 'create_sql_command'
    $cmd = $conn.CreateCommand()
    # The inspector queries read more tables than a one-case lookup, so the caller may ask for a longer wait.
    $cmd.CommandTimeout = 20
    if ($request.commandTimeout -is [int] -and $request.commandTimeout -ge 5 -and $request.commandTimeout -le 120) { $cmd.CommandTimeout = [int]$request.commandTimeout }
    # Only these three fixed files can run; the caller picks one by name and never supplies SQL.
    $operation = 'read_fixed_query'
    $mode = [string]$request.mode
    if ($mode -eq 'inspector_list') { $queryFile = 'inspector_list.sql' }
    elseif ($mode -eq 'inspector_cases') { $queryFile = 'inspector_cases.sql' }
    elseif ($mode -eq '') { $queryFile = 'case_lookup.sql' }
    else { throw 'LOOKUP_MODE' }
    $cmd.CommandText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot $queryFile))
    if ($mode -eq 'inspector_cases') {
        $operation = 'bind_user_id'
        $param = $cmd.Parameters.Add('@UserId', [System.Data.SqlDbType]::NVarChar, 64)
        $param.Value = [string]$request.userId
    } elseif ($mode -eq '') {
        $operation = 'bind_case_number'
        $param = $cmd.Parameters.Add('@CaseNumber', [System.Data.SqlDbType]::NVarChar, 80)
        $param.Value = [string]$request.caseNumber
    }
    $operation = 'execute_read_only_query'
    $reader = $cmd.ExecuteReader()
    $rows = New-Object 'System.Collections.Generic.List[object]'
    $chars = 0
    $rowLimit = 1000
    $charLimit = 1000000
    if ($mode -ne '') { $rowLimit = 3000; $charLimit = 4000000 }
    $operation = 'read_query_results'
    while ($reader.Read()) {
        if ($rows.Count -ge $rowLimit) { throw 'LOOKUP_LIMIT' }
        $row = [ordered]@{}
        for ($i = 0; $i -lt $reader.FieldCount; $i++) {
            $value = $null
            if (-not $reader.IsDBNull($i)) {
                $raw = $reader.GetValue($i)
                if ($raw -is [datetime]) { $value = $raw.ToString('yyyy-MM-ddTHH:mm:ss', [Globalization.CultureInfo]::InvariantCulture) }
                elseif ($raw -is [timespan]) { $value = $raw.ToString('hh\:mm\:ss') }
                else { $value = [Convert]::ToString($raw, [Globalization.CultureInfo]::InvariantCulture) }
                $chars += $value.Length
                if ($chars -gt $charLimit -or $value.Length -gt 65536) { throw 'LOOKUP_LIMIT' }
            }
            $row[$reader.GetName($i)] = $value
        }
        $rows.Add($row)
    }
    $reader.Close()
    $operation = 'serialize_results'
    $out = @{ok=$true; rows=$rows.ToArray(); database=$conn.Database} | ConvertTo-Json -Depth 6 -Compress
    [Console]::Out.Write($out)
} catch {
    $errorRecord = $_
    $exception = $_.Exception
    $number = $null
    $state = $null
    $class = $null
    $exceptionType = $null
    $hresult = $null
    $nativeCode = $null
    $argumentName = $null
    $category = 'connection'
    $messages = New-Object 'System.Collections.Generic.List[string]'
    while ($exception) {
        $messages.Add([string]$exception.Message)
        # Keep the most specific nested exception for safe diagnosis.
        $exceptionType = $exception.GetType().Name
        $hresult = $exception.HResult
        if ($exception -is [System.ArgumentException] -and $exception.ParamName) { $argumentName = [string]$exception.ParamName }
        if ($exception -is [System.ComponentModel.Win32Exception]) { $nativeCode = $exception.NativeErrorCode }
        if ($exception -is [System.Data.SqlClient.SqlException]) {
            $number = $exception.Number
            $state = $exception.State
            $class = $exception.Class
            $category = 'sql'
        }
        if ($exception.Message -eq 'LOOKUP_LIMIT') { $category = 'limit' }
        $exception = $exception.InnerException
    }
    $detail = $messages -join ' '
    if ($category -ne 'limit') {
        if ($number -eq -2) { $category = 'timeout' }
        elseif ($detail -match '(?i)certificate|SSL Provider|TLS|target principal name is incorrect|certificate chain') { $category = 'tls_certificate' }
        elseif ($detail -match '(?i)login failed|permission was denied|access is denied|not authorized') { $category = 'authentication' }
        elseif ($detail -match '(?i)cannot open database|database .* does not exist|requested database') { $category = 'database' }
        elseif ($detail -match '(?i)network-related|server was not found|instance-specific|no such host|network path|actively refused|error locating server|timed out|network name cannot be found' -or $exceptionType -eq 'SocketException') { $category = 'network' }
        elseif ($detail -match '(?i)running scripts is disabled|execution policy|not digitally signed|blocked by group policy') { $category = 'script_policy' }
        elseif ($exceptionType -match '^(FileNotFoundException|FileLoadException|TypeLoadException|DllNotFoundException|PlatformNotSupportedException|InvalidProgramException)$') { $category = 'helper_runtime' }
    }
    # Full provider details remain in this user's local profile. The file may
    # contain server/database/path details; it is never returned to the browser.
    $diagnosticFile = $null
    try {
        $diagnosticDirectory = Join-Path $env:LOCALAPPDATA 'MadisonDocWriter'
        [void][IO.Directory]::CreateDirectory($diagnosticDirectory)
        $diagnosticFile = Join-Path $diagnosticDirectory 'case-lookup-diagnostic.txt'
        $diagnosticText = @"
Madison Document Writer SQL lookup diagnostic
Captured UTC: $([DateTime]::UtcNow.ToString('o'))
Operation: $operation
Argument name: $(if ($argumentName) { $argumentName } else { '(not supplied by exception)' })
Exception type: $($errorRecord.Exception.GetType().FullName)
HRESULT: 0x$('{0:X8}' -f ($errorRecord.Exception.HResult -band 0xffffffff))

Full exception (may include server, database, account, or local path details):
$($errorRecord.Exception.ToString())

PowerShell script stack:
$($errorRecord.ScriptStackTrace)
"@
        [IO.File]::WriteAllText($diagnosticFile, $diagnosticText, (New-Object System.Text.UTF8Encoding($false)))
    } catch {
        $diagnosticFile = $null
    }
    # Return only stable diagnostic fields. Raw provider messages can include
    # machine, database, account or path details and are never sent to the UI.
    [Console]::Out.Write((@{ok=$false; category=$category; number=$number; state=$state; 'class'=$class; exceptionType=$exceptionType; hresult=$hresult; nativeCode=$nativeCode; operation=$operation; argumentName=$argumentName; diagnosticFile=$diagnosticFile} | ConvertTo-Json -Compress))
    exit 1
} finally {
    if ($reader) { $reader.Dispose() }
    if ($cmd) { $cmd.Dispose() }
    if ($conn) { $conn.Dispose() }
}
