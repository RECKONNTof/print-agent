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

// Importar módulo de comandos de corte ESC/POS (con manejo de errores)
let sendCutAfterPrint = null;
try {
    const cutModule = require('./cut-commands.js');
    sendCutAfterPrint = cutModule.sendCutAfterPrint;
} catch (error) {
    console.warn(`Advertencia: No se pudo cargar el módulo de comandos de corte: ${error.message}`);
    console.warn('El corte automático no estará disponible');
}

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
    enableAutoCut: userConfig.enableAutoCut !== undefined ? userConfig.enableAutoCut : false,
    usePartialCut: userConfig.usePartialCut !== undefined ? userConfig.usePartialCut : false,
    cutDelay: userConfig.cutDelay || 2000
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

        // NUEVO: Enviar comando de corte automático después de la impresión
        if (CONFIG.enableAutoCut && printerName && sendCutAfterPrint) {
            logger.log('Iniciando proceso de corte automático...');

            try {
                // Esperar un poco para que termine la impresión antes del corte
                const cutDelay = CONFIG.cutDelay || 2000;
                logger.log(`Esperando ${cutDelay}ms antes del corte...`);

                setTimeout(async () => {
                    try {
                        const usePartialCut = CONFIG.usePartialCut || false;
                        const cutType = usePartialCut ? 'parcial' : 'completo';

                        logger.log(`Enviando comando de corte ${cutType} a impresora: ${printerName}`);

                        const cutResult = await sendCutAfterPrint(printerName, usePartialCut);

                        if (cutResult.success) {
                            logger.log(`Comando de corte ${cutType} enviado exitosamente`);
                        } else {
                            logger.error(`Error en comando de corte: ${cutResult.error}`);
                        }
                    } catch (cutError) {
                        logger.error(`Error al enviar comando de corte: ${cutError.message}`);
                    }
                }, cutDelay);

            } catch (error) {
                logger.error(`Error en configuración de corte automático: ${error.message}`);
            }
        } else if (CONFIG.enableAutoCut && !printerName) {
            logger.log('Corte automático habilitado pero no se especificó impresora');
        } else if (CONFIG.enableAutoCut && !sendCutAfterPrint) {
            logger.error('Corte automático habilitado pero módulo de comandos no disponible');
        }

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
        this.pingInterval = null;
        this.pingTimeout = null;
        this.waitingForPong = false;
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

                // Iniciar el mecanismo de ping para mantener la conexión viva
                this.startPing();
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
                this.stopPing();
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

    startPing() {
        // Limpiar cualquier interval previo
        this.stopPing();

        logger.log('Iniciando sistema de ping para mantener conexión viva (cada 60 segundos)');

        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws) {
                // Si ya estamos esperando un pong, no enviar otro ping
                if (this.waitingForPong) {
                    logger.error('Timeout: No se recibió pong del ping anterior, cerrando conexión');
                    this.forceCloseConnection();
                    return;
                }

                logger.log('Enviando ping al servidor para mantener conexión viva');
                this.waitingForPong = true;

                // Configurar timeout de 15 segundos para esperar el pong
                this.pingTimeout = setTimeout(() => {
                    if (this.waitingForPong) {
                        logger.error('Timeout de 15 segundos: No se recibió respuesta pong del servidor, cerrando conexión');
                        this.forceCloseConnection();
                    }
                }, 15000); // 15 segundos

                this.send({
                    action: 'ping',
                    payload: {
                        timestamp: Date.now(),
                        agentName: "silentPrint"
                    }
                });
            }
        }, 60000); // 60 segundos = 1 minuto
    }

    stopPing() {
        if (this.pingInterval) {
            logger.log('Deteniendo sistema de ping');
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }

        this.waitingForPong = false;
    }

    // forceCloseConnection() {
    //     logger.log('Forzando cierre de conexión debido a timeout de ping');
    //     this.stopPing();
    //     if (this.ws) {
    //         this.ws.close(1000, 'Ping timeout');
    //     }
    //     this.isConnected = false;
    // }

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

                case 'pong':
                    logger.log('Pong recibido del servidor - conexión confirmada como activa');
                    // Limpiar el timeout del ping y resetear el flag
                    if (this.pingTimeout) {
                        clearTimeout(this.pingTimeout);
                        this.pingTimeout = null;
                    }
                    this.waitingForPong = false;
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
    logger.log(`Impresora predeterminada: ${CONFIG.defaultPrinter || 'No configurada'}`);

    // Información sobre configuración de corte automático
    if (CONFIG.enableAutoCut) {
        const cutType = CONFIG.usePartialCut ? 'parcial' : 'completo';
        logger.log(`Corte automático HABILITADO - Tipo: ${cutType}, Retraso: ${CONFIG.cutDelay || 2000}ms`);

        if (!sendCutAfterPrint) {
            logger.error('ADVERTENCIA: Módulo de comandos de corte no disponible');
            logger.error('Verifique que existe el archivo cut-commands.js');
        } else {
            // Verificar que existen los archivos de comandos de corte
            try {
                const cutBinPath = path.join(__dirname, 'cut.bin');
                const cutPartialBinPath = path.join(__dirname, 'cut-partial.bin');

                if (fs.existsSync(cutBinPath) || fs.existsSync(cutPartialBinPath)) {
                    logger.log('Archivos de comandos de corte encontrados');
                } else {
                    logger.error('ADVERTENCIA: Archivos de comandos de corte no encontrados');
                    logger.error('Ejecute: node generate-cut-bin.js');
                }
            } catch (error) {
                logger.error(`Error al verificar archivos de corte: ${error.message}`);
            }
        }
    } else {
        logger.log('Corte automático DESHABILITADO');
    }

    logger.log('El agente se autenticará automáticamente al conectar');

    const client = new WebSocketClient();
    client.connect();

    // Manejar señales de cierre
    process.on('SIGINT', () => {
        logger.log('Proceso interrumpido, cerrando...');
        client.stopPing();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        logger.log('Proceso terminado, cerrando...');
        client.stopPing();
        process.exit(0);
    });
}

// Iniciar agente
main();
