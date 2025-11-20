exports.up = function(knex) {
  return knex.schema.createTable('api_keys', function(table) {
    table.increments('id').primary();
    table.string('session_id', 50).notNullable();
    table.string('api_key', 100).notNullable().unique();
    table.string('name', 255).notNullable();
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('last_used_at').nullable();
    table.integer('request_count').defaultTo(0);
    
    table.index('session_id');
    table.index('api_key');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('api_keys');
};
