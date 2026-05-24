-- HU-59: Agregar campos de visualización a tabla mesas
-- Migración: Agregar campos 'numero' y 'state' para la visualización gráfica de mesas

-- Agregar columna 'numero' (número de mesa opcional)
ALTER TABLE mesas ADD COLUMN numero INTEGER DEFAULT NULL;

-- Agregar columna 'state' (estado de la mesa: libre, ocupada, en_cobro)
ALTER TABLE mesas ADD COLUMN state VARCHAR(50) DEFAULT 'libre' NOT NULL;

-- Agregar índice en 'state' para queries optimizadas
CREATE INDEX idx_mesas_state ON mesas(state);

-- Agregar índice compuesto para búsquedas comunes
CREATE INDEX idx_mesas_local_state ON mesas(local_id, state);

-- Agregar timestamp de creación si no existe
ALTER TABLE mesas ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN mesas.numero IS 'Número visual de la mesa';
COMMENT ON COLUMN mesas.state IS 'Estado actual de la mesa: libre, ocupada, en_cobro';
COMMENT ON COLUMN mesas.created_at IS 'Timestamp de cuando se creó la mesa';
