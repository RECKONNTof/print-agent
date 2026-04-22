const { printComanda } = require('../templates/comanda.js');
const { printPrecuenta } = require('../templates/precuenta.js');
const { printCierreCaja } = require('../templates/cierre_caja.js');
const { printFactura } = require('../templates/factura.js');
const WindowsAdapter = require('./WindowsPrinter.js');

// Mapa de impresoras y configuración (en un escenario real vendría de settings.js)
// Para que sea dinámico le pasamos el config
const getPrinterManager = (config) => {
    let escpos;
    let Network;
    let USB;

    try {
        escpos = require('escpos');
        // Install network adapter
        escpos.Network = require('escpos-network');
        // Install USB adapter
        escpos.USB = require('escpos-usb');
    } catch (e) {
        console.error('No se pudo cargar node-escpos y sus adaptadores. Verifica que estén instalados.', e);
    }

    return {
        printTask: async (destino, printData, printerConfig) => {
            return new Promise((resolve, reject) => {
                if (!escpos) return reject(new Error("Módulos escpos no cargados."));

                // Validamos la configuración de la impresora de destino
                const pConfig = printerConfig[destino];
                if (!pConfig) {
                    return reject(new Error(`La impresora ${destino} no está configurada.`));
                }

                let device;
                try {
                    if (pConfig.type === 'network') {
                        device = new escpos.Network(pConfig.ip, pConfig.port || 9100);
                    } else if (pConfig.type === 'usb') {
                        device = pConfig.vid ? new escpos.USB(pConfig.vid, pConfig.pid) : new escpos.USB();
                    } else if (pConfig.type === 'windows') {
                        // Utiliza un script de C#/PowerShell que pasa bytes por encima de drivers instalados
                        device = new WindowsAdapter(pConfig.name || destino); // Pasa la cadena "EPSON TM-U220 Receipt"
                    } else {
                        return reject(new Error(`Tipo de conexión ${pConfig.type} no soportado.`));
                    }
                } catch (err) {
                    return reject(new Error(`Error al instanciar el dispositivo ${pConfig.type} para ${destino}: ${err.message}`));
                }

                // Las opciones de la impresora
                // Ajustamos el width a 40 para evitar que las líneas punteadas y tablas salten de renglón
                // (Común en impresoras EPSON matriz/térmicas como la TM-U220)
                const options = { encoding: "GB18030", width: 40 };
                const printer = new escpos.Printer(device, options);

                device.open(function (error) {
                    if (error) {
                        return reject(new Error(`No se pudo conectar a la impresora ${destino}: ` + error.message));
                    }

                    try {
                        const type = printData.printType || printData.type;
                        const dataContent = printData.data || printData.payload || printData;

                        // Imprime según el tipo de documento. Ej: 'comanda', 'precuenta', 'cierre_caja', 'factura'
                        if (type === 'comanda') {
                            printComanda(printer, dataContent);
                        } else if (type === 'precuenta') {
                            printPrecuenta(printer, dataContent);
                        } else if (type === 'cierre_caja') {
                            printCierreCaja(printer, dataContent);
                        } else if (type === 'factura') {
                            printFactura(printer, dataContent);
                        } else {
                            // Por defecto
                            printComanda(printer, dataContent);
                        }

                        // Lógicas de Beep y Corte nativa de ESC/POS
                        const beepConfig = pConfig.beep || { enabled: false, count: 1, duration: 2 };
                        if (beepConfig.enabled) {
                            printer.beep(beepConfig.count, beepConfig.duration);
                        }

                        const cutConfig = pConfig.cut || { enabled: false, mode: 'partial' };
                        if (cutConfig.enabled) {
                            printer.cut(cutConfig.mode === 'full', 3); // param=lines feed
                        }

                        // Finalizar y cerrar esperando el evento
                        printer.close((err) => {
                            if (err) {
                                console.error("Error al cerrar la impresora:", err);
                                return reject(err);
                            }
                            resolve(true);
                        });

                    } catch (err) {
                        device.close();
                        reject(err);
                    }
                });
            });
        }
    };
};

module.exports = getPrinterManager;
