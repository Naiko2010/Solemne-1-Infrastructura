-- HU-05: Sistema de Alertas Administrativas (SCRUM-47)
-- SCRUM-52: Implementar almacenamiento e historial de alertas
-- Tabla principal para alertas administrativas del sistema.
-- Reemplaza la tabla 'alerts' (is_read) con un modelo de estado explícito.

CREATE TABLE IF NOT EXISTS administrative_alerts (
    id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    local_id    UUID          NOT NULL,
    type        VARCHAR(50)   NOT NULL,
    severity    VARCHAR(20)   NOT NULL DEFAULT 'medium',
    title       VARCHAR(200)  NOT NULL,
    message     TEXT          NOT NULL,
    status      VARCHAR(20)   NOT NULL DEFAULT 'pending',
    metadata    JSONB         NOT NULL DEFAULT '{}',
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- severity: low | medium | high | critical
-- status:   pending | resolved
-- type:     petty_cash_low | stock_critical | stock_low | custom

CREATE INDEX IF NOT EXISTS idx_admin_alerts_local_id   ON administrative_alerts (local_id);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status     ON administrative_alerts (status);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type       ON administrative_alerts (type);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON administrative_alerts (created_at DESC);

-- Índice compuesto para la consulta más frecuente: alertas pendientes de un local
CREATE INDEX IF NOT EXISTS idx_admin_alerts_local_pending
    ON administrative_alerts (local_id, status)
    WHERE status = 'pending';
