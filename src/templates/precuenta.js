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

    if (pedido.ind_cuenta && pedido.cuenta) {
        const cuentasStr = Array.isArray(pedido.cuenta) ? pedido.cuenta.join(', ') : pedido.cuenta;
        printer.text(`Cuenta: ${cuentasStr}`);
    }

    // Separador
    printer
        .drawLine()
        .align('LT');

    // Información del cliente con línea punteada completando el ancho
    // Una línea completa de la TM-U220 y la mayoría son 40 caracteres
    const printInfoLine = (label) => {
        const padding = 40 - label.length;
        const dots = padding > 0 ? '.'.repeat(padding) : '';
        printer.text(`${label}${dots}`);
    };

    printInfoLine('Cliente: ');
    printInfoLine('RUC: ');
    printInfoLine('Correo: ');
    printInfoLine('Telefono: ');
    printInfoLine('Direccion: ');

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
    if (pedido.items && Array.isArray(pedido.items)) {
        pedido.items.forEach(item => {
            printer.tableCustom([
                { text: String(item.cantidad || ''), align: 'LEFT', width: 0.15 },
                { text: item.nombre || '', align: 'LEFT', width: 0.55 },
                { text: `$${formatCurrency(item.subtotal)}`, align: 'RIGHT', width: 0.30 }
            ], 'cp858');
        });
    }

    printer.drawLine();

    // Totales
    // Para alinear todo a la derecha usamos el 60% para los textos descriptivos y 40% para los montos.
    printer.tableCustom([
        { text: 'Subtotal:', align: 'RIGHT', width: 0.60 },
        { text: `$${formatCurrency(pedido.subtotal)}`, align: 'RIGHT', width: 0.40 }
    ], 'cp858');

    printer.tableCustom([
        { text: 'Impuestos:', align: 'RIGHT', width: 0.60 },
        { text: `$${formatCurrency(pedido.total_impuesto)}`, align: 'RIGHT', width: 0.40 }
    ], 'cp858');

    printer.style('B');
    printer.tableCustom([
        { text: 'TOTAL:', align: 'RIGHT', width: 0.60 },
        { text: `$${formatCurrency(pedido.total)}`, align: 'RIGHT', width: 0.40 }
    ], 'cp858');

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
}

module.exports = {
    printPrecuenta
};
