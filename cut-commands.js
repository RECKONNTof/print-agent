/**
 * Módulo de comandos de corte ESC/POS para integrar con recky-print-agent.js
 * 
 * Este módulo proporciona funciones para enviar comandos de corte
 * después de la impresión usando los archivos cut.bin generados.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CutCommandsManager {
    constructor() {
        this.cutBinPath = path.join(__dirname, 'cut.bin');
        this.cutPartialBinPath = path.join(__dirname, 'cut-partial.bin');
    }

    /**
     * Verifica si los archivos de comandos de corte existen
     */
    checkCutFilesExist() {
        const cutExists = fs.existsSync(this.cutBinPath);
        const cutPartialExists = fs.existsSync(this.cutPartialBinPath);

        if (!cutExists && !cutPartialExists) {
            throw new Error('No se encontraron archivos de comandos de corte. Ejecute: node generate-cut-bin.js');
        }

        return { cutExists, cutPartialExists };
    }

    /**
     * Envía comandos de corte a la impresora especificada
     * @param {string} printerName - Nombre de la impresora
     * @param {boolean} usePartialCut - Si usar corte parcial en lugar de completo
     */
    sendCutCommand(printerName, usePartialCut = false) {
        try {
            this.checkCutFilesExist();

            const cutFilePath = usePartialCut ? this.cutPartialBinPath : this.cutBinPath;
            const cutType = usePartialCut ? 'parcial' : 'completo';

            if (!fs.existsSync(cutFilePath)) {
                throw new Error(`Archivo de corte ${cutType} no encontrado: ${cutFilePath}`);
            }

            // En Windows, enviar archivo binario directamente a la impresora
            let command;

            if (printerName) {
                // Enviar a impresora específica
                command = `copy /b "${cutFilePath}" "\\\\localhost\\${printerName}"`;
            } else {
                throw new Error('Nombre de impresora requerido para enviar comandos de corte');
            }

            console.log(`Enviando comando de corte ${cutType} a impresora: ${printerName}`);
            console.log(`Comando: ${command}`);

            execSync(command, { stdio: 'inherit' });

            return {
                success: true,
                message: `Comando de corte ${cutType} enviado exitosamente a ${printerName}`
            };

        } catch (error) {
            console.error(`Error al enviar comando de corte: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Envía comandos de corte con reintentos
     * @param {string} printerName - Nombre de la impresora
     * @param {boolean} usePartialCut - Si usar corte parcial
     * @param {number} maxRetries - Número máximo de reintentos
     */
    async sendCutCommandWithRetry(printerName, usePartialCut = false, maxRetries = 2) {
        let lastError;

        // Primero intentar con el tipo de corte especificado
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = this.sendCutCommand(printerName, usePartialCut);
                if (result.success) {
                    return result;
                }
                lastError = result.error;
            } catch (error) {
                lastError = error.message;
                console.log(`Intento ${attempt} falló: ${error.message}`);
            }

            if (attempt < maxRetries) {
                console.log(`Reintentando en 1 segundo...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Si falló con el tipo especificado, intentar con el otro tipo
        if (!usePartialCut) {
            console.log('Intentando con corte parcial como alternativa...');
            try {
                const result = this.sendCutCommand(printerName, true);
                if (result.success) {
                    console.log('Corte parcial funcionó como alternativa');
                    return result;
                }
            } catch (error) {
                console.log(`Corte parcial también falló: ${error.message}`);
            }
        }

        return {
            success: false,
            error: `Todos los intentos de corte fallaron. Último error: ${lastError}`
        };
    }

    /**
     * Obtiene información sobre los archivos de corte disponibles
     */
    getCutFilesInfo() {
        const files = this.checkCutFilesExist();
        const info = [];

        if (files.cutExists) {
            const stats = fs.statSync(this.cutBinPath);
            info.push({
                file: 'cut.bin',
                type: 'Corte completo',
                size: stats.size,
                path: this.cutBinPath
            });
        }

        if (files.cutPartialExists) {
            const stats = fs.statSync(this.cutPartialBinPath);
            info.push({
                file: 'cut-partial.bin',
                type: 'Corte parcial',
                size: stats.size,
                path: this.cutPartialBinPath
            });
        }

        return info;
    }
}

// Funciones de conveniencia para usar directamente
const cutManager = new CutCommandsManager();

/**
 * Función simple para enviar corte después de impresión
 */
function sendCutAfterPrint(printerName, usePartialCut = false) {
    return cutManager.sendCutCommandWithRetry(printerName, usePartialCut);
}

/**
 * Función para obtener información de archivos de corte
 */
function getCutFilesInfo() {
    return cutManager.getCutFilesInfo();
}

module.exports = {
    CutCommandsManager,
    sendCutAfterPrint,
    getCutFilesInfo
};
