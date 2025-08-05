/**
 * Configuracion del Agente de Impresion Recky
 * 
 * Este archivo contiene la configuracion necesaria para el funcionamiento
 * del agente de impresion Recky. Modifique según sus necesidades.
 */

module.exports = {    // URL del servidor WebSocket
    serverUrl: "ws://localhost:9090/ws",

    // Clave de autenticacion del agente
    agentKey: "",

    // Configuracion del servidor HTTP local
    httpPort: 7001,              // Puerto para el servidor HTTP local

    // Configuracion de logs
    logFile: "./recky-print-agent.log",
    logLevel: "info",

    // Configuracion de conexion
    reconnectTimeout: 5000,      // Tiempo entre intentos de reconexion (ms)
    reconnectMaxAttempts: 100,   // Número máximo de intentos de reconexion

    // Configuracion avanzada
    tempDir: null,              // Directorio temporal para archivos (null = usar el predeterminado del sistema)
    tempFileCleanupDelay: 3000,  // Tiempo antes de eliminar archivos temporales (ms)

    // Configuracion de impresion
    sumatraPath: "C:\\Users\\Usuario\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe", // Ruta al ejecutable de SumatraPDF

    defaultPrinter: "EPSON L395 Series",        // Impresora predeterminada
};
