[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$PrinterName,                       # Ej: "CAJA"

  [string]$Text = "=== TEST ESC/POS CUT ===", # Línea preliminar
  [int]$Feed = 2,                             # Líneas antes de cortar
  [ValidateSet('partial','full','gs0','gs1','gsbn','auto')]
  [string]$Mode = 'auto',                     # auto = prueba todos
  [int]$Bn = 3,                               # n para GS V 66 n
  [switch]$NoReset,                           # no enviar ESC @ al final
  [int]$DelayMs = 300                         # pausa entre intentos (auto)
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public class DOCINFO
{
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDatatype;
}

public static class RawPrinter
{
    [DllImport("winspool.Drv", SetLastError=true, CharSet=CharSet.Unicode)]
    static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.Drv", SetLastError=true)]
    static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true, CharSet=CharSet.Unicode)]
    static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In] DOCINFO pDocInfo);
    [DllImport("winspool.Drv", SetLastError=true)]
    static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendBytes(string printer, byte[] bytes)
    {
        IntPtr h;
        if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
        try
        {
            var di = new DOCINFO(){ pDocName = "ESC_POS_TEST", pDatatype = "RAW" };
            if (!StartDocPrinter(h, 1, di)) return false;
            try
            {
                if (!StartPagePrinter(h)) return false;
                try
                {
                    int w;
                    if (!WritePrinter(h, bytes, bytes.Length, out w)) return false;
                }
                finally { EndPagePrinter(h); }
            }
            finally { EndDocPrinter(h); }
        }
        finally { ClosePrinter(h); }
        return true;
    }
}
"@

function New-EscPosPayload {
  param(
    [byte[]]$CutBytes,     # p.ej. 1B 6D
    [string]$Label,        # etiqueta visible en el ticket
    [int]$Feed = 0,
    [switch]$NoReset
  )

  $bytes = New-Object System.Collections.Generic.List[byte]

  # ESC @ (init)
  $bytes.AddRange([byte[]](0x1B,0x40))

  # Etiqueta
  if ($Label) {
    $bytes.AddRange([Text.Encoding]::Latin1.GetBytes($Label))
    $bytes.Add(0x0A) # LF
  }

  # Feed N líneas
  for ($i=0; $i -lt $Feed; $i++){ $bytes.Add(0x0A) }

  # Corte
  $bytes.AddRange($CutBytes)

  # Reset final (opcional)
  if (-not $NoReset) { $bytes.AddRange([byte[]](0x1B,0x40)) }

  return $bytes.ToArray()
}

function Send-Payload {
  param([byte[]]$Payload, [string]$Label)
  Write-Host ("Enviando: {0}" -f $Label) -ForegroundColor Cyan
  $ok = [RawPrinter]::SendBytes($PrinterName, $Payload)
  if ($ok) { Write-Host "OK" -ForegroundColor Green }
  else     { Write-Warning "WritePrinter falló" }
}

# Secuencias típicas de corte:
$CUT_ESC_m = [byte[]](0x1B,0x6D)         # ESC m  -> parcial (legacy)
$CUT_ESC_i = [byte[]](0x1B,0x69)         # ESC i  -> total   (legacy)
$CUT_GS_V0 = [byte[]](0x1D,0x56,0x00)    # GS V 0 -> total   (estándar)
$CUT_GS_V1 = [byte[]](0x1D,0x56,0x01)    # GS V 1 -> parcial (estándar)
$CUT_GS_VBn = [byte[]](0x1D,0x56,0x42,[byte]$Bn)  # GS V 66 n

switch ($Mode) {
  'partial' {
    $p = New-EscPosPayload -CutBytes $CUT_ESC_m -Label "CUT: ESC m (partial)" -Feed $Feed -NoReset:$NoReset
    Send-Payload -Payload $p -Label 'ESC m (partial)'
    return
  }
  'full' {
    $p = New-EscPosPayload -CutBytes $CUT_ESC_i -Label "CUT: ESC i (full)" -Feed $Feed -NoReset:$NoReset
    Send-Payload -Payload $p -Label 'ESC i (full)'
    return
  }
  'gs0' {
    $p = New-EscPosPayload -CutBytes $CUT_GS_V0 -Label "CUT: GS V 0 (full)" -Feed $Feed -NoReset:$NoReset
    Send-Payload -Payload $p -Label 'GS V 0 (full)'
    return
  }
  'gs1' {
    $p = New-EscPosPayload -CutBytes $CUT_GS_V1 -Label "CUT: GS V 1 (partial)" -Feed $Feed -NoReset:$NoReset
    Send-Payload -Payload $p -Label 'GS V 1 (partial)'
    return
  }
  'gsbn' {
    $p = New-EscPosPayload -CutBytes $CUT_GS_VBn -Label "CUT: GS V 66 n (n=$Bn)" -Feed $Feed -NoReset:$NoReset
    Send-Payload -Payload $p -Label "GS V 66 n (n=$Bn)"
    return
  }
}

# AUTO: probar todos y ver cuál corta bien físicamente
$tests = @(
  @{ label='ESC m (partial)';   cut=$CUT_ESC_m  ; tag='CUT: ESC m (partial)'     },
  @{ label='ESC i (full)';      cut=$CUT_ESC_i  ; tag='CUT: ESC i (full)'        },
  @{ label='GS V 0 (full)';     cut=$CUT_GS_V0  ; tag='CUT: GS V 0 (full)'       },
  @{ label='GS V 1 (partial)';  cut=$CUT_GS_V1  ; tag='CUT: GS V 1 (partial)'    },
  @{ label="GS V 66 n (n=$Bn)"; cut=$CUT_GS_VBn ; tag="CUT: GS V 66 n (n=$Bn)"   }
)

$idx = 1
foreach ($t in $tests) {
  Write-Host ("[{0}/{1}] Probando {2}..." -f $idx, $tests.Count, $t.label) -ForegroundColor Yellow
  $p = New-EscPosPayload -CutBytes $t.cut -Label $t.tag -Feed $Feed -NoReset:$NoReset
  Send-Payload -Payload $p -Label $t.label
  if ($idx -lt $tests.Count) { Start-Sleep -Milliseconds $DelayMs }
  $idx++
}

Write-Host "Finalizado." -ForegroundColor Green
