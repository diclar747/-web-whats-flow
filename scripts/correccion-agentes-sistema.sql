-- SCRIPT DE CORRECCIÓN PARA AGENTES WHATSAPP FLOW
-- Fecha: 2025-11-30T19:57:16.703Z
-- Problema: Muestra 2 agentes cuando solo debería haber 1 (claudio@cnid.com.py)

USE whatsflow;

-- 1. CREAR AGENTE CLAUDIO (no existe ningún agente)
INSERT INTO agents (
  session_id, name, email, phone, status, 
  max_concurrent_chats, current_chats, is_active, 
  avatar_url, created_at, updated_at, last_activity
) VALUES (
  'session_5959857687983', 
  'Claudio', 
  'claudio@cnid.com.py', 
  '5959857687983', 
  'available', 
  10, 0, 1, 
  NULL, 
  NOW(), NOW(), NOW()
);

-- 4. VERIFICAR RESULTADO
SELECT 'AGENTES ACTIVOS DESPUÉS DE LA CORRECCIÓN:' as info;
SELECT id, email, phone, is_active, status 
FROM agents 
WHERE is_active = 1;

SELECT 'TOTAL DE AGENTES:' as info;
SELECT COUNT(*) as total_agents FROM agents;

COMMIT;
