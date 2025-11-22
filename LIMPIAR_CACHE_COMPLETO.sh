#!/bin/bash

echo "════════════════════════════════════════════════"
echo "🧹 LIMPIEZA COMPLETA DE CACHÉ"
echo "════════════════════════════════════════════════"
echo ""

# 1. Limpiar caché de Node.js
echo "📦 1. Limpiando caché de npm..."
npm cache clean --force 2>/dev/null
echo "   ✅ Caché de npm limpiado"
echo ""

# 2. Limpiar node_modules y package-lock
echo "📦 2. Limpiando node_modules del servidor..."
cd /var/www/web.whats-flow.com/src/server
rm -rf node_modules package-lock.json
echo "   ✅ node_modules del servidor eliminado"
echo ""

echo "📦 3. Limpiando node_modules del cliente..."
cd /var/www/web.whats-flow.com/src/client
rm -rf node_modules package-lock.json
echo "   ✅ node_modules del cliente eliminado"
echo ""

# 3. Limpiar build del cliente
echo "🏗️  4. Limpiando build del cliente..."
rm -rf /var/www/web.whats-flow.com/src/client/build
rm -rf /var/www/web.whats-flow.com/src/client/.cache
echo "   ✅ Build del cliente eliminado"
echo ""

# 4. Limpiar caché de PM2
echo "⚡ 5. Limpiando logs y caché de PM2..."
pm2 flush
rm -rf /root/.pm2/logs/*
echo "   ✅ Logs de PM2 limpiados"
echo ""

# 5. Limpiar archivos temporales
echo "🗑️  6. Limpiando archivos temporales..."
cd /var/www/web.whats-flow.com
rm -rf /tmp/whatsflow-*
rm -rf /tmp/npm-*
rm -rf .cache
echo "   ✅ Archivos temporales eliminados"
echo ""

# 6. Limpiar caché del navegador (public)
echo "🌐 7. Limpiando caché público..."
rm -rf /var/www/web.whats-flow.com/src/server/public/static/js/*.js
rm -rf /var/www/web.whats-flow.com/src/server/public/static/css/*.css
rm -rf /var/www/web.whats-flow.com/src/server/public/static/media/*
echo "   ✅ Caché público eliminado"
echo ""

# 7. Limpiar session storage (auth_info)
echo "🔐 8. Limpiando sesiones antiguas..."
rm -rf /var/www/web.whats-flow.com/auth_info/*
rm -rf /var/www/web.whats-flow.com/auth_info_multi/*
echo "   ✅ Sesiones antiguas eliminadas"
echo ""

echo "════════════════════════════════════════════════"
echo "✅ LIMPIEZA COMPLETADA"
echo "════════════════════════════════════════════════"
echo ""
echo "Próximos pasos:"
echo "1. Reinstalar dependencias del servidor:"
echo "   cd /var/www/web.whats-flow.com/src/server && npm install"
echo ""
echo "2. Reinstalar dependencias del cliente:"
echo "   cd /var/www/web.whats-flow.com/src/client && npm install"
echo ""
echo "3. Compilar cliente:"
echo "   cd /var/www/web.whats-flow.com/src/client && npm run build"
echo ""
echo "4. Copiar build:"
echo "   cp -r /var/www/web.whats-flow.com/src/client/build/* /var/www/web.whats-flow.com/src/server/public/"
echo ""
echo "5. Reiniciar PM2:"
echo "   pm2 restart whatsflow-server"
echo ""
