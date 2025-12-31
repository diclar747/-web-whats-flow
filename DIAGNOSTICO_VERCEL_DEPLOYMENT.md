# 🔍 Diagnóstico del Deployment en Vercel

## Problema Detectado

### Estado Actual
- ✅ Backend se desplegó correctamente
- ❌ Backend devuelve error 500 (FUNCTION_INVOCATION_FAILED)
- ❌ Frontend devuelve 404 (The page could not be found)

### Errores Específicos
```
GET / → 404 "The page could not be found"
GET /api/subscriptions/plans → 500 "FUNCTION_INVOCATION_FAILED"
GET /api/health → 500 "FUNCTION_INVOCATION_FAILED"
GET /api/subscriptions/my-subscription → 500 "FUNCTION_INVOCATION_FAILED"
```

## Causa Raíz

### 1. Frontend no se encuentra
El `vercel.json` busca archivos en `src/client/build/**` pero estos no existen o no se generaron durante el build.

### 2. Backend falla al ejecutarse
El error 500 indica que la función serverless se invoca pero falla internamente, probablemente por:
- **Variables de entorno faltantes** (DATABASE_URL, JWT_SECRET, etc.)
- **Dependencias faltantes** en src/server
- **Errores de conexión** a PostgreSQL

## Solución

### Paso 1: Verificar variables de entorno en Vercel

Ir a: https://vercel.com/diclar747s-projects/whinsapp/settings/environment-variables

Agregar las siguientes variables:

```env
# Base de datos PostgreSQL (Neon)
DATABASE_URL=postgresql://user:password@host/database

# Autenticación
JWT_SECRET=tu_secret_key_aqui

# Node
NODE_ENV=production

# Puerto (opcional para Vercel)
PORT=3001
```

### Paso 2: Corregir vercel.json

El problema es que:
1. `src/client/build` no se genera automáticamente en el deployment
2. Necesitamos un comando de build que compile el frontend

#### Opción A: Build Command en Vercel Dashboard
En Vercel Dashboard → Settings → Build & Development Settings:
- **Framework Preset**: Other
- **Build Command**: `npm run build:frontend && npm run build:server`
- **Output Directory**: `src/client/build`
- **Install Command**: `npm install && cd src/client && npm install && cd ../server && npm install`

#### Opción B: Usar vercel.json con outputDirectory
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "src/client/build",
  "functions": {
    "src/server/index.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

### Paso 3: Estructura recomendada

Para que Vercel funcione correctamente con este proyecto, necesitamos:

```
proyecto/
├── api/                    # Vercel busca funciones aquí por defecto
│   └── index.js           # Punto de entrada del backend
├── public/                # Archivos estáticos del frontend
├── src/
│   ├── client/
│   │   └── build/        # Build del frontend (generado)
│   └── server/
│       └── index.js      # Backend original
└── vercel.json
```

## Plan de Acción Inmediato

### 1. Agregar variables de entorno en Vercel
```bash
# En el dashboard de Vercel, agregar:
DATABASE_URL=<tu_url_de_neon>
JWT_SECRET=<tu_secret>
NODE_ENV=production
```

### 2. Simplificar vercel.json
Usar configuración más simple que Vercel entienda mejor.

### 3. Revisar logs de Vercel
```
vercel logs whinsapp.vercel.app --prod
```

Para ver el error específico del backend.

## Variables de Entorno Necesarias

Estas variables DEBEN estar configuradas en Vercel:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL de Neon | `postgresql://...` |
| `JWT_SECRET` | Secret para tokens | `mi-secret-seguro-123` |
| `NODE_ENV` | Entorno | `production` |
| `SESSION_SECRET` | Secret para sesiones | `otro-secret-456` |

## Próximos Pasos

1. **Configurar variables de entorno** en Vercel Dashboard
2. **Re-desplegar** con `vercel --prod`
3. **Verificar logs** con `vercel logs`
4. **Probar endpoints** nuevamente
