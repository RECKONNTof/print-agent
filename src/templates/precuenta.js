/**
 * Template para Pre-Cuenta en 80mm de ancho.
 * Asumimos aproximadamente 42 a 48 columnas para un tamaño de fuente normal.
 * 
 * @param {import('escpos').Printer} printer La instancia de escpos.Printer lista y abierta.
 * @param {Object} data Los datos a imprimir.
 */
function printPrecuenta(printer, data) {
    const { pedido, fecha_impresion } = data;

    if (!pedido) {
        printer.text('Datos de pedido no disponibles').feed(3);
        return;
    }

    // Funciones de utilidad para formato de moneda
    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return num.toFixed(2);
    };

    // Agrupar por cuentas si es necesario
    let cuentas = [];

    if (pedido.ind_cuenta && Array.isArray(pedido.cuenta) && pedido.cuenta.length > 0) {
        // Agrupar items por cuenta
        const itemsByCuenta = {};
        pedido.items.forEach(item => {
            const c = item.cuenta || 'Sin Cuenta';
            if (!itemsByCuenta[c]) itemsByCuenta[c] = [];
            itemsByCuenta[c].push(item);
        });

        // Crear un ticket por cada cuenta
        Object.keys(itemsByCuenta).forEach(cuentaNombre => {
            const items = itemsByCuenta[cuentaNombre];
            const totalCuenta = items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0);
            
            cuentas.push({
                nombreCuenta: cuentaNombre,
                items: items,
                total: totalCuenta
            });
        });
    } else {
        // Un solo ticket global
        cuentas.push({
            nombreCuenta: null,
            items: pedido.items || [],
            // Si es global, usamos los montos globales; de lo contrario calculamos
            subtotal: pedido.subtotal,
            impuesto: pedido.total_impuesto,
            total: pedido.total
        });
    }

    // Imprimir cada ticket
    cuentas.forEach((cuentaInfo, index) => {
        // Encabezado
        printer
            .align('CT')
            .style('B')
            .text(pedido.nombreComercial || '')
            .text(`RUC: ${pedido.ruc || ''}`)
            .text(`${pedido.nombre_ambiente || ''} #${pedido.nombre_mesa || ''}`)
            .text(`Pedido Nro: ${pedido.numero_pedido || ''}`)
            .style('NORMAL')
            .text(fecha_impresion || '');

        if (cuentaInfo.nombreCuenta) {
            printer.text(`Cuenta: ${cuentaInfo.nombreCuenta}`);
        } else if (pedido.ind_cuenta && pedido.cuenta) {
            // Caso donde ind_cuenta es true pero es una sola cuenta (String)
            const cuentasStr = Array.isArray(pedido.cuenta) ? pedido.cuenta.join(', ') : pedido.cuenta;
            printer.text(`Cuenta: ${cuentasStr}`);
        }

        // Separador
        printer
            .drawLine()
            .align('LT');

        // Información del cliente (Líneas para rellenar a mano si se desea Factura)
        const printInfoLine = (label) => {
            const padding = 40 - label.length;
            const dots = padding > 0 ? '.'.repeat(padding) : '';
            printer.text(`${label}${dots}`);
        };

        printInfoLine('Cliente: ');
        printInfoLine('RUC/DNI: ');

        printer.drawLine();

        // Detalle de productos - Cabecera
        printer.style('B');
        printer.tableCustom([
            { text: 'Cant', align: 'LEFT', width: 0.15 },
            { text: 'Producto', align: 'LEFT', width: 0.55 },
            { text: 'Total', align: 'RIGHT', width: 0.30 }
        ], 'cp858');
        printer.style('NORMAL');

        // Detalle de productos - Cuerpo
        if (cuentaInfo.items && Array.isArray(cuentaInfo.items)) {
            cuentaInfo.items.forEach(item => {
                printer.tableCustom([
                    { text: String(item.cantidad || ''), align: 'LEFT', width: 0.15 },
                    { text: item.nombre || '', align: 'LEFT', width: 0.55 },
                    { text: formatCurrency(item.subtotal), align: 'RIGHT', width: 0.30 }
                ], 'cp858');
            });
        }

        printer.drawLine();

        // Totales
        if (cuentaInfo.nombreCuenta === null) {
            // Es el ticket global
            printer.tableCustom([
                { text: 'Subtotal:', align: 'RIGHT', width: 0.60 },
                { text: formatCurrency(cuentaInfo.subtotal), align: 'RIGHT', width: 0.40 }
            ], 'cp858');

            printer.tableCustom([
                { text: 'Impuestos:', align: 'RIGHT', width: 0.60 },
                { text: formatCurrency(cuentaInfo.impuesto), align: 'RIGHT', width: 0.40 }
            ], 'cp858');

            printer.style('B');
            printer.tableCustom([
                { text: 'TOTAL:', align: 'RIGHT', width: 0.60 },
                { text: formatCurrency(cuentaInfo.total), align: 'RIGHT', width: 0.40 }
            ], 'cp858');
        } else {
            // Es un ticket por cuenta ya dividido
            printer.style('B');
            printer.tableCustom([
                { text: 'TOTAL:', align: 'RIGHT', width: 0.60 },
                { text: formatCurrency(cuentaInfo.total), align: 'RIGHT', width: 0.40 }
            ], 'cp858');
        }

        printer.tableCustom([
            { text: 'PROPINA:', align: 'RIGHT', width: 0.60 },
            { text: '..........', align: 'RIGHT', width: 0.40 }
        ], 'cp858');
        printer.style('NORMAL');

        printer.drawLine();

        // Pie
        printer
            .align('CT')
            .text('Esta es una PRE-CUENTA para su informacion')
            .text('No constituye factura fiscal')
            .feed(3); // Avance de líneas para el corte

        // Si hay más cuentas por imprimir, insertamos un corte de papel parcial
        if (index < cuentas.length - 1) {
            printer.cut(false, 3);
        }
    });
}

module.exports = {
    printPrecuenta
};
