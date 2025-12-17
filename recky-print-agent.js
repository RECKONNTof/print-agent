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
} catch (error) {
    console.warn(`No se pudo cargar el archivo settings: ${error.message}`);
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
        delayMs: userConfig?.cut?.delayMs ?? 3000,
        feedLines: userConfig?.cut?.feedLines ?? 3,
        perPrinter: userConfig?.cut?.perPrinter || {}
    },
    beep: {
        enabled: userConfig?.beep?.enabled ?? false,
        count: userConfig?.beep?.count ?? 4,
        duration: userConfig?.beep?.duration ?? 6,
        delayMs: userConfig?.beep?.delayMs ?? 500,
        perPrinter: userConfig?.beep?.perPrinter || {}
    }
};

// Directorio temporal para archivos
const TMP_DIR = userConfig.tempDir || path.join(os.tmpdir(), 'recky-print');

// Ruta de los scripts PowerShell
const CUT_PS1 = path.join(__dirname, 'send-cut.ps1');
const BEEP_PS1 = path.join(__dirname, 'send-beep.ps1');

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

// Config efectiva por impresora - CORTE
function getCutConfigFor(printerName) {
    const base = CONFIG.cut || {};
    const per = (base.perPrinter || {})[printerName] || {};
    return {
        enabled: per.enabled ?? base.enabled ?? false,
        mode: per.mode ?? base.defaultMode ?? 'partial',
        delayMs: per.delayMs ?? base.delayMs ?? 1000,
        feedLines: per.feedLines ?? base.feedLines ?? 3
    };
}

// Config efectiva por impresora - BEEP
function getBeepConfigFor(printerName) {
    const base = CONFIG.beep || {};
    const per = (base.perPrinter || {})[printerName] || {};
    return {
        enabled: per.enabled ?? base.enabled ?? false,
        count: per.count ?? base.count ?? 4,
        duration: per.duration ?? base.duration ?? 6,
        delayMs: per.delayMs ?? base.delayMs ?? 500
    };
}

