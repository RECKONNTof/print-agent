param(
  [string]$PrinterName = "CAJA",
  [int]$Count = 4,              # número de pitidos (beeps)
  [int]$Duration = 6,           # duración de cada beep (~0.6 segundos)
  [string]$Text = ""            # texto opcional para debug
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public class DOCINFO
{
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
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
        try {
            var di = new DOCINFO(){ pDocName = "ESC_POS_BEEP", pDatatype = "RAW" };
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

# --- Secuencias ESC/POS para BEEP ---
[byte[]]$init = 0x1B,0x40  # ESC @ - Inicializar impresora

# Comando BEEP: ESC B n l
# ESC = 0x1B, B = 0x42, n = número de beeps, l = duración
[byte[]]$beep = 0x1B,0x42,[byte]$Count,[byte]$Duration

[byte[]]$reset = 0x1B,0x40  # ESC @ - Reset

# Texto opcional para debug
[byte[]]$txt = @()
if ($Text) { 
    $txt = [Text.Encoding]::Latin1.GetBytes($Text) + [byte[]](0x0A) 
}

# Payload final: init + texto (opcional) + beep + reset
[byte[]]$payload = $init + $txt + $beep + $reset

$sent = [RawPrinter]::SendBytes($PrinterName, $payload)
if ($sent) { 
    "OK (bytes=" + $payload.Length + ", count=$Count, duration=$Duration)" 
} else { 
    throw "WritePrinter failed" 
}
