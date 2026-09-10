param(
    [ValidateSet('start','stop','check')][string]$Action='check',
    [Parameter(Mandatory=$true)][string]$Nginx,
    [int]$Port=8081,
    [int]$ApiPort=8080
)
$ErrorActionPreference='Stop'
if($Port -lt 1024 -or $Port -gt 65535 -or $ApiPort -lt 1024 -or $ApiPort -gt 65535){throw 'Use unprivileged local ports.'}
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskRun=Join-Path $taskRoot '.local/nginx'
$taskBinary=(Resolve-Path -LiteralPath $Nginx).Path
$taskPrefix=$taskRun.Replace('\','/')+'/'
$taskConfig=Join-Path $taskRun 'nginx.conf'
$taskPID=Join-Path $taskRun 'logs/nginx.pid'
if($Action -eq 'stop'){
    if(-not(Test-Path $taskConfig)){throw 'No local instance configuration.'}
    & $taskBinary -p $taskPrefix -c nginx.conf -s quit
    if($LASTEXITCODE -ne 0){throw 'Local Nginx stop failed.'}
    exit 0
}
New-Item -ItemType Directory -Force (Join-Path $taskRun 'logs') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $taskRun 'temp') | Out-Null
if($Action -eq 'start' -and (Test-Path $taskPID) -and (Get-Item $taskPID).Length -gt 0){throw 'Instance PID file exists; inspect or stop the existing local instance first.'}
$taskPublic=(Join-Path $taskRoot '.output/public').Replace('\','/')
if(-not(Test-Path (Join-Path $taskPublic 'admin/index.html'))){throw 'Generate static output before starting Nginx.'}
$template=Get-Content (Join-Path $PSScriptRoot 'nginx.conf.template') -Raw
$template.Replace('__PUBLIC__',$taskPublic).Replace('__PORT__',"$Port").Replace('__API_PORT__',"$ApiPort") | Set-Content -LiteralPath $taskConfig -Encoding ascii
& $taskBinary -p $taskPrefix -c nginx.conf -t
if($LASTEXITCODE -ne 0){throw 'Local Nginx configuration validation failed.'}
if($Action -eq 'start'){
    # nginx -t on Windows can create an empty PID file even without a running master.
    if((Test-Path $taskPID) -and (Get-Item $taskPID).Length -eq 0){Remove-Item -LiteralPath $taskPID}
    Start-Process -FilePath $taskBinary -ArgumentList @('-p',('"'+$taskPrefix+'"'),'-c','nginx.conf') -WorkingDirectory $taskRun -WindowStyle Hidden
    Write-Output "Local site: http://127.0.0.1:$Port"
}
