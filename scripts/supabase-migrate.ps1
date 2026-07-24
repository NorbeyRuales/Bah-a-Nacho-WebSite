[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("status", "plan", "push", "new")]
  [string]$Action = "status",

  [Parameter(Position = 1)]
  [string]$MigrationName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI no está instalado o no está disponible en PATH."
}

if ($Action -eq "new") {
  $normalizedName = $MigrationName.Trim().ToLowerInvariant()
  if ($normalizedName -notmatch "^[a-z0-9][a-z0-9_-]{2,80}$") {
    throw "Indica un nombre de 3 a 81 caracteres usando letras minúsculas, números, guiones o guion bajo."
  }

  Push-Location $projectRoot
  try {
    & supabase migration new $normalizedName
    if ($LASTEXITCODE -ne 0) {
      throw "Supabase CLI no pudo crear la migración."
    }
  }
  finally {
    Pop-Location
  }
  exit 0
}

Push-Location $projectRoot
try {
  switch ($Action) {
    "status" {
      & supabase migration list --linked --output pretty
    }
    "plan" {
      & supabase db push --linked --dry-run --output pretty
    }
    "push" {
      & supabase db push --linked --yes --output pretty
    }
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI terminó con el código $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
