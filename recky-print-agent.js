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
const { execSync, spawn } = require('child_process');

// (Funcionalidad de corte eliminada)

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
    cut: {
        enabled: userConfig?.cut?.enabled ?? false,
        defaultMode: userConfig?.cut?.defaultMode || 'partial',
        delayMs: userConfig?.cut?.delayMs ?? 1200,
        perPrinter: userConfig?.cut?.perPrinter || {}
    }
};

// Directorio temporal para archivos
const TMP_DIR = userConfig.tempDir || path.join(os.tmpdir(), 'recky-print');

// Ruta del script de corte
const CUT_PS1 = path.join(__dirname, 'send-cut.ps1');

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

// Config efectiva por impresora
function getCutConfigFor(printerName) {
    const base = CONFIG.cut || {};
    const per = (base.perPrinter || {})[printerName] || {};
    return {
        enabled: per.enabled ?? base.enabled ?? false,
        mode: per.mode ?? base.defaultMode ?? 'partial',
        delayMs: per.delayMs ?? base.delayMs ?? 1000
    };
}

// Ejecuta corte invocando PowerShell (RAW al spooler Windows)
function sendCut(printerName, { mode = 'partial', text = '', feed = 0 } = {}) {
    return new Promise((resolve, reject) => {
        if (os.platform() !== 'win32') return resolve(false); // no-op en macOS/Linux

        const args = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', CUT_PS1,
            '-PrinterName', printerName,
            '-CutMode', mode
        ];
        if (text) args.push('-Text', text);
        if (feed) args.push('-Feed', String(feed));

        const ps = spawn('powershell.exe', args, { windowsHide: true });
        let stderr = '';

        ps.stdout.on('data', d => logger.log(`CUT OUT: ${d.toString().trim()}`));
        ps.stderr.on('data', d => { stderr += d.toString(); });
        ps.on('close', code => {
            if (code === 0) return resolve(true);
            logger.error(`Corte falló (code=${code}): ${stderr.trim()}`);
            reject(new Error(stderr.trim() || `cut exited ${code}`));
        });
    });
}
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

        // Lógica de corte
        // === Corte basado SOLO en configuración (sin instrucciones del servidor) ===
        try {
            const { enabled, mode, delayMs } = getCutConfigFor(printerName || CONFIG.defaultPrinter || '');
            if (enabled && printerName) {
                logger.log(`Agendando corte (${mode}) en ${delayMs}ms para impresora ${printerName}`);
                await new Promise(r => setTimeout(r, delayMs));
                await sendCut(printerName, { mode, feed: 0 }); // puedes ajustar "feed" si deseas líneas extra
                logger.log(`Corte enviado a ${printerName}`);
            } else {
                logger.log(`Corte omitido: enabled=${enabled}, printer=${printerName || 'N/A'}`);
            }
        } catch (cutErr) {
            logger.error(`Error durante corte: ${cutErr.message}`);
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
                        connectionName: "silentPrint"
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

    forceCloseConnection() {
        logger.log('Forzando cierre de conexión debido a timeout de ping');
        this.stopPing();
        if (this.ws) {
            this.ws.close(1000, 'Ping timeout');
        }
        this.isConnected = false;
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

    // (Información de corte eliminada)

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
