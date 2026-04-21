/**
 * Template para Factura en 80mm de ancho.
 * 
 * @param {import('escpos').Printer} printer La instancia de escpos.Printer.
 * @param {Object} data Los datos a imprimir.
 */
function printFactura(printer, data) {
    if (!data) {
        printer.text('Datos de factura no disponibles').feed(3);
        return;
    }

    const {
        company_name, company_branch, company_ruc,
        invoice_auth, invoice_date, invoice_num,
        client_id, client_name, seller,
        items, subtotal, discount, iva, tip, total,
        payments, invoice_observation, company_note,
        invoice_additional_info
    } = data;

    const formatCurrency = (val) => {
        const num = parseFloat(val) || 0;
        return num.toFixed(2);
    };

    // --- ENCABEZADO EMPRESA ---
    printer.align('CT');

    // Nota: La impresión de imágenes (company_logo / invoice_barcode) vía URL o Base64 
    // directo en ESC/POS requiere procesamiento adicional con librerías como Jimp.
    // Por simplicidad y rendimiento térmica, imprimiremos los textos principales.

    if (company_name) printer.style('B').text(company_name).style('NORMAL');
    if (company_branch) printer.text(company_branch);
    if (company_ruc) printer.text(`RUC: ${company_ruc}`);
    if (invoice_auth) printer.text(`Aut: ${invoice_auth}`);

    printer.drawLine().align('LT');

    // --- DATOS FACTURA ---
    // Usamos texto plano continuo en vez de tablas para reducir saltos de línea (interlineado) en cabeceras anchas
    printer.style('NORMAL');
    if (invoice_date) printer.text(`Fecha: ${invoice_date}`);
    if (invoice_num) printer.text(`Factura Nro: ${invoice_num}`);
    if (client_id) printer.text(`Identificacion: ${client_id}`);
    if (client_name) printer.text(`Cliente: ${client_name}`);
    if (seller) printer.text(`Vendedor: ${seller}`);

    printer.drawLine();

    // --- DETALLE DE PRODUCTOS ---
    printer.style('B');
    printer.tableCustom([
        { text: 'Cant', align: 'LEFT', width: 0.15 },
        { text: 'Descripcion', align: 'LEFT', width: 0.55 },
        { text: 'Total', align: 'RIGHT', width: 0.30 }
    ], 'cp858');
    printer.style('NORMAL');

    if (items && Array.isArray(items)) {
        items.forEach(item => {
            printer.tableCustom([
                { text: String(item.cantidad || ''), align: 'LEFT', width: 0.15 },
                { text: item.descripcion || '', align: 'LEFT', width: 0.55 },
                { text: formatCurrency(item.subtotal), align: 'RIGHT', width: 0.30 }
            ], 'cp858');
        });
    }

    printer.drawLine();

    // --- TOTALES ---
    // Alineados a la derecha: 60% Etiqueta, 40% Valor
    const printTotalRow = (label, value, bold = false) => {
        if (value === undefined || value === null) return;
        if (bold) printer.style('B');
        printer.tableCustom([
            { text: label, align: 'RIGHT', width: 0.60 },
            { text: formatCurrency(value), align: 'RIGHT', width: 0.40 }
        ], 'cp858');
        if (bold) printer.style('NORMAL');
    };

    printTotalRow('Subtotal:', subtotal);
    printTotalRow('Descuento:', discount);
    printTotalRow('IVA:', iva);
    printTotalRow('Propina:', tip);
    printTotalRow('Total:', total, true); // Total en negrita

    printer.drawLine();

    // --- PAGOS ---
    if (payments && Array.isArray(payments) && payments.length > 0) {
        printer.style('B').text('Formas de Pago:').style('NORMAL');
        payments.forEach(p => {
            let fpName = 'Otro';
            if (p.codFP === '03') fpName = 'Efectivo'; // Sin utilizacion del sistema financiero
            else if (p.codFP === '02') fpName = 'Otros c/sistema financiero';
            else if (p.codFP === '04') fpName = `Transferencia | OP: ${p.numOperacion || ''}`;
            else if (p.codFP === '19') fpName = `Tarjeta | OP: ${p.numOperacion || ''}`;

            printer.text(` - ${fpName} | $${formatCurrency(p.montoTotal)}`);
        });
        printer.drawLine();
    }

    // --- OBSERVACIONES Y NOTAS ---
    if (invoice_observation) {
        printer.style('B').text('Obs: ').style('NORMAL').text(invoice_observation);
    }
    if (company_note) {
        printer.style('B').text('Nota: ').style('NORMAL').text(company_note);
    }

    // --- INFORMACIÓN ADICIONAL ---
    if (invoice_additional_info && Array.isArray(invoice_additional_info)) {
        invoice_additional_info.forEach(info => {
            printer.text(`${info.nombreCampo}: ${info.valorCampo}`);
        });
    }

    // --- PIE ---
    printer
        .feed(1)
        .align('CT')
        .text('¡Gracias por su compra!')
        .feed(3); // Avance de líneas para el corte
}

module.exports = {
    printFactura
};