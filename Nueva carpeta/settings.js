/**
 * Configuracion del Agente de Impresion Recky
 * 
 * Este archivo contiene la configuracion necesaria para el funcionamiento
 * del agente de impresion Recky. Modifique según sus necesidades.
 */

module.exports = {    // URL del servidor WebSocket
    serverUrl: "wss://ws.reckonnt.net:9090/ws",

    // Clave de autenticacion del agente
    agentKey: "LE4piAQl4MICHIedQUGvekkCyJAUPu3eT3jHELgvhil1n5HifuBfTZqjq3aFeMz4",
    // agentKey: "izC3Wc4rb2u84mfiDtpLxN3NOJSMivTVOSikdpVTLGPQm1FuJtfpVeKvil4hVd3w",

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
        enabled: true,            // activar/desactivar corte global
        defaultMode: "partial",   // "partial" = ESC m, "full" = ESC i
        delayMs: 1200,            // espera tras imprimir antes de cortar (ms)
        perPrinter: {
            // Ejemplo: desactivar corte para la Epson
            "EPSON L395 Series": {
                enabled: false
            }
        }
    }
};
