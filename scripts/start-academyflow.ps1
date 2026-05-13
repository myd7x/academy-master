Param(
  [switch]$NoDocker
)

$ErrorActionPreference = "Stop"

function Write-Section($message) {
  Write-Host "`n==== $message ====\n" -ForegroundColor Cyan
}

# Move to repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

Write-Section "Starting AcademyFlow"

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed. Please install from https://nodejs.org and run again." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

# Install dependencies if needed
if (Test-Path "package-lock.json") {
  $installCmd = "ci"
} else {
  $installCmd = "install"
}

if (-not (Test-Path "node_modules")) {
  Write-Section "Installing dependencies (npm $installCmd)"
  npm $installCmd
} else {
  Write-Host "Dependencies already installed. Skipping npm install."
}

# Ensure .env exists and is populated
Write-Section ".env setup"
node .\scripts\setup-local-db.js

# Read DATABASE_URL
$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
  Write-Host ".env file not found. Please create it and set DATABASE_URL." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

$databaseUrlLine = (Get-Content $envPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
if (-not $databaseUrlLine) {
  Write-Host "DATABASE_URL not found in .env. Please set it." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

$databaseUrl = ($databaseUrlLine -split '=', 2)[1].Trim()

function Get-UriFromDbUrl($url, $defaultPort) {
  # Workaround: System.Uri understands http(s) schemes better. Replace only the scheme.
  if ($url.StartsWith('postgresql://')) { $tmp = $url.Replace('postgresql://', 'http://') }
  elseif ($url.StartsWith('postgres://')) { $tmp = $url.Replace('postgres://', 'http://') }
  elseif ($url.StartsWith('mysql://')) { $tmp = $url.Replace('mysql://', 'http://') }
  else { $tmp = $url }
  $uri = [Uri]$tmp
  $username = [System.Uri]::UnescapeDataString(($uri.UserInfo -split ':',2)[0])
  $password = ''
  if ($uri.UserInfo -like '*:*') { $password = [System.Uri]::UnescapeDataString(($uri.UserInfo -split ':',2)[1]) }
  $databaseHost = $uri.Host
  $databasePort = if ($uri.Port -gt 0) { $uri.Port } else { $defaultPort }
  $dbName = $uri.AbsolutePath.TrimStart('/')
  return [pscustomobject]@{ Username = $username; Password = $password; Host = $databaseHost; Port = $databasePort; Database = $dbName }
}

function Test-PortOpen($targetHost, $targetPort, $retries = 60, $delaySeconds = 2) {
  for ($i = 0; $i -lt $retries; $i++) {
    try {
      $result = Test-NetConnection -ComputerName $targetHost -Port $targetPort -WarningAction SilentlyContinue
      if ($result.TcpTestSucceeded) { return $true }
    } catch {}
    Start-Sleep -Seconds $delaySeconds
  }
  return $false
}

function Ensure-Directory($path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}

function Test-DockerReady() {
  $dockerCli = $false
  try { docker --version *> $null; if ($LASTEXITCODE -eq 0) { $dockerCli = $true } } catch {}
  if (-not $dockerCli) { return $false }
  try {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { return $false }
  } catch { return $false }
  return $true
}

function Start-PostgresContainer($url) {
  $cfg = Get-UriFromDbUrl $url 5432
  if ($cfg.Host -ne 'localhost' -and $cfg.Host -ne '127.0.0.1') {
    Write-Host "Postgres host is '$($cfg.Host)'. Skipping local Docker DB startup." -ForegroundColor Yellow
    return
  }

  $containerName = 'academyflow-pg'
  $volumePath = Join-Path $repoRoot ".data\\postgres"
  Ensure-Directory $volumePath

  if (-not (Test-DockerReady)) { Write-Host "Docker Desktop is not running. Skipping DB container startup." -ForegroundColor Yellow; return }

  $existing = (docker ps -a --filter "name=$containerName" --format "{{.Names}}" 2>$null)
  if ($existing) {
    Write-Host "Found existing Postgres container '$containerName'. Ensuring it's running..."
    docker start $containerName | Out-Null
  } else {
    Write-Section "Starting Postgres in Docker ($containerName)"
    docker run -d --name $containerName `
      -e "POSTGRES_USER=$($cfg.Username)" `
      -e "POSTGRES_PASSWORD=$($cfg.Password)" `
      -e "POSTGRES_DB=$($cfg.Database)" `
      -p "$($cfg.Port):5432" `
      -v "${volumePath}:/var/lib/postgresql/data" `
      postgres:15 | Out-Null
  }

  Write-Host "Waiting for Postgres to be ready on $($cfg.Host):$($cfg.Port)..."
  if (-not (Test-PortOpen $cfg.Host $cfg.Port)) {
    Write-Host "Postgres did not become ready in time." -ForegroundColor Yellow
  }
}

function Start-MySqlContainer($url) {
  $cfg = Get-UriFromDbUrl $url 3306
  if ($cfg.Host -ne 'localhost' -and $cfg.Host -ne '127.0.0.1') {
    Write-Host "MySQL host is '$($cfg.Host)'. Skipping local Docker DB startup." -ForegroundColor Yellow
    return
  }

  $containerName = 'academyflow-mysql'
  $volumePath = Join-Path $repoRoot ".data\\mysql"
  Ensure-Directory $volumePath

  if (-not (Test-DockerReady)) { Write-Host "Docker Desktop is not running. Skipping DB container startup." -ForegroundColor Yellow; return }

  $existing = (docker ps -a --filter "name=$containerName" --format "{{.Names}}" 2>$null)
  if ($existing) {
    Write-Host "Found existing MySQL container '$containerName'. Ensuring it's running..."
    docker start $containerName | Out-Null
  } else {
    Write-Section "Starting MySQL in Docker ($containerName)"
    $envArgs = @()
    if ($cfg.Username -eq 'root') {
      $envArgs += "-e", "MYSQL_ROOT_PASSWORD=$($cfg.Password)"
    } else {
      $envArgs += "-e", "MYSQL_ROOT_PASSWORD=$([Guid]::NewGuid().ToString('n').Substring(0,16))"
      $envArgs += "-e", "MYSQL_USER=$($cfg.Username)"
      $envArgs += "-e", "MYSQL_PASSWORD=$($cfg.Password)"
    }
    $envArgs += "-e", "MYSQL_DATABASE=$($cfg.Database)"

    docker run -d --name $containerName `
      @envArgs `
      -p "$($cfg.Port):3306" `
      -v "${volumePath}:/var/lib/mysql" `
      mysql:8 | Out-Null
  }

  Write-Host "Waiting for MySQL to be ready on $($cfg.Host):$($cfg.Port)..."
  if (-not (Test-PortOpen $cfg.Host $cfg.Port)) {
    Write-Host "MySQL did not become ready in time." -ForegroundColor Yellow
  }
}

# Optionally start local DB via Docker
if ($NoDocker) {
  Write-Host "Skipping DB container startup due to -NoDocker flag."
} else {
  if (Test-DockerReady) {
    if ($databaseUrl -match '^postgres(ql)?:\/\/') { Start-PostgresContainer $databaseUrl }
    elseif ($databaseUrl -match '^mysql:\/\/') { Start-MySqlContainer $databaseUrl }
    else { Write-Host "Unsupported DATABASE_URL scheme. Skipping DB container startup." -ForegroundColor Yellow }
  } else {
    Write-Host "Docker Desktop is not available or not running. If you need a local DB, start Docker Desktop or run your own database server, or re-run with -NoDocker." -ForegroundColor Yellow
  }
}

# Run DB migrations (Drizzle push) only for Postgres setups
if ($databaseUrl -match '^postgres(ql)?:\/\/') {
  Write-Section "Applying database schema (npm run db:push)"
  npm run db:push
} else {
  Write-Host "Skipping migrations because DATABASE_URL is not PostgreSQL. Drizzle config is set to PostgreSQL dialect." -ForegroundColor Yellow
}

# Start dev server
Write-Section "Starting development server (npm run dev)"
Write-Host "The server will run on http://localhost:5000"
npm run dev


