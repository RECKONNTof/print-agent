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
        company_matriz, company_establecimiento, company_contabilidad,
        company_rimpe, company_regime, company_retention,
        company_retention_resolution, company_taxpayer_type,
        company_taxpayer_resolution, company_note,
        invoice_type, invoice_num, invoice_auth,
        invoice_auth_date, invoice_env, invoice_key,
        invoice_date, invoice_observation, invoice_additional_info,
        client_name, client_id, client_address,
        client_email, client_phone, seller, header_type,
        items, subtotal, discount, iva, tip, total, payments
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
    if (company_matriz) printer.text(`Dir. Matriz: ${company_matriz}`);
    if (company_establecimiento) printer.text(`Dir. Sucursal: ${company_establecimiento}`);
    if (company_contabilidad === 'SI') printer.text('OBLIGADO A LLEVAR CONTABILIDAD');
    if (company_rimpe) printer.text('CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE');
    if (company_retention) printer.text(`AGENTE DE RETENCION Resolución No. ${company_retention_resolution || ''}`);
    if (company_taxpayer_type) printer.text(`Contribuyente Especial Resolución No. ${company_taxpayer_resolution || ''}`);
    
    printer.drawLine().align('LT');

    // --- DATOS FACTURA ---
    // Usamos texto plano continuo en vez de tablas para reducir saltos de línea (interlineado) en cabeceras anchas
    printer.style('NORMAL');
    if (invoice_date) printer.text(`Fecha: ${invoice_date}`);
    if (invoice_env) printer.text(`Ambiente: ${invoice_env}`);
    if (invoice_num) printer.text(`Factura Nro: ${invoice_num}`);
    if (invoice_auth) printer.text(`Clave de Acceso:`);
    if (invoice_auth) printer.text(invoice_auth);
    
    printer.drawLine();
    
    // --- DATOS CLIENTE ---
    if (client_name) printer.text(`Cliente: ${client_name}`);
    if (client_id) printer.text(`Identificacion: ${client_id}`);
    if (client_address) printer.text(`Dirección: ${client_address}`);
    if (client_email) printer.text(`Correo: ${client_email}`);
    if (client_phone) printer.text(`Teléfono: ${client_phone}`);
    if (seller) printer.text(`Vendedor: ${seller}`);

    printer.drawLine();

    // --- DETALLE DE PRODUCTOS ---
    printer.style('B');
    printer.tableCustom([
        { text: 'Cant', align: 'LEFT', width: 0.15 },
        { text: 'Descripcion', align: 'LEFT', width: 0.60 },
        { text: 'Total', align: 'RIGHT', width: 0.25 }
    ], 'cp858');
    printer.style('NORMAL');

    if (items && Array.isArray(items)) {
        items.forEach(item => {
            let rowText = item.descripcion || '';
            // Si hay descuento
            if (item.descuento && item.descuento > 0) {
                rowText += ` (Desc: ${formatCurrency(item.descuento)})`;
            }
            
            printer.tableCustom([
                { text: String(item.cantidad || ''), align: 'LEFT', width: 0.15 },
                { text: rowText, align: 'LEFT', width: 0.60 },
                { text: formatCurrency(item.subtotal), align: 'RIGHT', width: 0.25 }
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
            if (p.codFP === '01') fpName = 'Sin utilizacion del sistema financiero'; 
            else if (p.codFP === '15') fpName = 'Compensación de deudas';
            else if (p.codFP === '16') fpName = 'Tarjeta de débito';
            else if (p.codFP === '17') fpName = 'Dinero electrónico';
            else if (p.codFP === '18') fpName = 'Tarjeta prepago';
            else if (p.codFP === '19') fpName = `Tarjeta de crédito | OP: ${p.numOperacion || ''}`;
            else if (p.codFP === '20') fpName = 'Otros con utilizacion del sistema financiero';
            else if (p.codFP === '21') fpName = 'Endoso de títulos';

            printer.text(` - ${fpName} | ${formatCurrency(p.montoTotal)}`);
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