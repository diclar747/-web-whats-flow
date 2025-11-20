/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Configurar usuario administrador
    -- Actualiza el usuario con el número que inicia con 595994854167 como administrador

    UPDATE users 
    SET 
        is_admin = TRUE,
        admin_phone = phone,
        subscription_plan = 'enterprise',
        subscription_status = 'active',
        subscription_start_date = NOW(),
        subscription_end_date = DATE_ADD(NOW(), INTERVAL 365 DAY),
        subscription_days = 365
    WHERE phone LIKE '595994854167%';
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Reverting this change is not straightforward as it involves undoing specific data modifications.
  // Therefore, the down function is left empty.
};
