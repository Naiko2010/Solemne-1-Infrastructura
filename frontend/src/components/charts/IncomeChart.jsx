import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

/**
 * IncomeChart - Gráfico de tendencia de ingresos
 * Muestra ingresos diarios/semanales por período
 */
function IncomeChart({ data = [] }) {
  // Si no hay datos, mostrar placeholder
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No hay datos de ingresos disponibles</p>
      </div>
    )
  }

  // Formatea datos para el gráfico si es necesario
  const chartData = data.map((item) => ({
    date: item.date || item.period || item.name || 'N/A',
    ingresos: Number(item.ingresos) || Number(item.revenue) || 0,
    promedio: Number(item.promedio) || Number(item.average) || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} />
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
        <Legend />
        <Line
          type="monotone"
          dataKey="ingresos"
          stroke="#2ecc71"
          strokeWidth={2}
          dot={{ fill: '#2ecc71', r: 4 }}
          activeDot={{ r: 6 }}
          name="Ingresos"
        />
        {chartData.some((item) => item.promedio > 0) && (
          <Line
            type="monotone"
            dataKey="promedio"
            stroke="#3498db"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#3498db', r: 3 }}
            activeDot={{ r: 5 }}
            name="Promedio"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

export default IncomeChart
