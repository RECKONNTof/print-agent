# Recky Print Agent

Agente de impresión local para el sistema Recky que permite la impresión silenciosa de documentos desde el servidor mediante WebSocket, con soporte para impresoras térmicas ESC/POS incluyendo comandos de corte de papel y señales sonoras (beep).

## 📋 Características

- **Impresión silenciosa**: Impresión directa sin diálogos o intervención del usuario
- **WebSocket**: Conexión persistente con el servidor Recky mediante WebSocket
- **Autenticación automática**: El agente se autentica automáticamente al conectar
- **Sistema de ping/pong**: Mantiene la conexión activa y detecta desconexiones
- **Reconexión automática**: Intenta reconectar automáticamente en caso de pérdida de conexión
- **Soporte multi-impresora**: Configura diferentes impresoras según el trabajo
- **Comandos ESC/POS**: Envío de comandos nativos a impresoras térmicas
  - **Corte de papel**: Corte parcial o completo automático después de imprimir
  - **Señales sonoras (beep)**: Alertas audibles configurables por impresora
- **Registro de actividad**: Sistema de logs detallado para auditoría y depuración
- **Multi-plataforma**: Compatible con Windows, macOS y Linux

## 🔧 Requisitos

### Todos los sistemas operativos
- **Node.js** 14.0 o superior
- **npm** (para instalar dependencias)

### Windows
- **SumatraPDF** (para impresión de documentos PDF)
  - Descarga: https://www.sumatrapdfreader.org/download-free-pdf-viewer
- **PowerShell** 5.1 o superior (incluido en Windows 10/11)

### macOS
- Comando `lpr` (incluido por defecto)

### Linux
- Comando `lp` (incluido en la mayoría de distribuciones)

## 📦 Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   git clone <url-del-repositorio>
   cd print-agent-main
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar el agente** (ver sección Configuración)

## ⚙️ Configuración

Edita el archivo `settings.js` para configurar el agente según tus necesidades:

### Configuración básica

```javascript
module.exports = {
    // URL del servidor WebSocket de Recky
    serverUrl: "wss://ws.reckonnt.net:9090/ws",
    
    // Clave de autenticación del agente (proporcionada por el servidor)
    agentKey: "tu-clave-de-agente-aqui",
    
    // Archivo de registro de actividad
    logFile: "./recky-print-agent.log",
    
    // Configuración de reconexión
    reconnectTimeout: 5000,        // Tiempo entre intentos (ms)
    reconnectMaxAttempts: 10,      // Número máximo de intentos
    
    // Configuración de archivos temporales
    tempDir: null,                 // null = usar directorio del sistema
    tempFileCleanupDelay: 3000,    // Tiempo antes de eliminar archivos (ms)
    
    // Ruta al ejecutable de SumatraPDF (solo Windows)
    sumatraPath: "C:\\ruta\\a\\SumatraPDF.exe",
    
    // Impresora predeterminada
    defaultPrinter: "CAJA"
};
```

### Configuración avanzada: Corte de papel

```javascript
cut: {
    enabled: true,                // Activar/desactivar corte global
    defaultMode: "partial",       // "partial" (ESC m) o "full" (ESC i)
    delayMs: 3000,                // Delay antes de enviar el corte (ms)
    feedLines: 3,                 // Líneas de avance antes del corte
    
    // Configuración por impresora específica
    perPrinter: {
        "CAJA": {
            enabled: true,
            mode: "partial",
            delayMs: 1000,
            feedLines: 3
        },
        "COCINA": {
            enabled: true,
            mode: "full",
            delayMs: 2000,
            feedLines: 5
        }
    }
}
```

**Modos de corte disponibles:**
- `partial`: Corte parcial (ESC m) - el papel queda con una pequeña unión
- `full`: Corte completo (ESC i) - el papel se separa completamente
- `gs0`: Corte alternativo (GS V 0) - para impresoras con firmware específico

### Configuración avanzada: Señales sonoras (Beep)

```javascript
beep: {
    enabled: true,                // Activar/desactivar beep global
    count: 4,                     // Número de pitidos
    duration: 6,                  // Duración de cada pitido (~0.6s)
    delayMs: 500,                 // Delay antes de enviar el beep (ms)
    
    // Configuración por impresora específica
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
            enabled: false,       // Deshabilitar beep en cocina
            count: 2,
            duration: 4
        }
    }
}
```

## 🚀 Uso

### Ejecución manual

```bash
npm start
```

O directamente:

```bash
node recky-print-agent.js
```

### Probar comandos ESC/POS

El proyecto incluye scripts de prueba para comandos ESC/POS:

**Probar corte de papel:**
```powershell
.\send-cut.ps1 -PrinterName "CAJA" -Mode "partial" -Feed 3
```

**Probar señal sonora:**
```powershell
.\send-beep.ps1 -PrinterName "CAJA" -Count 4 -Duration 6
```

**Scripts de prueba completos:**
```powershell
# Prueba de corte con texto visible
.\escpos-cut-tester.ps1

# Prueba de beep con texto visible
.\escpos-beep-tester.ps1
```

## 🔄 Configurar como servicio

### Windows (usando NSSM)

1. **Descargar NSSM** (Non-Sucking Service Manager)
   - https://nssm.cc/download

2. **Instalar el servicio**
   ```powershell
   nssm install ReckyPrintAgent "C:\Program Files\nodejs\node.exe" "C:\ruta\al\recky-print-agent.js"
   nssm set ReckyPrintAgent AppDirectory "C:\ruta\al\proyecto"
   nssm set ReckyPrintAgent DisplayName "Recky Print Agent"
   nssm set ReckyPrintAgent Description "Agente de impresión para sistema Recky"
   nssm set ReckyPrintAgent Start SERVICE_AUTO_START
   ```

