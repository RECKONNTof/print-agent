param(
  [string]$PrinterName = "CAJA",
  [int]$Feed = 2
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public class DOCINFO { public string pDocName; public string pOutputFile; public string pDatatype; }

public static class RawPrinter {
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

  public static bool SendBytes(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    try {
      var di = new DOCINFO(){ pDocName = "ESC_POS_CUT", pDatatype = "RAW" };
      if (!StartDocPrinter(h, 1, di)) return false;
      try {
        if (!StartPagePrinter(h)) return false;
        try { int w; if (!WritePrinter(h, bytes, bytes.Length, out w)) return false; }
        finally { EndPagePrinter(h); }
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
    return true;
  }
}
"@

# Construir payload
$bytes = New-Object System.Collections.Generic.List[byte]
$bytes.AddRange([byte[]](0x1B,0x40))  # ESC @ (init)
for ($i=0; $i -lt $Feed; $i++){ $bytes.Add(0x0A) }  # LF x Feed
$bytes.AddRange([byte[]](0x1B,0x6D)) # ESC m (corte parcial)
$bytes.AddRange([byte[]](0x1B,0x40)) # ESC @ (reset)

if ([RawPrinter]::SendBytes($PrinterName, $bytes.ToArray())) { "OK" } else { throw "WritePrinter failed" }
