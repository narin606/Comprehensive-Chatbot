<#
.SYNOPSIS
  Launch the FastAPI backend (with --reload) and the Next.js frontend dev server together.

.DESCRIPTION
  This script is a convenience wrapper for local development. It starts:
    - Uvicorn with auto-reload on http://127.0.0.1:8000 (using the project venv)
    - Next.js dev server with hot reload on http://localhost:3000

  Press ENTER to stop both processes. Use the flags below if you want to run only one side.

.PARAMETER BackendOnly
  Start only the backend (skip the Next.js dev server).

.PARAMETER FrontendOnly
  Start only the frontend (skip the backend).
#>

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

if ($BackendOnly -and $FrontendOnly) {
    Write-Error "Choose either -BackendOnly or -FrontendOnly, not both."
    exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $root
$backendRoot = $projectRoot
$frontendRoot = Join-Path $projectRoot "frontend-next"

$backendProc = $null
$frontendProc = $null

try {
    if (-not $FrontendOnly) {
        $pythonPath = Join-Path $projectRoot ".venv\Scripts\python.exe"
        if (-not (Test-Path $pythonPath)) {
            throw "Virtual environment not found at $pythonPath. Run 'python -m venv .venv' and install dependencies first."
        }

        $backendArgs = @(
            "-m", "uvicorn",
            "app.main:app",
            "--reload",
            "--host", "127.0.0.1",
            "--port", "8000"
        )

        $backendProc = Start-Process -FilePath $pythonPath `
            -ArgumentList $backendArgs `
            -WorkingDirectory $projectRoot `
            -PassThru `
            -WindowStyle Hidden

        Write-Host "Backend running -> http://127.0.0.1:8000  (PID $($backendProc.Id))"
    }

    if (-not $BackendOnly) {
        if (-not (Test-Path (Join-Path $frontendRoot "package.json"))) {
            throw "Next.js project not found at $frontendRoot. Did you remove or move frontend-next?"
        }

        $frontendProc = Start-Process -FilePath "npm.cmd" `
            -ArgumentList "run", "dev" `
            -WorkingDirectory $frontendRoot `
            -PassThru `
            -WindowStyle Hidden

        Write-Host "Frontend running -> http://localhost:3000  (PID $($frontendProc.Id))"
    }

    if (-not $BackendOnly -or -not $FrontendOnly) {
        Write-Host ""
        Write-Host "Press ENTER to stop..."
        [void][System.Console]::ReadLine()
    }
}
finally {
    if ($frontendProc -and -not $frontendProc.HasExited) {
        Write-Host "Stopping frontend (PID $($frontendProc.Id))"
        Stop-Process -Id $frontendProc.Id -Force
    }
    if ($backendProc -and -not $backendProc.HasExited) {
        Write-Host "Stopping backend (PID $($backendProc.Id))"
        Stop-Process -Id $backendProc.Id -Force
    }
}
