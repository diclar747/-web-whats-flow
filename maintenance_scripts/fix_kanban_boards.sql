-- Script para verificar y corregir tableros Kanban
-- Fecha: 1 de Diciembre 2025

-- Ver cuántos tableros tiene cada usuario
SELECT 
    session_id,
    COUNT(*) as total_tableros,
    GROUP_CONCAT(name ORDER BY board_order SEPARATOR ', ') as tableros
FROM kanban_boards
GROUP BY session_id;

-- Si un usuario tiene menos de 5 tableros, este script los crea
-- NOTA: Cambiar '595985768793' por tu número de teléfono

-- Verificar tableros actuales del usuario
SELECT * FROM kanban_boards WHERE session_id = '595985768793' ORDER BY board_order;

-- Si faltan tableros, ejecutar esto (descomenta y ajusta el número de teléfono):
/*
-- Eliminar tableros existentes (OPCIONAL - solo si quieres empezar de cero)
-- DELETE FROM kanban_boards WHERE session_id = '595985768793';
-- DELETE FROM kanban_contacts WHERE board_id IN (SELECT id FROM kanban_boards WHERE session_id = '595985768793');

-- Crear 5 tableros por defecto
INSERT INTO kanban_boards (id, session_id, name, color, board_order, is_default) VALUES
('board_1', '595985768793', 'Sin Categoría', '#607d8b', 0, 1),
('board_2', '595985768793', 'Interesados', '#2196f3', 1, 0),
('board_3', '595985768793', 'Negociación', '#ff5722', 2, 0),
('board_4', '595985768793', 'Clientes', '#4caf50', 3, 0),
('board_5', '595985768793', 'Prospectos', '#ff9800', 4, 0);

-- Verificar que se crearon correctamente
SELECT * FROM kanban_boards WHERE session_id = '595985768793' ORDER BY board_order;
*/
