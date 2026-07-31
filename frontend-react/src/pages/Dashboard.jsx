import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import Layout from '../components/Layout'
import api from '../api/client'
const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']

const CAT_LABELS = { grocery:'Grocery', electronics:'Electronics', clothing:'Clothing', household:'Household', personal_care:'Personal Care' }
const STATUS_BADGE = { draft:'badge-gray', submitted:'badge-blue', acknowledged:'badge-purple', received:'badge-green', cancelled:'badge-red' }

function fmt(n) { return `₹${Math.round(n).toLocaleString('en-IN')}` }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="value" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : `${p.value}${p.name?.includes('%') ? '%' : ''}`}
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="label">{payload[0].name}</div>
      <div className="value">{payload[0].value} products · {fmt(payload[0].payload.stockValue)}</div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats]           = useState(null)
  const [products, setProducts]     = useState([])
  const [alerts, setAlerts]         = useState([])
  const [orders, setOrders]         = useState([])
  const [movements, setMovements]   = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/dashboard').catch(() => null),
      api.get('/products').catch(() => ({ data: [] })),
      api.get('/stock/low-alerts').catch(() => ({ data: [] })),
      api.get('/orders').catch(() => ({ data: [] })),
      api.get('/stock/movements').catch(() => ({ data: [] })),
    ]).then(([dashRes, prodRes, alertsRes, ordersRes, movRes]) => {
      if (dashRes) setStats(dashRes.data)
      setProducts(prodRes.data)
      setAlerts(alertsRes.data.slice(0, 5))
      setOrders(ordersRes.data.slice(-5).reverse())
      setMovements(movRes.data)
      setLoading(false)
    })
  }, [])

  // ── Inventory summary by category ──────────────────────────
  const inventorySummary = useMemo(() => {
    const map = {}
    products.forEach(p => {
      const cat = p.category
      const avail = p.stock_level?.quantity_available ?? 0
      if (!map[cat]) map[cat] = { category: CAT_LABELS[cat] || cat, count: 0, costValue: 0, retailValue: 0, profit: 0 }
      map[cat].count++
      map[cat].costValue  += avail * p.cost_price
      map[cat].retailValue += avail * p.unit_price
      map[cat].profit += avail * (p.unit_price - p.cost_price)
    })
    return Object.values(map).sort((a, b) => b.retailValue - a.retailValue)
  }, [products])

  // ── Chart data ──────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map = {}
    products.forEach(p => {
      const cat = p.category
      const avail = p.stock_level?.quantity_available ?? 0
      if (!map[cat]) map[cat] = { name: CAT_LABELS[cat] || cat, count: 0, stockValue: 0, retailValue: 0 }
      map[cat].count++
      map[cat].stockValue  += avail * p.cost_price
      map[cat].retailValue += avail * p.unit_price
    })
    return Object.values(map)
  }, [products])

  const marginData = useMemo(() =>
    products
      .map(p => ({
        name: p.sku.replace('SKU-',''),
        fullName: p.name,
        margin: parseFloat(((p.unit_price - p.cost_price) / p.unit_price * 100).toFixed(1)),
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8),
    [products]
  )

  // ── Financial summary ───────────────────────────────────────
  const totalCost   = products.reduce((s, p) => s + (p.stock_level?.quantity_available ?? 0) * p.cost_price, 0)
  const totalRetail = products.reduce((s, p) => s + (p.stock_level?.quantity_available ?? 0) * p.unit_price, 0)
  const grossProfit = totalRetail - totalCost
  const avgMargin   = totalRetail > 0 ? ((grossProfit / totalRetail) * 100).toFixed(1) : 0

  return (
    <Layout title="Dashboard" subtitle="Inventory health, analytics & profit overview">
      {/* ── KPI stat cards ── */}
      <div className="stat-grid">
        <Stat label="Total Products"  value={stats?.total_products}    color="blue"   loading={loading} />
        <Stat label="Low Stock"       value={stats?.low_stock_count}   color="orange" loading={loading} />
        <Stat label="Out of Stock"    value={stats?.out_of_stock_count} color="red"   loading={loading} />
        <Stat label="Open POs"        value={stats?.open_po_count}     color="purple" loading={loading} />
        <Stat label="Stock Value"     value={stats ? fmt(stats.total_stock_value) : null} color="green" loading={loading} />
      </div>

      {/* ── Profit summary ── */}
      {!loading && (
        <div className="profit-cards">
          <div className="profit-card cost">
            <div className="p-label">Stock at Cost</div>
            <div className="p-value">{fmt(totalCost)}</div>
          </div>
          <div className="profit-card retail">
            <div className="p-label">Stock at Retail</div>
            <div className="p-value">{fmt(totalRetail)}</div>
          </div>
          <div className="profit-card profit">
            <div className="p-label">Gross Profit Potential</div>
            <div className="p-value">{fmt(grossProfit)}</div>
          </div>
          <div className="profit-card margin">
            <div className="p-label">Average Margin</div>
            <div className="p-value">{avgMargin}%</div>
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="dash-grid" style={{ marginBottom: 22 }}>
        {/* Category distribution donut */}
        <div className="card">
          <div className="section-title">📊 Stock Value by Category</div>
          {loading
            ? <div className="loading-box"><span className="spinner spinner-dark" /></div>
            : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="45%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="stockValue" nameKey="name" paddingAngle={3}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Profit margin per product */}
        <div className="card">
          <div className="section-title">💹 Profit Margin by Product (%)</div>
          {loading
            ? <div className="loading-box"><span className="spinner spinner-dark" /></div>
            : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginData} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Margin']} />
                  <Bar dataKey="margin" name="Margin %" radius={[0, 4, 4, 0]}>
                    {marginData.map((d, i) => (
                      <Cell key={i} fill={d.margin >= 40 ? '#10b981' : d.margin >= 25 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Stock value by category bar chart ── */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="section-title">📦 Stock Value vs Retail Value by Category</div>
        {loading
          ? <div className="loading-box"><span className="spinner spinner-dark" /></div>
          : (
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="square" iconSize={10} />
                <Bar dataKey="stockValue" name="Cost Value"   fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="retailValue" name="Retail Value" fill="#0ea5e9" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Alerts + Recent POs ── */}
      <div className="dash-grid">
        <div className="card">
          <div className="section-title">⚠️ Stock Alerts</div>
          {loading && <div className="loading-box"><span className="spinner spinner-dark" /></div>}
          {!loading && !alerts.length && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-icon">✅</div><p>All products well-stocked</p>
            </div>
          )}
          {!loading && alerts.map(a => (
            <div key={a.product_id} className={`alert-item ${a.criticality}`}>
              <div className="alert-info">
                <h4>{a.name}</h4>
                <p><code>{a.sku}</code> · {CAT_LABELS[a.category] || a.category}</p>
              </div>
              <div className="alert-qty">
                <div className="qty">{a.quantity_available}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>of {a.reorder_point} min</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <Link to="/alerts" className="btn btn-outline btn-sm">View All →</Link>
          </div>
        </div>

        <div className="card">
          <div className="section-title">🛒 Recent Purchase Orders</div>
          {loading && <div className="loading-box"><span className="spinner spinner-dark" /></div>}
          {!loading && !orders.length && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-icon">📄</div><p>No purchase orders yet</p>
            </div>
          )}
          {!loading && !!orders.length && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>PO #</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td><b>{o.po_number}</b></td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{o.order_date}</td>
                      <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-gray'}`}>{o.status}</span></td>
                      <td>{fmt(o.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <Link to="/orders" className="btn btn-outline btn-sm">View All →</Link>
          </div>
        </div>
      </div>

      {/* ── Inventory Summary Table ── */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="section-title">📊 Inventory Summary by Category</div>
        {loading
          ? <div className="loading-box"><span className="spinner spinner-dark" /></div>
          : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Category</th><th>Products</th><th>Cost Value</th><th>Retail Value</th><th>Gross Profit</th><th>Margin %</th></tr>
              </thead>
              <tbody>
                {inventorySummary.map(row => {
                  const margin = row.retailValue > 0 ? ((row.profit / row.retailValue) * 100).toFixed(1) : 0
                  return (
                    <tr key={row.category}>
                      <td><span className="badge badge-indigo">{row.category}</span></td>
                      <td>{row.count}</td>
                      <td>{fmt(row.costValue)}</td>
                      <td><b>{fmt(row.retailValue)}</b></td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(row.profit)}</td>
                      <td>
                        <span className={`margin-pill ${margin >= 40 ? 'margin-high' : margin >= 25 ? 'margin-mid' : 'margin-low'}`}>
                          {margin}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {inventorySummary.length > 0 && (
                  <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                    <td>Total</td>
                    <td>{inventorySummary.reduce((s, r) => s + r.count, 0)}</td>
                    <td>{fmt(totalCost)}</td>
                    <td>{fmt(totalRetail)}</td>
                    <td style={{ color: 'var(--success)' }}>{fmt(grossProfit)}</td>
                    <td><span className="margin-pill margin-high">{avgMargin}%</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Activity ── */}
      <div className="card">
        <div className="section-title">🔄 Recent Stock Activity</div>
        {loading
          ? <div className="loading-box"><span className="spinner spinner-dark" /></div>
          : !movements.length
            ? <div className="empty-state" style={{ padding: '24px 0' }}><div className="empty-icon">📦</div><p>No movements recorded yet</p></div>
            : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>Product</th><th>Type</th><th>Qty</th><th>Reference</th><th>Time</th></tr></thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td><code>{m.product_sku}</code></td>
                    <td>{m.product_name}</td>
                    <td>
                      <span className={`badge ${m.movement_type === 'receipt' ? 'badge-green' : m.movement_type === 'sale' ? 'badge-red' : 'badge-gray'}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.movement_type === 'sale' || m.movement_type === 'transfer' ? '-' : '+'}{m.quantity}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{m.reference_number || '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{new Date(m.recorded_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}

function Stat({ label, value, color, loading }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="label">{label}</div>
      <div className="value">{loading ? '—' : (value ?? 0)}</div>
    </div>
  )
}
