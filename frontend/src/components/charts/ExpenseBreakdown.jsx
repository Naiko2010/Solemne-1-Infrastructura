import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#e74c3c', '#e67e22', '#f39c12', '#f1c40f', '#3498db', '#9b59b6', '#1abc9c']

/**
 * ExpenseBreakdown - Gráfico de desglose de gastos
 * Muestra distribución de gastos por categoría
 */
function ExpenseBreakdown({ data = [] }) {
  // Si no hay datos, mostrar placeholder
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No hay datos de gastos disponibles</p>
      </div>
    )
  }

  // Formatea datos para el gráfico si es necesario
  const chartData = data.map((item) => ({
    name: item.category || item.type || item.name || 'Sin categoría',
    value: Number(item.amount) || Number(item.gastos) || Number(item.total) || 0,
  }))

  // Filtra datos con valor > 0
  const validData = chartData.filter((item) => item.value > 0)

  if (validData.length === 0) {
    return (
      <div className="chart-empty">
        <p>No hay gastos registrados</p>
      </div>
    )
  }

  // Calcula total
  const total = validData.reduce((sum, item) => sum + item.value, 0)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={validData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => {
            const percent = ((value / total) * 100).toFixed(0)
            return `${name}: ${percent}%`
          }}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {validData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat('es-CL', {
              style: 'currency',
              currency: 'CLP',
              maximumFractionDigits: 0,
            }).format(value)
          }
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value, entry) => {
            const percent = ((entry.value / total) * 100).toFixed(1)
            return `${value} (${percent}%)`
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default ExpenseBreakdown
