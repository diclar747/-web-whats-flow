# 🚀 Sistema de Auto-Deployment - WhatsFlow

## ✅ Sistema Instalado

Se ha configurado un sistema completo de auto-deployment para WhatsFlow que permite:
- 🔄 Deployment automático cuando haces push a GitHub
- 🖱️ Deployment manual desde el panel de admin
- 📝 Registro de todos los deployments
- 🎯 Solo deployar en ramas específicas (main, master, claude/*)

---

## 📂 Archivos Creados

### 1. `/deploy.sh`
Script bash que ejecuta el deployment completo:
- ✅ `git pull` - Actualiza el código
- ✅ `npm install` - Solo si cambia package.json
- ✅ `npm run build` - Solo si cambia el frontend
- ✅ `pm2 restart` - Reinicia el servidor
- ✅ Log de deployments en `deployment.log`

### 2. Endpoints en el servidor:
- `POST /api/deploy/webhook` - Recibe webhooks de GitHub
- `POST /api/deploy/manual` - Deployment manual (requiere auth admin)

---

## 🔧 Configuración en GitHub (Paso a Paso)

### Paso 1: Ir a Settings del Repositorio
1. Abre tu repositorio en GitHub: https://github.com/diclar747/-web-whats-flow
2. Ve a **Settings** (configuración) del repositorio
3. En el menú lateral, busca **Webhooks**
4. Haz clic en **Add webhook**

### Paso 2: Configurar el Webhook
Completa los siguientes campos:

| Campo | Valor |
|-------|-------|
| **Payload URL** | `https://TU-DOMINIO.com/api/deploy/webhook` |
| **Content type** | `application/json` |
| **Secret** | (Dejar vacío por ahora, opcional) |
| **SSL verification** | Enable SSL verification |
| **Which events would you like to trigger this webhook?** | Just the push event |
| **Active** | ✅ Activado |

**⚠️ IMPORTANTE:** Reemplaza `TU-DOMINIO.com` con tu dominio o IP real de producción.

Ejemplos:
- `https://whatsflow.com/api/deploy/webhook`
- `https://api.miempresa.com/api/deploy/webhook`
- `http://123.45.67.89:3003/api/deploy/webhook` (solo si no tienes HTTPS)

### Paso 3: Guardar
1. Haz clic en **Add webhook**
2. GitHub te mostrará el webhook recién creado
3. Puedes ver el historial de entregas en la pestaña "Recent Deliveries"

---

## 🚀 Cómo Usar

### Método 1: Automático (Recomendado)
```bash
# 1. Haz cambios en tu código
git add .
git commit -m "Tu mensaje de commit"

# 2. Push a GitHub (se desplegará automáticamente)
git push origin claude/initial-setup-7IZiU
```

✅ **El servidor recibirá el webhook y se actualizará automáticamente**

---

### Método 2: Manual desde el Servidor
```bash
# Ejecutar en tu servidor de producción vía SSH
cd /home/user/-web-whats-flow
bash deploy.sh
```

---

### Método 3: Manual desde el Panel Admin (Próximamente)
Puedes agregar un botón en el panel de admin que llame a:
```javascript
fetch('/api/deploy/manual', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

---

## 🔍 Verificar Deployment

### Ver logs del deployment:
```bash
# En tu servidor de producción
tail -f /tmp/deployment.log
```

### Ver historial de deployments:
```bash
# En el directorio del proyecto
cat deployment.log
```

### Ver logs del servidor:
```bash
pm2 logs whatsflow-server
```

---

## 🛡️ Seguridad (Opcional pero Recomendado)

Para mayor seguridad, puedes agregar un **secret** al webhook:

### 1. Generar un secret:
```bash
openssl rand -hex 32
```

### 2. Agregar el secret en GitHub Webhook:
- Copia el secret generado
- Pégalo en el campo "Secret" del webhook en GitHub

### 3. Modificar el endpoint para validar el secret:
Edita `/src/server/index.js` y agrega validación de signature en el endpoint `/api/deploy/webhook`.

---

## 📊 Monitoreo

### Ver estado del servidor:
```bash
pm2 status
```

### Ver logs en tiempo real:
```bash
pm2 logs whatsflow-server --lines 100
```

### Ver métricas:
```bash
pm2 monit
```

---

## ⚡ Deployment Inmediato (Primera Vez)

Para ver los cambios de avatar **AHORA MISMO** en producción:

1. **Conecta a tu servidor de producción vía SSH:**
```bash
ssh usuario@tu-servidor.com
```

2. **Navega al directorio del proyecto:**
```bash
cd /home/user/-web-whats-flow
```

3. **Ejecuta el deployment:**
```bash
bash deploy.sh
```

4. **Si PM2 no está instalado, instálalo:**
```bash
npm install -g pm2
```

5. **Inicia el servidor con PM2:**
```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## 🎯 Resultado

Ahora cada vez que hagas:
```bash
git push origin claude/initial-setup-7IZiU
```

Tu servidor de producción:
1. ✅ Recibirá una notificación de GitHub
2. ✅ Ejecutará `git pull` automáticamente
3. ✅ Instalará dependencias si es necesario
4. ✅ Rebuildeará el frontend si es necesario
5. ✅ Reiniciará el servidor con PM2
6. ✅ Todo sin intervención manual

---

## 📝 Notas Importantes

- El webhook solo se activa en ramas: `main`, `master`, o que empiecen con `claude/`
- Los logs se guardan en `/tmp/deployment.log` y `deployment.log`
- El deployment se ejecuta en background para no bloquear el webhook
- Si el deployment falla, revisa los logs en `/tmp/deployment.log`

---

## 🐛 Troubleshooting

### El webhook no se ejecuta:
1. Verifica que la URL del webhook sea correcta
2. Revisa "Recent Deliveries" en GitHub para ver errores
3. Asegúrate de que el puerto esté abierto en el firewall

### PM2 no reinicia:
```bash
# Verificar que PM2 esté corriendo
pm2 list

# Si no está, iniciarlo
pm2 start ecosystem.config.js

# Guardar la configuración
pm2 save

# Configurar inicio automático
pm2 startup
```

### Git pull falla:
```bash
# Verificar estado de git
git status

# Si hay conflictos, hacer stash
git stash
git pull
git stash pop
```

---

## ✅ Cambios Desplegados Hoy

- ✅ Fix de avatares y nombres en transferencia de chats
- ✅ Sistema de auto-deployment con webhooks
- ✅ Endpoints de deployment manual

Para ver estos cambios en producción, ejecuta:
```bash
ssh tu-servidor
cd /home/user/-web-whats-flow
bash deploy.sh
```
