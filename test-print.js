const getPrinterManager = require('./src/printers/printerManager.js');

// Configuración de prueba
const config = require('./settings.js');

const pm = getPrinterManager(config);

// Payload de prueba para el cierre de caja
const cierreCajaPayload = {
    cierre: {
        num_cierre: "000045",
        fecha_apertura: "20/04/2026 08:00:00",
        fecha_cierre: "20/04/2026 18:30:00",
        vendedor: "Rodolfo",
        detalle_cierre: {
            detalleEfectivo: {
                monedas: 15.50,
                billetes5: 50.00,
                billetes10: 100.00,
                billetes20: 200.00,
                billetes50: 150.00,
                billetes100: 300.00
            },
            detalleFP: {
                credito: 0.00,
                efectivo: 150.00,
                tarjeta: 350.00,
                transferencia: 120.00,
                otro: 0.00
            },
            detallePropinas: {
                propinaCredito: 0.00,
                propinaEfectivo: 15.00,
                propinaTarjeta: 25.00,
                propinaTransferencia: 5.00,
                propinaOtro: 0.00
            },
            montoApertura: 50.00,
            totalIngresos: 20.00,
            totalEgresos: 10.00,
            totalEfectivo: 815.50, // Lo registrado físicamente
            totalTransferencias: 120.00,
            totalTarjetas: 350.00,
            detalleIngresos: [
                { fechaRegistro: "10:00 AM", motivo: "Suelto inicial", monto: 20.00 }
            ],
            detalleEgresos: [
                { fechaRegistro: "14:30 PM", motivo: "Pago agua", monto: 10.00 }
            ],
            totalVentas: 620.00
        },
        subtotal: 553.57
    },
    diferencia_efectivo_estado: "Sobrante",
    diferencia_efectivo: 5.50,
    diferencia_transferencia_estado: "Cuadra",
    diferencia_transferencia: 0.00,
    diferencia_tarjeta_estado: "Cuadra",
    diferencia_tarjeta: 0.00,
    total_registrado: 1285.50,
    diferencia: 5.50,
    resultado_texto: "Cierre con Diferencias",
    ticket_promedio: 24.80,
    fecha_impresion: new Date().toLocaleString('es-ES')
};

console.log("Iniciando prueba de impresión de CIERRE DE CAJA...");

pm.printTask("CAJA", { type: "cierre_caja", payload: cierreCajaPayload }, config.printers)
    .then(() => {
        console.log("¡Prueba de impresión enviada exitosamente al spooler!");
        setTimeout(() => process.exit(0), 1000);
    })
    .catch(err => {
        console.error("Error al imprimir la prueba:", err);
        process.exit(1);
    });
