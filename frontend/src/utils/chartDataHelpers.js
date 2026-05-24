export function enrichDashboardWithChartData(dashboard) {
  if (!dashboard) {
    return { daily_income_trend: [], expenses_breakdown: [] }
  }
  return {
    ...dashboard,
    daily_income_trend: dashboard.daily_income_trend || [],
    expenses_breakdown: dashboard.expenses_breakdown || [],
  }
}

export function generateIncomeTrendFromOrders(orders = []) {
  if (!Array.isArray(orders) || orders.length === 0) return []

  const dailyMap = {}
  orders.forEach((order) => {
    const date = new Date(order.created_at || Date.now())
    const key = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
    const amount = Number(order.total) || Number(order.subtotal) || 0
    dailyMap[key] = (dailyMap[key] || 0) + amount
  })

  const total = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
  const days = Object.keys(dailyMap).length

  return Object.entries(dailyMap).map(([date, ingresos]) => ({
    date,
    ingresos,
    promedio: days > 0 ? Math.round(total / days) : 0,
  }))
}

export function generateExpenseBreakdownFromData(expenses = []) {
  if (!Array.isArray(expenses) || expenses.length === 0) return []

  const categoryMap = {}
  expenses.forEach((expense) => {
    const category = expense.category || expense.type || 'Otro'
    const amount = Number(expense.amount) || Number(expense.total) || 0
    categoryMap[category] = (categoryMap[category] || 0) + amount
  })

  return Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
