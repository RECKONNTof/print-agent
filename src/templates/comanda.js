/**
 * Template para Comanda en 80mm de ancho.
 * Asumimos aproximadamente 42 a 48 columnas para un tamaño de fuente normal.
 * 
 * @param {import('escpos').Printer} printer La instancia de escpos.Printer lista y abierta.
 * @param {Object} data Los datos a imprimir.
 */
function printComanda(printer, data) {
    // Encabezado
    printer
        .align('CT')              // Centrado
        .style('B')               // Negrita
        .size(1, 1)               // Tamaño doble
        .text(`COMANDA - ${data.area || ''}`)
        .size(0, 0)               // Tamaño normal
        .text(`${data.ambiente || ''} - Mesa ${data.mesa || ''}`)
        .style('NORMAL')          // Normal
        .text(data.mesero ? `Mesero: ${data.mesero}` : '')
        .text(data.fecha || '')
        .drawLine()               // Línea separadora por defecto (-- ó ==)
        .align('LT');             // Izquierda

    // Detalle de productos
    if (data.items && Array.isArray(data.items)) {
        data.items.forEach(item => {
            // El tableCustom es ideal para columnas personalizadas.
            // Para "Nombre del producto    2x", le damos ancho relativo.
            // Por ejemplo 80% (0.8) al nombre y 20% (0.2) a la cantidad.
            // ESC/POS permite definir array de opciones:
            printer.tableCustom([
                { text: item.nombre || '', align: 'LEFT', width: 0.75, style: 'B' }, // Nombre en negrita
                { text: `${item.cantidad || 1}x`, align: 'RIGHT', width: 0.25, style: 'B' } // Cantidad en negrita
            ], 'cp858'); // cp858 o usar el encoding base

            // Si hay variantes (array o CSV string)
            if (item.variantes) {
                let variantesArr = Array.isArray(item.variantes)
                    ? item.variantes
                    : item.variantes.split(',');

                variantesArr.forEach(v => {
                    printer.text(`   + ${v.trim()}`);
                });
            }

            if (item.cuenta) {
                printer.text(`   Cuenta: ${item.cuenta}`);
            }

            if (item.observacion) {
                printer.text(`   * ${item.observacion}`);
            }
        });
    }

    // Pie
    printer
        .drawLine()
        .align('CT')
        .style('B')
        .text('¡Preparar con urgencia!')
        .feed(3) // 3 Líneas de feed extra para que la impresora corte bien al final
}

module.exports = {
    printComanda
};
