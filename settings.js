/**
 * Configuracion del Agente de Impresion Recky
 * 
 * Este archivo contiene la configuracion necesaria para el funcionamiento
 * del agente de impresion Recky. Modifique según sus necesidades.
 */

module.exports = {    // URL del servidor WebSocket
    // serverUrl: "wss://ws.reckonnt.net:9090/ws",
    serverUrl: "ws://localhost:9090/ws",

    // Clave de autenticacion del agente
    // agentKey: "izC3Wc4rb2u84mfiDtpLxN3NOJSMivTVOSikdpVTLGPQm1FuJtfpVeKvil4hVd3w",
    agentKey: "LE4piAQl4MICHIedQUGvekkCyJAUPu3eT3jHELgvhil1n5HifuBfTZqjq3aFeMz4",
    // agentKey: "DAQLqPmYvpZn3GzRWIV3gLdXJEej8WJTwlX2EOhLxBO9mU3gQTQBvk9e1gvTRoYC",

    // Configuracion de logs
    logFile: "./recky-print-agent.log",
    logLevel: "info",

    // Configuracion de conexion
    reconnectTimeout: 5000,      // Tiempo entre intentos de reconexion (ms)
    reconnectMaxAttempts: 10,   // Número máximo de intentos de reconexion

    // Configuracion avanzada
    tempDir: null,              // Directorio temporal para archivos (null = usar el predeterminado del sistema)
    tempFileCleanupDelay: 3000,  // Tiempo antes de eliminar archivos temporales (ms)

    // Configuracion de impresion
    sumatraPath: "C:\\Users\\Usuario\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe", // Ruta al ejecutable de SumatraPDF

    defaultPrinter: "EPSON L395 Series",        // Impresora predeterminada

    // Configuracion de corte de papel
    cut: {
        enabled: false,            // activar/desactivar corte global
        defaultMode: "partial",   // "partial" = ESC m, "full" = ESC i
        delayMs: 3000,
        feedLines: 3,
        perPrinter: {
            "CAJA": {
                enabled: true,
                mode: "partial",  // o "full"
                delayMs: 1000
            },
            "BARRA": {
                enabled: true,
                mode: "partial",  // o "full"
                delayMs: 1000
            },
            "COCINA": {
                enabled: true,
                mode: "partial",  // o "full"
                delayMs: 1000
            },
        }
    },

    // Configuracion de beep (sonido) de impresora
    beep: {
        enabled: false,              // activar/desactivar beep global
        count: 4,                   // número de pitidos (beeps)
        duration: 6,                // duración de cada beep (~0.6 segundos)
        delayMs: 500,               // delay antes de enviar el beep (ms)
        perPrinter: {
            "CAJA": {
                enabled: true,
                count: 4,
                duration: 6,
                delayMs: 500
            },
            "BARRA": {
                enabled: true,
                count: 3,
                duration: 5,
                delayMs: 500
            },
            "COCINA": {
                enabled: true,
                count: 2,
                duration: 4,
                delayMs: 500
            },
        }
    }
};
