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

    // Configuracion de impresoras (Reemplaza a SumatraPDF)
    // Puede ser USB o Network. Las USB pueden especificar vid y pid (opcional). Las de red requieren "ip" y "port".
    printers: {
        // "EPSON L395 Series": {
        //     type: "windows",
        //     name: "EPSON L395 Series", // El nombre exacto que aparece en "Windows Devices and Printers"
        //     beep: { enabled: true, count: 4, duration: 6 },
        //     cut: { enabled: true, mode: "partial" }
        // },
        "EPSON L395 Series": {
            type: "network",
            ip: "192.168.100.77",
            port: 9100,
            beep: { enabled: true, count: 3, duration: 5 },
            cut: { enabled: true, mode: "partial" }
        },
        "BARRA": {
            type: "network",
            ip: "192.168.1.50",
            port: 9100,
            beep: { enabled: true, count: 3, duration: 5 },
            cut: { enabled: true, mode: "partial" }
        },
        "COCINA": {
            type: "network",
            ip: "192.168.1.51",
            port: 9100,
            beep: { enabled: true, count: 2, duration: 4 },
            cut: { enabled: true, mode: "partial" }
        },
    },

    defaultPrinter: "EPSON L395 Series",        // Impresora predeterminada

    // (La configuración legacy de beep/cut perPrinter puede removerse o ignorarse en esta nueva versión, ya que ahora cada impresora en 'printers' tiene sus opciones directamente).

    // Configuracion de corte de papel
    cut: {
        enabled: false,            // activar/desactivar corte global
        defaultMode: "partial",   // "partial" = ESC m, "full" = ESC i
        delayMs: 3000,
        feedLines: 3,
        perPrinter: {
            "EPSON L395 Series": {
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
            "EPSON L395 Series": {
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
