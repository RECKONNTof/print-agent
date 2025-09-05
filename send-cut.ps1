param(
  [string]$PrinterName = "CAJA",
  [ValidateSet("partial","full")]
  [string]$CutMode = "partial",
  [string]$Text = "",     # opcional: una línea antes del corte
  [int]$Feed = 0          # líneas a alimentar antes del corte
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
            var di = new DOCINFO(){ pDocName = "RAW ESC/POS", pDatatype = "RAW" };
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

# Construir payload: [Texto] + [feed] + [corte] + [reset]
$bytes = New-Object System.Collections.Generic.List[byte]
if ($Text -ne "") {
  $bytes.AddRange([Text.Encoding]::Latin1.GetBytes($Text + "`n"))
}
for ($i=0; $i -lt $Feed; $i++) {
  $bytes.Add(0x0A)  # LF = nueva línea
}
if ($CutMode -eq "full") { $bytes.AddRange(0x1B,0x69) } else { $bytes.AddRange(0x1B,0x6D) } # ESC i / ESC m
$bytes.AddRange(0x1B,0x40)  # ESC @ reset

$ok = [RawPrinter]::SendBytes($PrinterName, $bytes.ToArray())
if ($ok) { Write-Host "OK" } else { throw "WritePrinter failed" }
