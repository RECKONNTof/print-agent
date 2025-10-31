# Script de prueba para enviar comandos BEEP a impresoras ESC/POS
# Basado en el script de prueba de corte

param(
  [string]$PrinterName = "CAJA",
  [int]$Count = 4,
  [int]$Duration = 6
)

Write-Host "=== Test de BEEP para impresora ESC/POS ===" -ForegroundColor Cyan
Write-Host "Impresora: $PrinterName" -ForegroundColor Yellow
Write-Host "Número de beeps: $Count" -ForegroundColor Yellow
Write-Host "Duración de cada beep: $Duration (~$([math]::Round($Duration/10,1))s)" -ForegroundColor Yellow
Write-Host ""

try {
    $result = & "$PSScriptRoot\send-beep.ps1" -PrinterName $PrinterName -Count $Count -Duration $Duration -Text "BEEP TEST"
    Write-Host "Resultado: $result" -ForegroundColor Green
    Write-Host "✓ Beep enviado exitosamente" -ForegroundColor Green
}
catch {
    Write-Host "✗ Error al enviar beep: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Prueba completada" -ForegroundColor Cyan
