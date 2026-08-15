import { useState, useEffect } from 'react'
import { Fe } from '../lib/database'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface ReportData {
  totalRevenue: number
  totalSales: number
  avgTransaction: number
  topProducts: { name: string; quantity: number; revenue: number }[]
  chartData: { label: string; revenue: number; sales: number }[]
}

export default function Reports() {
  const [data, setData] = useState<ReportData>({
    totalRevenue: 0,
    totalSales: 0,
    avgTransaction: 0,
    topProducts: [],
    chartData: [],
  })
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [dateFrom, dateTo])

  async function loadData() {
    setIsLoading(true)
    const sales = await Fe(
      `SELECT s.*, si.quantity, si.unit_price, p.generic_name FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN batches b ON b.id = si.batch_id
       LEFT JOIN products p ON p.id = b.product_id
       WHERE s.created_at >= ? AND s.created_at <= ?
       ORDER BY s.created_at DESC`,
      [`${dateFrom}T00:00:00`, `${dateTo}T23:59:59`]
    )

    const totalRevenue = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
    const totalSales = sales.length
    const avgTransaction = totalSales > 0 ? totalRevenue / totalSales : 0

    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const s of sales) {
      if (s.generic_name) {
        const existing = productMap.get(s.generic_name) || { name: s.generic_name, quantity: 0, revenue: 0 }
        existing.quantity += s.quantity || 0
        existing.revenue += (s.unit_price || 0) * (s.quantity || 0)
        productMap.set(s.generic_name, existing)
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    const dayMap = new Map<string, { revenue: number; sales: number }>()
    for (const s of sales) {
      const day = s.created_at?.slice(0, 10) || ''
      const existing = dayMap.get(day) || { revenue: 0, sales: 0 }
      existing.revenue += s.total || 0
      existing.sales += 1
      dayMap.set(day, existing)
    }
    const chartData = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, vals]) => ({
        label: day.slice(5),
        revenue: vals.revenue,
        sales: vals.sales,
      }))

    setData({ totalRevenue, totalSales, avgTransaction, topProducts, chartData })
    setIsLoading(false)
  }

  function exportCSV() {
    const headers = ['Date', 'Total Revenue', 'Transactions']
    const rows = data.chartData.map((d) => [d.label, d.revenue.toFixed(2), d.sales])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-report-${dateFrom}-${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-black text-on-surface">Sales Reports</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm"
          />
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-90"
          >
            <span className="material-symbols-outlined">download</span>
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Total Revenue</p>
          <p className="font-headline text-2xl font-black text-on-surface mt-1">${data.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Transactions</p>
          <p className="font-headline text-2xl font-black text-on-surface mt-1">{data.totalSales}</p>
        </div>
        <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Avg Transaction</p>
          <p className="font-headline text-2xl font-black text-on-surface mt-1">${data.avgTransaction.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
        <h3 className="font-headline font-bold text-on-surface mb-4">Revenue Over Time</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
        <h3 className="font-headline font-bold text-on-surface mb-4">Top Products</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.topProducts.slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
