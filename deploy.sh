#!/bin/bash

# 🚀 Script de Auto-Deployment para WhatsFlow
# Este script se ejecuta automáticamente cuando hay un push a GitHub

echo "=========================================="
echo "🚀 INICIANDO DEPLOYMENT DE WHATSFLOW"
echo "=========================================="
echo ""

# Timestamp
echo "⏰ Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Ir al directorio del proyecto
cd /home/user/-web-whats-flow || exit 1

# 1. Git Pull
echo "📥 PASO 1/5: Actualizando código desde GitHub..."
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "   Rama actual: $CURRENT_BRANCH"

# Hacer pull de la rama actual
git pull origin $CURRENT_BRANCH

if [ $? -eq 0 ]; then
    echo "   ✅ Código actualizado exitosamente"
else
    echo "   ❌ Error al actualizar código"
    exit 1
fi
echo ""

# 2. Verificar si hay cambios en package.json
echo "📦 PASO 2/5: Verificando dependencias..."
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    echo "   📦 Detectados cambios en package.json, instalando dependencias..."
    npm install --production
    if [ $? -eq 0 ]; then
        echo "   ✅ Dependencias instaladas"
    else
        echo "   ⚠️  Advertencia: Error instalando dependencias"
    fi
else
    echo "   ℹ️  No hay cambios en package.json, omitiendo npm install"
fi
echo ""

# 3. Build del Frontend (si hay cambios en src/client)
echo "🏗️  PASO 3/5: Verificando si necesita rebuild del frontend..."
if git diff HEAD@{1} HEAD --name-only | grep -q "src/client"; then
    echo "   🏗️  Detectados cambios en frontend, rebuilding..."
    cd src/client
    npm run build
    if [ $? -eq 0 ]; then
        echo "   ✅ Frontend rebuildeado exitosamente"
    else
        echo "   ⚠️  Advertencia: Error en build del frontend"
    fi
    cd ../..
else
    echo "   ℹ️  No hay cambios en frontend, omitiendo build"
fi
echo ""

# 4. Reiniciar servidor con PM2
echo "🔄 PASO 4/5: Reiniciando servidor..."
if command -v pm2 &> /dev/null; then
    pm2 restart whatsflow-server
    if [ $? -eq 0 ]; then
        echo "   ✅ Servidor reiniciado con PM2"
    else
        echo "   ⚠️  Advertencia: Error al reiniciar con PM2"
    fi
else
    echo "   ⚠️  PM2 no encontrado, reinicio manual requerido"
fi
echo ""

# 5. Verificar estado
echo "✅ PASO 5/5: Verificando estado del servidor..."
if command -v pm2 &> /dev/null; then
    pm2 status whatsflow-server
fi
echo ""

echo "=========================================="
echo "✅ DEPLOYMENT COMPLETADO"
echo "=========================================="
echo "⏰ Finalizado: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Guardar log
echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployment exitoso - Branch: $CURRENT_BRANCH - Commit: $(git rev-parse --short HEAD)" >> /home/user/-web-whats-flow/deployment.log
