/**
 * Template para Cierre de Caja en 80mm de ancho.
 * 
 * @param {import('escpos').Printer} printer La instancia de escpos.Printer lista y abierta.
 * @param {Object} data Los datos a imprimir.
 */
function printCierreCaja(printer, data) {
    const {
        cierre,
        diferencia_efectivo_estado, diferencia_efectivo,
        diferencia_transferencia_estado, diferencia_transferencia,
        diferencia_tarjeta_estado, diferencia_tarjeta,
        total_registrado, diferencia, resultado_texto, ticket_promedio, fecha_impresion
    } = data;

    if (!cierre) {
        printer.text('Datos de cierre no disponibles').feed(3);
        return;
    }

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return num.toFixed(2);
    };

    const printRow = (label, value, bold = false) => {
        if (bold) printer.style('B');
        printer.tableCustom([
            { text: label, align: 'LEFT', width: 0.60 },
            { text: value, align: 'RIGHT', width: 0.40 }
        ], 'cp858');
        if (bold) printer.style('NORMAL');
    };

    // Encabezado
    printer
        .align('CT')
        .style('B')
        .size(1, 1)
        .text(`CIERRE DE CAJA Nº${cierre.num_cierre || ''}`)
        .size(0, 0)
        .style('NORMAL')
        .drawLine()
        .align('LT');

    // Información del cierre
    printer.text(`Apertura: ${cierre.fecha_apertura || ''}`);
    printer.text(`Cierre:   ${cierre.fecha_cierre || ''}`);
    printer.text(`Vendedor: ${cierre.vendedor || ''}`);

    const detCierre = cierre.detalle_cierre || {};

    // REGISTRO DE EFECTIVO
    if (detCierre.detalleEfectivo) {
        printer.drawLine().style('B').text('REGISTRO DE EFECTIVO').style('NORMAL');
        const ef = detCierre.detalleEfectivo;
        printRow('Monedas:', `$${formatCurrency(ef.monedas)}`);
        printRow('Billetes $5:', `$${formatCurrency(ef.billetes5)}`);
        printRow('Billetes $10:', `$${formatCurrency(ef.billetes10)}`);
        printRow('Billetes $20:', `$${formatCurrency(ef.billetes20)}`);
        printRow('Billetes $50:', `$${formatCurrency(ef.billetes50)}`);
        printRow('Billetes $100:', `$${formatCurrency(ef.billetes100)}`);
    }

    // FORMAs DE PAGO
    if (detCierre.detalleFP) {
        printer.drawLine().style('B').text('FORMAS DE PAGO').style('NORMAL');
        const fp = detCierre.detalleFP;
        printRow('Credito:', `$${formatCurrency(fp.credito)}`);
        printRow('Efectivo:', `$${formatCurrency(fp.efectivo)}`);
        printRow('Tarjeta:', `$${formatCurrency(fp.tarjeta)}`);
        printRow('Transferencia:', `$${formatCurrency(fp.transferencia)}`);
        printRow('Otros:', `$${formatCurrency(fp.otro)}`);
    }

    // PROPINAS
    if (detCierre.detallePropinas) {
        // Asumiendo que el HTML validó con detalleFP pero usa detallePropinas
        printer.drawLine().style('B').text('PROPINAS').style('NORMAL');
        const prop = detCierre.detallePropinas;
        printRow('Credito:', `$${formatCurrency(prop.propinaCredito)}`);
        printRow('Efectivo:', `$${formatCurrency(prop.propinaEfectivo)}`);
        printRow('Tarjeta:', `$${formatCurrency(prop.propinaTarjeta)}`);
        printRow('Transferencia:', `$${formatCurrency(prop.propinaTransferencia)}`);
        printRow('Otros:', `$${formatCurrency(prop.propinaOtro)}`);
    }

    // RESUMEN DE EFECTIVO
    printer.drawLine().style('B').text('RESUMEN DE EFECTIVO').style('NORMAL');
    printRow('Monto Apertura:', `$${formatCurrency(detCierre.montoApertura)}`);
    printRow('Ventas en Efectivo:', `$${formatCurrency(detCierre.detalleFP?.efectivo)}`);
    printRow('Ingresos Caja:', `$${formatCurrency(detCierre.totalIngresos)}`);
    printRow('Egresos Caja:', `$${formatCurrency(detCierre.totalEgresos)}`);
    printRow('Efectivo Registrado:', `$${formatCurrency(detCierre.totalEfectivo)}`);
    printRow('Diferencia:', `(${diferencia_efectivo_estado || ''}) $${formatCurrency(diferencia_efectivo)}`);

    // RESUMEN DE TRANSFERENCIAS
    printer.drawLine().style('B').text('RESUMEN DE TRANSFERENCIAS').style('NORMAL');
    printRow('Ventas Transferencia:', `$${formatCurrency(detCierre.detalleFP?.transferencia)}`);
    printRow('Transf Registradas:', `$${formatCurrency(detCierre.totalTransferencias)}`);
    printRow('Diferencia:', `(${diferencia_transferencia_estado || ''}) $${formatCurrency(diferencia_transferencia)}`);

    // RESUMEN DE TARJETAS
    printer.drawLine().style('B').text('RESUMEN DE TARJETAS').style('NORMAL');
    printRow('Ventas con Tarjeta:', `$${formatCurrency(detCierre.detalleFP?.tarjeta)}`);
    printRow('Valor en Tarjetas:', `$${formatCurrency(detCierre.totalTarjetas)}`);
    printRow('Diferencia:', `(${diferencia_tarjeta_estado || ''}) $${formatCurrency(diferencia_tarjeta)}`);

    // INGRESOS
    if (detCierre.detalleIngresos && detCierre.detalleIngresos.length > 0) {
        printer.drawLine().style('B').text('INGRESOS').style('NORMAL');
        printer.tableCustom([
            { text: 'FECHA', align: 'LEFT', width: 0.30 },
            { text: 'MOTIVO', align: 'LEFT', width: 0.45 },
            { text: 'MONTO', align: 'RIGHT', width: 0.25 }
        ], 'cp858');
        detCierre.detalleIngresos.forEach(ing => {
            printer.tableCustom([
                { text: ing.fechaRegistro || '', align: 'LEFT', width: 0.30 },
                { text: ing.motivo || '', align: 'LEFT', width: 0.45 },
                { text: `$${formatCurrency(ing.monto)}`, align: 'RIGHT', width: 0.25 }
            ], 'cp858');
        });
    }

    // EGRESOS
    if (detCierre.detalleEgresos && detCierre.detalleEgresos.length > 0) {
        printer.drawLine().style('B').text('EGRESOS').style('NORMAL');
        printer.tableCustom([
            { text: 'FECHA', align: 'LEFT', width: 0.30 },
            { text: 'MOTIVO', align: 'LEFT', width: 0.45 },
            { text: 'MONTO', align: 'RIGHT', width: 0.25 }
        ], 'cp858');
        detCierre.detalleEgresos.forEach(egr => {
            printer.tableCustom([
                { text: egr.fechaRegistro || '', align: 'LEFT', width: 0.30 },
                { text: egr.motivo || '', align: 'LEFT', width: 0.45 },
                { text: `$${formatCurrency(egr.monto)}`, align: 'RIGHT', width: 0.25 }
            ], 'cp858');
        });
    }

    // RESUMEN DEL CIERRE
    printer.drawLine().style('B').text('RESUMEN DEL CIERRE').style('NORMAL');
    printRow('Subtotal Ventas:', `$${formatCurrency(cierre.subtotal)}`);
    printRow('Total Ventas:', `$${formatCurrency(detCierre.totalVentas)}`);
    printRow('Monto Apertura:', `$${formatCurrency(detCierre.montoApertura)}`);
    printRow('Total Ingresos:', `$${formatCurrency(detCierre.totalIngresos)}`);
    printRow('Total Egresos:', `$${formatCurrency(detCierre.totalEgresos)}`);
    printRow('Total Registrado:', `$${formatCurrency(total_registrado)}`);
    printRow('Diferencia:', `$${formatCurrency(diferencia)}`, true); // Bold

    // RESULTADO
    printer
        .drawLine()
        .align('CT')
        .style('B')
        .text('Resultado del Cierre')
        .text(resultado_texto || '')
        .text(`Ticket Promedio: $${formatCurrency(ticket_promedio)}`)
        .style('NORMAL')
        .drawLine();

    // PIE
    printer
        .align('CT')
        .text(fecha_impresion || '')
        .text('Ticket generado por RECKONNT')
        .text('www.reckonnt.net')
        .feed(3);
}

module.exports = {
    printCierreCaja
};
