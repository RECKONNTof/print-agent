# Agente de Impresión Recky

Este es un agente de impresión ligero diseñado para trabajar con el sistema Recky. Permite la impresión silenciosa desde el servidor websocket de Recky.

## Características

- Sin interfaz gráfica
- Impresión directa desde base64
- Compatible con Windows, macOS y Linux
- Reconexión automática al servidor
- Registro básico de actividades

## Requisitos

- Node.js 14.0 o superior
- npm (para instalar dependencias)

## Instalación

1. Descarga los archivos `recky-print-agent.js` y `settings.js`
2. Instala las dependencias necesarias:

```bash
npm install ws
```

## Configuración

Configura el agente mediante el archivo `settings.js`:

```javascript
module.exports = {
    // URL del servidor WebSocket
    serverUrl: "wss://your-recky-server.com/ws",
    
    // Clave de autenticación del agente
    agentKey: "your-agent-key",
    
    // Configuración de logs
    logFile: "./recky-print-agent.log",
    
    // Otros ajustes (opcionales)
    reconnectTimeout: 5000,
    reconnectMaxAttempts: 100,
    tempDir: null,  // null = usar directorio temporal del sistema
    tempFileCleanupDelay: 3000
};
```

## Uso básico

```bash
# Editar settings.js con la configuración adecuada
# Ejecutar el agente
node recky-print-agent.js
```

## Configurar como servicio

### Windows (usando nssm)

```powershell
# Instalar nssm si no está instalado
# Configurar el servicio
nssm install ReckyPrintAgent "node" "C:\path\to\recky-print-agent.js"
nssm set ReckyPrintAgent AppDirectory "C:\path\to"
nssm start ReckyPrintAgent
```

### Linux (systemd)

Crear el archivo `/etc/systemd/system/recky-print-agent.service`:

```
[Unit]
Description=Recky Print Agent
After=network.target

[Service]
ExecStart=/usr/bin/node /ruta/a/recky-print-agent.js
WorkingDirectory=/ruta/a/directorio
Restart=always
User=your-user

[Install]
WantedBy=multi-user.target
```

Luego:
```bash
sudo systemctl enable recky-print-agent
sudo systemctl start recky-print-agent
```

## Verificación de logs

Los logs se guardan en el archivo especificado o en `recky-print-agent.log` en el directorio de ejecución por defecto.
