param(
    [Parameter(Mandatory=$true)][string]$BackendEnv,
    [Parameter(Mandatory=$true)][string]$AdminFile,
    [string]$BrowserPath='C:\Program Files\Google\Chrome\Application\chrome.exe'
)
$ErrorActionPreference='Stop'
$taskValues=@{}
foreach($line in Get-Content -LiteralPath $BackendEnv){if($line -match '^([A-Z_]+)=(.*)$'){$taskValues[$Matches[1]]=$Matches[2]}}
$names=@('E2E_ADMIN_FILE','E2E_BUILD_TOKEN','E2E_BROWSER_PATH','E2E_BASE_URL');$previous=@{}
foreach($name in $names){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try{
    $env:E2E_ADMIN_FILE=(Resolve-Path -LiteralPath $AdminFile).Path
    $env:E2E_BUILD_TOKEN=$taskValues['BUILD_TOKEN']
    $env:E2E_BASE_URL=$taskValues['PUBLIC_ORIGIN']
    $env:E2E_BROWSER_PATH=$BrowserPath
    if($env:E2E_BASE_URL -notmatch '^http://127\.0\.0\.1:\d+$'){throw 'Acceptance requires an explicit local HTTP origin.'}
    Push-Location (Split-Path $PSScriptRoot -Parent)
    try{& pnpm test:browser;$taskExit=$LASTEXITCODE}finally{Pop-Location}
}finally{foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}}
exit $taskExit
