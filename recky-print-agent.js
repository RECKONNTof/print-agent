/**
 * Recky Print Agent - Versión simplificada
 * 
 * Agente de impresión local para el sistema Recky que permite
 * la impresión silenciosa de documentos desde el servidor.
 * 
 * Funcionalidades:
 * - Conexión WebSocket autenticada automáticamente con el servidor
 * - Impresión silenciosa de documentos
 * - Autenticación automática usando el agentKey configurado en settings.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const { execSync } = require('child_process');

// Cargar configuración desde settings.js
let userConfig = {};
try {
    userConfig = require('./settings.js');
    console.log('Configuración cargada desde settings.js');
} catch (error) {
    console.warn(`No se pudo cargar el archivo settings.js: ${error.message}`);
    console.warn('Se utilizará la configuración predeterminada');
}

// Configuración básica con valores predeterminados
const CONFIG = {
    serverUrl: userConfig.serverUrl || 'wss://your-recky-server.com/ws',
    agentKey: userConfig.agentKey || 'default-agent-key',
    logFile: userConfig.logFile || path.join(process.cwd(), 'recky-print-agent.log'),
    reconnectTimeout: userConfig.reconnectTimeout || 5000,
    reconnectMaxAttempts: userConfig.reconnectMaxAttempts || 100,
    tempFileCleanupDelay: userConfig.tempFileCleanupDelay || 3000,
    sumatraPath: userConfig.sumatraPath || '',
    defaultPrinter: userConfig.defaultPrinter || null,
};

// Directorio temporal para archivos
const TMP_DIR = userConfig.tempDir || path.join(os.tmpdir(), 'recky-print');

// Asegurar que existe el directorio temporal
if (!fs.existsSync(TMP_DIR)) {
    try {
        fs.mkdirSync(TMP_DIR, { recursive: true });
    } catch (error) {
        console.error(`Error al crear directorio temporal: ${error.message}`);
        process.exit(1);
    }
}

// Sistema de logs básico
const logger = {
    log: function (message) {
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} - ${message}\n`;
        console.log(logMessage.trim());
        try {
            fs.appendFileSync(CONFIG.logFile, logMessage);
        } catch (error) {
            console.error(`Error al escribir en archivo de log: ${error.message}`);
        }
    },
    error: function (message) {
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} - ERROR: ${message}\n`;
        console.error(logMessage.trim());
        try {
            fs.appendFileSync(CONFIG.logFile, logMessage);
        } catch (error) {
            console.error(`Error al escribir en archivo de log: ${error.message}`);
        }
    }
};

// Imprimir un archivo según el sistema operativo
function printFile(filePath, printerName) {
    try {
        const platform = os.platform();
        let command;

        if (platform === 'win32') {
            // Windows
            if (!CONFIG.sumatraPath) {
                logger.error('Ruta de SumatraPDF no configurada. Por favor, actualice settings.js con la ruta correcta.');
                throw new Error('Ruta de SumatraPDF no configurada');
            }
            command = printerName
                ? `${CONFIG.sumatraPath} -print-to "${printerName}" "${filePath}"`
                : logger.log(`Impresora ${printerName} no encontrada.`);
            logger.log(`Comando de impresión para Windows: ${command}`);
        } else if (platform === 'darwin') {
            // macOS
            command = printerName
                ? `lpr -P "${printerName}" "${filePath}"`
                : `lpr "${filePath}"`;
        } else {
            // Linux
            command = printerName
                ? `lp -d "${printerName}" "${filePath}"`
                : `lp "${filePath}"`;
        }

        logger.log(`Ejecutando comando: ${command}`);
        execSync(command);
        return true;
    } catch (error) {
        logger.error(`Error al imprimir: ${error.message}`);
        throw error;
    }
}

// Procesar trabajo de impresión
async function processPrintJob(data) {
    try {
        const { file, filename, destino, contentType, jobId, idUsuario } = data;

        logger.log(`Procesando trabajo de impresión ${jobId || ''} para impresora ${destino || 'predeterminada'}`);

        // Guardar archivo en disco temporal
        const tempFilePath = path.join(TMP_DIR, filename);

        // Decodificar contenido base64 y guardar
        const fileBuffer = Buffer.from(file, 'base64');
        fs.writeFileSync(tempFilePath, fileBuffer);

        logger.log(`Archivo guardado en: ${tempFilePath}`);

        const printerName = (destino && destino.trim() !== '') ? destino : CONFIG.defaultPrinter;

        console.log(`Usando impresora: ${printerName}`);

        // Imprimir
        printFile(tempFilePath, printerName);
        setTimeout(() => {
            try {
                fs.unlinkSync(tempFilePath);
                logger.log(`Archivo temporal eliminado: ${tempFilePath}`);
            } catch (err) {
                logger.error(`Error al eliminar archivo temporal: ${err.message}`);
            }
        }, CONFIG.tempFileCleanupDelay);

        return {
            success: true,
            message: `Documento impreso correctamente en ${destino || 'impresora predeterminada'}`,
            idUsuario
        };

    } catch (error) {
        logger.error(`Error al procesar trabajo: ${error.message}`);
        return {
            success: false,
            error: error.message,
            message: `Error al imprimir: ${error.message}`,
            idUsuario: data.idUsuario
        };
    }
}

// Cliente WebSocket
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    connect() {
        try {
            logger.log(`Conectando a ${CONFIG.serverUrl}`);

            this.ws = new WebSocket(CONFIG.serverUrl);
            this.ws.on('open', () => {
                logger.log(`Conexión establecida (ID: ${Date.now()})`);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                logger.log('Conexión WebSocket establecida, iniciando autenticación automática');

                // Autenticar automáticamente al conectar
                this.authenticate();
            });

            this.ws.on('message', async (data) => {
                try {
                    console.log(`------- Nuevo mensaje recibido -------`);
                    console.log(`Datos: ${data.toString()}`);

                    let message;
                    try {
                        message = JSON.parse(data);
                    } catch (parseError) {
                        logger.error(`Error al parsear JSON: ${parseError.message}`);
                        logger.error(`Contenido no JSON recibido: ${data.toString()}`);
                        return;
                    }

                    // Validar que el mensaje tiene estructura correcta
                    if (!message || typeof message !== 'object') {
                        logger.error('Mensaje recibido con formato inválido');
                        return;
                    }

                    await this.handleMessage(message);
                } catch (error) {
                    logger.error(`Error general al procesar mensaje: ${error.message}`);
                    logger.error(`Stack: ${error.stack}`);
                }
            });

            this.ws.on('close', (code, reason) => {
                logger.log(`Conexión cerrada con código: ${code}, razón: ${reason || 'No especificada'}`);
                this.isConnected = false;
                this.attemptReconnect();
            });

            this.ws.on('error', (error) => {
                logger.error(`Error de WebSocket: ${error.message}`);
            });

        } catch (error) {
            logger.error(`Error al conectar: ${error.message}`);
            this.attemptReconnect();
        }
    }

    authenticate() {
        const authMessage = {
            action: 'authenticateAgent',
            payload: {
                token: CONFIG.agentKey,
                agentName: "silentPrint"
            }
        };

        this.send(authMessage);
        logger.log(`Autenticación enviada con clave: ${CONFIG.agentKey}`);
    }

    async handleMessage(message) {
        try {
            const { action, payload } = message;

            console.log(`Manejando mensaje: ${action || 'sin acción'}`);
            console.log(`Payload recibido:`, payload);

            // Si no hay acción definida, no procesamos el mensaje
            if (!action) {
                logger.error('Mensaje recibido sin acción definida, ignorando');
                logger.error(`Contenido del mensaje: ${JSON.stringify(message)}`);
                return;
            }

            switch (action) {
                case 'authenticated':
                    logger.log('El agente está activo y esperando trabajos de impresión');
                    break;

                case 'silentPrint':
                    if (!payload) {
                        logger.error('Trabajo de impresión recibido sin datos');
                        return;
                    }
                    logger.log(`Recibido trabajo de impresión para ${payload.destino || 'impresora predeterminada'}`);

                    // Procesar trabajo e imprimir
                    const result = await processPrintJob(payload);

                    // Enviar resultado de vuelta al servidor
                    // this.send({
                    //     action: 'printJobResult',
                    //     payload: result
                    // });

                    break;

                case 'ping':
                    logger.log('Ping recibido del servidor, respondiendo');
                    setTimeout(() => {
                        this.send({
                            action: 'pong',
                            payload: { timestamp: Date.now() }
                        });
                    }, 10);
                    break;

                default:
                    logger.log(`Acción desconocida: "${action}"`);
                    logger.log(`Datos: ${JSON.stringify(payload || {})}`);
            }
        } catch (error) {
            logger.error(`Error en handleMessage: ${error.message}`);
            logger.error(`Stack trace: ${error.stack}`);
        }
    }

    send(data) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify(data));
        } else {
            logger.error('Intento de enviar mensaje sin conexión activa');
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < CONFIG.reconnectMaxAttempts) {
            this.reconnectAttempts++;
            const timeout = CONFIG.reconnectTimeout;

            logger.log(`Intentando reconectar (${this.reconnectAttempts}/${CONFIG.reconnectMaxAttempts}) en ${timeout / 1000} segundos...`);

            setTimeout(() => {
                this.connect();
            }, timeout);
        } else {
            logger.error('Número máximo de intentos de reconexión alcanzado.');
        }
    }
}

// Función principal
function main() {
    logger.log('=== Recky Print Agent iniciado ===');
    logger.log(`Sistema: ${os.platform()} ${os.release()}`);
    logger.log(`Directorio temporal: ${TMP_DIR}`);
    logger.log(`Servidor WebSocket: ${CONFIG.serverUrl}`);
    logger.log(`Clave de agente: ${CONFIG.agentKey}`);
    logger.log('El agente se autenticará automáticamente al conectar');

    const client = new WebSocketClient();
    client.connect();

    // Manejar señales de cierre
    process.on('SIGINT', () => {
        logger.log('Proceso interrumpido, cerrando...');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        logger.log('Proceso terminado, cerrando...');
        process.exit(0);
    });
}

// Iniciar agente
main();