3. **Iniciar el servicio**
   ```powershell
   nssm start ReckyPrintAgent
   ```

4. **Gestionar el servicio**
   ```powershell
   # Ver estado
   nssm status ReckyPrintAgent
   
   # Detener
   nssm stop ReckyPrintAgent
   
   # Reiniciar
   nssm restart ReckyPrintAgent
   
   # Desinstalar
   nssm remove ReckyPrintAgent confirm
   ```

### Linux (systemd)

1. **Crear el archivo de servicio**
   ```bash
   sudo nano /etc/systemd/system/recky-print-agent.service
   ```

2. **Agregar la configuración**
   ```ini
   [Unit]
   Description=Recky Print Agent
   After=network.target
   
   [Service]
   Type=simple
   User=tu-usuario
   WorkingDirectory=/ruta/al/proyecto
   ExecStart=/usr/bin/node /ruta/al/proyecto/recky-print-agent.js
   Restart=always
   RestartSec=10
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=recky-print-agent
   
   [Install]
   WantedBy=multi-user.target
   ```

3. **Habilitar e iniciar el servicio**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable recky-print-agent
   sudo systemctl start recky-print-agent
   ```

4. **Gestionar el servicio**
   ```bash
   # Ver estado
   sudo systemctl status recky-print-agent
   
   # Ver logs
   sudo journalctl -u recky-print-agent -f
   
   # Reiniciar
   sudo systemctl restart recky-print-agent
   
   # Detener
   sudo systemctl stop recky-print-agent
   ```

### macOS (launchd)

1. **Crear el archivo plist**
   ```bash
   nano ~/Library/LaunchAgents/com.recky.printagent.plist
   ```

2. **Agregar la configuración**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.recky.printagent</string>
       <key>ProgramArguments</key>
       <array>
           <string>/usr/local/bin/node</string>
           <string>/ruta/al/proyecto/recky-print-agent.js</string>
       </array>
       <key>WorkingDirectory</key>
       <string>/ruta/al/proyecto</string>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
       <key>StandardOutPath</key>
       <string>/tmp/recky-print-agent.log</string>
       <key>StandardErrorPath</key>
       <string>/tmp/recky-print-agent-error.log</string>
   </dict>
   </plist>
   ```

3. **Cargar y gestionar el servicio**
   ```bash
   # Cargar
   launchctl load ~/Library/LaunchAgents/com.recky.printagent.plist
   
   # Descargar
   launchctl unload ~/Library/LaunchAgents/com.recky.printagent.plist
   
   # Ver logs
   tail -f /tmp/recky-print-agent.log
   ```

## 📊 Logs y monitoreo

El agente registra toda su actividad en el archivo especificado en `settings.js` (por defecto `recky-print-agent.log`).

**Información registrada:**
- Conexiones y desconexiones al servidor
- Intentos de reconexión
- Trabajos de impresión recibidos y procesados
- Comandos ESC/POS enviados (corte y beep)
- Errores y excepciones

**Ver logs en tiempo real:**

Windows (PowerShell):
```powershell
Get-Content .\recky-print-agent.log -Wait -Tail 50
```

Linux/macOS:
```bash
tail -f recky-print-agent.log
```

## 🔍 Solución de problemas

### El agente no se conecta al servidor
- Verifica que la URL del servidor WebSocket sea correcta en `settings.js`
- Comprueba que la `agentKey` sea válida
- Verifica la conexión a internet y que el puerto no esté bloqueado por firewall

### La impresión no funciona (Windows)
- Verifica que la ruta a SumatraPDF sea correcta en `settings.js`
- Comprueba que el nombre de la impresora sea exacto (sensible a mayúsculas)
- Prueba imprimir un documento manualmente desde SumatraPDF

### El corte de papel no funciona
- Verifica que tu impresora sea compatible con comandos ESC/POS
- Prueba con diferentes modos: `partial`, `full`, o `gs0`
- Aumenta el `delayMs` si el corte ocurre antes de que termine la impresión
- Revisa los logs para ver si hay errores al enviar el comando

### El beep no suena
- Asegúrate de que tu impresora tenga buzzer integrado
- Verifica que el beep esté habilitado en la configuración
- Prueba con diferentes valores de `duration` y `count`
- Algunas impresoras no soportan el comando ESC B para beep

### Los archivos temporales no se eliminan
- Aumenta el `tempFileCleanupDelay` en `settings.js`
- Verifica los permisos del directorio temporal
- Revisa los logs para ver si hay errores de eliminación

## 📁 Estructura del proyecto

```
print-agent-main/
├── recky-print-agent.js       # Archivo principal del agente
├── settings.js                 # Configuración del agente
├── package.json                # Dependencias y scripts npm
├── send-cut.ps1               # Script PowerShell para corte de papel
├── send-beep.ps1              # Script PowerShell para señales sonoras
├── escpos-cut-tester.ps1      # Script de prueba para corte
├── escpos-beep-tester.ps1     # Script de prueba para beep
├── log.txt                     # Log de actividad (generado)
├── recky-print-agent.log      # Log del agente (generado)
└── README.md                   # Este archivo
```

## 🔐 Seguridad

- Mantén tu `agentKey` en secreto y no la compartas
- Usa conexiones WebSocket seguras (WSS) en producción
- Limita el acceso al archivo `settings.js` con permisos apropiados
- Revisa regularmente los logs para detectar actividad sospechosa

## 📄 Licencia

Este proyecto es de uso interno para el sistema Recky.

## 🤝 Soporte

Para soporte técnico o reportar problemas, contacta con el equipo de desarrollo de Recky.