// Ejecuta corte invocando PowerShell (RAW al spooler Windows)
function sendCut(printerName, { mode = 'partial', text = '', feed = 2 } = {}) {
    return new Promise((resolve, reject) => {
        if (os.platform() !== 'win32') return resolve(false);

        const args = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', CUT_PS1,
            '-PrinterName', printerName,
            '-Mode', mode,
            '-Feed', String(feed)
        ];
        if (text) args.push('-Text', text); // para pruebas; en prod puedes omitir

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

// Ejecuta beep invocando PowerShell (RAW al spooler Windows)
function sendBeep(printerName, { count = 4, duration = 6, text = '' } = {}) {
    return new Promise((resolve, reject) => {
        if (os.platform() !== 'win32') return resolve(false);

        const args = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', BEEP_PS1,
            '-PrinterName', printerName,
            '-Count', String(count),
            '-Duration', String(duration)
        ];
        if (text) args.push('-Text', text); // para pruebas; en prod puedes omitir

        const ps = spawn('powershell.exe', args, { windowsHide: true });
        let stderr = '';
        ps.stdout.on('data', d => logger.log(`BEEP OUT: ${d.toString().trim()}`));
        ps.stderr.on('data', d => { stderr += d.toString(); });
        ps.on('close', code => {
            if (code === 0) return resolve(true);
            logger.error(`Beep falló (code=${code}): ${stderr.trim()}`);
            reject(new Error(stderr.trim() || `beep exited ${code}`));
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

// Sistema de cola FIFO para trabajos de impresión
class PrintQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.stats = {
            total: 0,
            processed: 0,
            failed: 0,
            inQueue: 0
        };
    }

    // Agregar trabajo a la cola
    enqueue(job) {
        this.queue.push({
            id: job.jobId || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: job,
            timestamp: Date.now()
        });
        this.stats.total++;
        this.stats.inQueue = this.queue.length;
        logger.log(`Trabajo agregado a la cola. Total en cola: ${this.queue.length}`);

        // Si no se está procesando, iniciar el procesamiento
        if (!this.isProcessing) {
            this.processNext();
        }
    }

    // Procesar el siguiente trabajo en la cola
    async processNext() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            logger.log('Cola de impresión vacía, esperando nuevos trabajos');
            return;
        }

        this.isProcessing = true;
        const job = this.queue.shift();
        this.stats.inQueue = this.queue.length;

        logger.log(`Procesando trabajo ${job.id} (${this.queue.length} restantes en cola)`);

        try {
            const result = await processPrintJob(job.data);

            if (result.success) {
                this.stats.processed++;
                logger.log(`Trabajo ${job.id} completado exitosamente`);
            } else {
                this.stats.failed++;
                logger.error(`Trabajo ${job.id} falló: ${result.error}`);
            }

        } catch (error) {
            this.stats.failed++;
            logger.error(`Error procesando trabajo ${job.id}: ${error.message}`);
        }

        // Pequeño delay entre trabajos para evitar saturar la impresora
        setTimeout(() => {
            this.processNext();
        }, 500);
    }

    // Obtener estadísticas de la cola
    getStats() {
        return {
            ...this.stats,
            isProcessing: this.isProcessing,
            queueLength: this.queue.length
        };
    }

    // Limpiar la cola (opcional, para casos de emergencia)
    clear() {
        const cleared = this.queue.length;
        this.queue = [];
        this.stats.inQueue = 0;
        logger.log(`Cola limpiada. ${cleared} trabajos descartados`);
    }
}

// Instanciar la cola de impresión global
const printQueue = new PrintQueue();

// Procesar trabajo de impresión
async function processPrintJob(data) {
    try {
        const { file, filename, destino, contentType, jobId, idUsuario } = data;

        logger.log(`Procesando trabajo de impresión ${jobId || ''} para impresora ${destino || 'predeterminada'}`);

        logger.log(`Imprimiendo archivo ${filename || ''}`);

        // Guardar archivo en disco temporal
        const tempFilePath = path.join(TMP_DIR, filename);

        // Decodificar contenido base64 y guardar
        const fileBuffer = Buffer.from(file, 'base64');
        fs.writeFileSync(tempFilePath, fileBuffer);

        const printerName = (destino && destino.trim() !== '') ? destino : CONFIG.defaultPrinter;

        // Imprimir
        printFile(tempFilePath, printerName);

        // Lógica de beep (ANTES del corte, con menor delay)
        try {
            const { enabled: beepEnabled, count, duration, delayMs: beepDelay } =
                getBeepConfigFor(printerName || CONFIG.defaultPrinter || '');

            if (beepEnabled && printerName) {
                await new Promise(r => setTimeout(r, beepDelay));
                await sendBeep(printerName, { count, duration, text: '' });
                logger.log(`Beep enviado: ${count} pitidos de ${duration} * 0.1s cada uno`);
            } else {
                logger.log(`Beep omitido: enabled=${beepEnabled}, printer=${printerName || 'N/A'}`);
            }
        } catch (beepErr) {
            logger.error(`Error durante beep: ${beepErr.message}`);
        }

        // Lógica de corte
        // === Corte basado SOLO en configuración (sin instrucciones del servidor) ===
        try {
            const { enabled, mode, delayMs, feedLines } =
                getCutConfigFor(printerName || CONFIG.defaultPrinter || '');

            if (enabled && printerName) {
                await new Promise(r => setTimeout(r, delayMs));
                await sendCut(printerName, { mode, feed: feedLines, text: '' }); // text vacío en prod
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

            // Manejar evento ping nativo del WebSocket
            this.ws.on('ping', (data) => {
                logger.log('Ping recibido del servidor');
                // El pong se envía automáticamente por ws, pero lo registramos
            });

            // Manejar evento pong nativo del WebSocket
            this.ws.on('pong', (data) => {
                logger.log('Pong recibido del servidor - conexión confirmada como activa');
                // Limpiar el timeout del ping y resetear el flag
                if (this.pingTimeout) {
                    clearTimeout(this.pingTimeout);
                    this.pingTimeout = null;
                }
                this.waitingForPong = false;
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
    }

    startPing() {
        // Limpiar cualquier interval previo
        this.stopPing();

        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws) {
                // Si ya estamos esperando un pong, no enviar otro ping
                if (this.waitingForPong) {
                    logger.error('Timeout: No se recibió pong del ping anterior, cerrando conexión');
                    this.forceCloseConnection();
                    return;
                }
                this.waitingForPong = true;

                // Configurar timeout de 15 segundos para esperar el pong
                this.pingTimeout = setTimeout(() => {
                    if (this.waitingForPong) {
                        logger.error('Timeout de 15 segundos: No se recibió respuesta pong del servidor, cerrando conexión');
                        this.forceCloseConnection();
                    }
                }, 15000); // 15 segundos

                // Enviar ping nativo del WebSocket
                logger.log('Enviando ping al servidor');
                this.ws.ping();
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

            logger.log("Accion recibida: ", action);

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

                    // Agregar trabajo a la cola en lugar de procesarlo directamente
                    printQueue.enqueue(payload);

                    break;

                case 'getQueueStats':
                    // Enviar estadísticas de la cola al servidor
                    const stats = printQueue.getStats();
                    logger.log(`Estadísticas solicitadas: ${JSON.stringify(stats)}`);
                    this.send({
                        action: 'queueStats',
                        payload: stats
                    });
                    break;

                case 'clearQueue':
                    // Limpiar la cola (solo si es autorizado)
                    logger.log('Solicitud de limpieza de cola recibida');
                    printQueue.clear();
                    this.send({
                        action: 'queueCleared',
                        payload: { success: true, message: 'Cola limpiada correctamente' }
                    });
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
    logger.log('Sistema de cola de impresión FIFO activado');

    // (Información de corte eliminada)

    logger.log('El agente se autenticará automáticamente al conectar');

    const client = new WebSocketClient();
    client.connect();

    // Reportar estadísticas de cola cada 30 segundos en consola
    setInterval(() => {
        const stats = printQueue.getStats();
        if (stats.total > 0 || stats.inQueue > 0) {
            logger.log(`Cola: ${stats.inQueue} pendientes | ${stats.processed} completados | ${stats.failed} fallidos | ${stats.total} totales`);
        }
    }, 30000);

    // Manejar señales de cierre
    process.on('SIGINT', () => {
        logger.log('Proceso interrumpido, cerrando...');
        logger.log(`Estadísticas finales: ${JSON.stringify(printQueue.getStats())}`);
        client.stopPing();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        logger.log('Proceso terminado, cerrando...');
        logger.log(`Estadísticas finales: ${JSON.stringify(printQueue.getStats())}`);
        client.stopPing();
        process.exit(0);
    });
}

// Iniciar agente
main();
