const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/**
 * Custom ESC/POS Adapter for Windows Spooler Printers.
 * Intercepts raw buffers and uses a PowerShell helper to bypass 
 * the print driver processing completely and send RAW bytes to the printer directly.
 */
class WindowsPrinter {
    constructor(printerName) {
        this.printerName = printerName;
        this.buffer = Buffer.alloc(0);
    }

    open(callback) {
        // Nada que inicializar, el puerto se abre al momento de enviar el archivo.
        process.nextTick(() => {
            if (callback) callback(null);
        });
        return this;
    }

    write(data, callback) {
        // Acumular la data convertida que va mandando escpos a lo largo del ticket
        this.buffer = Buffer.concat([this.buffer, data]);
        if (callback) callback(null);
        return this;
    }

    close(callback) {
        // Creamos archivo binario temporal
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const tmpFile = path.join(os.tmpdir(), `recky-raw-${id}.bin`);

        try {
            fs.writeFileSync(tmpFile, this.buffer);

            // Script de powershell
            const psScript = path.join(process.cwd(), 'send-raw.ps1');

            const ps = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', psScript,
                '-PrinterName', this.printerName,
                '-File', tmpFile
            ], { windowsHide: true });

            let output = '';
            let errOutput = '';

            ps.stdout.on('data', d => output += d.toString());
            ps.stderr.on('data', d => errOutput += d.toString());

            ps.on('close', code => {
                // Limpiamos
                try { fs.unlinkSync(tmpFile); } catch (e) { }

                if (code === 0) {
                    if (callback) callback(null);
                } else {
                    const errorMsg = errOutput.trim() || output.trim() || `PowerShell exited with code ${code}`;
                    if (callback) callback(new Error(`Fallo al enviar a Windows Spooler: ${errorMsg}`));
                }
            });
        } catch (error) {
            try { fs.unlinkSync(tmpFile); } catch (e) { }
            if (callback) callback(error);
        }

        return this;
    }
}

module.exports = WindowsPrinter;
