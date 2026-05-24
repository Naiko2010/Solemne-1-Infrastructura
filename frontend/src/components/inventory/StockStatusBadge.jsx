import { Badge } from '@/components/ui/badge'
import { getStockStatusMeta } from './stockAlertUtils'

const VARIANT_MAP = {
  optimal: 'success',
  low: 'warning',
  critical: 'destructive',
  unknown: 'outline',
}

/** Badge de estado de stock (variantes de color por nivel). */
function StockStatusBadge({ row }) {
  const { label, variant } = getStockStatusMeta(row)
  const badgeVariant = VARIANT_MAP[variant] ?? 'outline'
  return (
    <Badge variant={badgeVariant} data-stock-status={variant}>
      {label}
    </Badge>
  )
}

export default StockStatusBadge
