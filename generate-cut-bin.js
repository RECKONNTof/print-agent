/**
 * Generador de archivo cut.bin con comandos ESC/POS
 * 
 * Este script crea un archivo binario con los comandos ESC/POS
 * necesarios para realizar el corte de papel después de la impresión.
 */

const fs = require('fs');
const path = require('path');

function generateCutCommands() {
    // Array para almacenar los bytes del comando
    const commands = [];

    // 1. Alimentar algunas líneas de papel antes del corte (opcional)
    // ESC d n - Alimenta n líneas de papel
    // ESC = 0x1B, d = 0x64, n = número de líneas (ej: 3 líneas)
    commands.push(0x1B, 0x64, 0x03);

    // 2. Comando de corte completo del papel
    // GS V m - Corte del papel
    // GS = 0x1D, V = 0x56, m = modo de corte
    // m = 0 o 48 (0x30) = corte completo
    // m = 1 o 49 (0x31) = corte parcial
    commands.push(0x1D, 0x56, 0x00);  // Corte completo

    // 3. Comando alternativo de corte (por compatibilidad)
    // ESC i - Corte inmediato del papel (algunos modelos)
    commands.push(0x1B, 0x69);

    // 4. Alimentar papel después del corte para facilitar el desgarro
    // ESC d n - Alimenta n líneas adicionales
    commands.push(0x1B, 0x64, 0x02);

    return Buffer.from(commands);
}

function generateCutCommandsPartial() {
    // Versión alternativa con corte parcial
    const commands = [];

    // Alimentar líneas antes del corte
    commands.push(0x1B, 0x64, 0x03);

    // Corte parcial del papel
    commands.push(0x1D, 0x56, 0x01);  // Corte parcial

    // Alimentar papel para facilitar el desgarro manual
    commands.push(0x1B, 0x64, 0x05);

    return Buffer.from(commands);
}

// Generar el archivo cut.bin con corte completo
try {
    const cutCommands = generateCutCommands();
    const outputPath = path.join(__dirname, 'cut.bin');

    fs.writeFileSync(outputPath, cutCommands);
    console.log(`Archivo cut.bin creado exitosamente en: ${outputPath}`);
    console.log(`Tamaño del archivo: ${cutCommands.length} bytes`);
    console.log('Comandos incluidos:');
    console.log('- ESC d 3: Alimentar 3 líneas de papel');
    console.log('- GS V 0: Corte completo del papel');
    console.log('- ESC i: Comando de corte inmediato (compatibilidad)');
    console.log('- ESC d 2: Alimentar 2 líneas adicionales');

    // También crear una versión con corte parcial
    const cutCommandsPartial = generateCutCommandsPartial();
    const outputPathPartial = path.join(__dirname, 'cut-partial.bin');

    fs.writeFileSync(outputPathPartial, cutCommandsPartial);
    console.log(`\nArchivo cut-partial.bin creado como alternativa`);
    console.log('Este archivo usa corte parcial para impresoras que lo requieren');

} catch (error) {
    console.error('Error al crear el archivo cut.bin:', error.message);
    process.exit(1);
}
