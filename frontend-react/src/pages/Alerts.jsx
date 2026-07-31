import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

export default function Alerts() {
  const { toast } = useToast()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/stock/low-alerts')
      .then(r => setAlerts(r.data))
      .catch(() => toast('Failed to load alerts', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const oos = alerts.filter(a => a.criticality === 'out_of_stock')
  const low = alerts.filter(a => a.criticality === 'low_stock')

  return (
    <Layout title="Stock Alerts" subtitle="Products at or below reorder point, sorted by criticality">
      <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
        <div className="stat-card red" style={{ padding: '14px 20px', flex: '0 0 auto' }}>
          <div className="label">Out of Stock</div>
          <div className="value">{loading ? '—' : oos.length}</div>
        </div>
        <div className="stat-card orange" style={{ padding: '14px 20px', flex: '0 0 auto' }}>
          <div className="label">Low Stock</div>
          <div className="value">{loading ? '—' : low.length}</div>
        </div>
      </div>

      <div className="card">
        {loading && <div className="loading-box"><span className="spinner spinner-dark" /> Loading…</div>}

        {!loading && !alerts.length && (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p>All products are well-stocked. No alerts at this time.</p>
          </div>
        )}

        {!loading && !!oos.length && (
          <>
            <div className="section-title" style={{ marginBottom: 12 }}>🔴 Out of Stock ({oos.length})</div>
            {oos.map(a => <AlertItem key={a.product_id} alert={a} />)}
          </>
        )}

        {!loading && !!low.length && (
          <div style={{ marginTop: oos.length ? 22 : 0 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>🟡 Low Stock ({low.length})</div>
            {low.map(a => <AlertItem key={a.product_id} alert={a} />)}
          </div>
        )}
      </div>
    </Layout>
  )
}

function AlertItem({ alert: a }) {
  return (
    <div className={`alert-item ${a.criticality}`}>
      <div className="alert-info">
        <h4>{a.name}</h4>
        <p><code>{a.sku}</code> · {a.category.replace('_', ' ')} · Reorder point: <strong>{a.reorder_point}</strong></p>
      </div>
      <div className="alert-qty">
        <div className="qty">{a.quantity_available}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>units available</div>
        <Link to="/orders" className="btn btn-sm btn-outline" style={{ marginTop: 8 }}>Raise PO →</Link>
      </div>
    </div>
  )
}
