import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

function CategoryBadge({ cat }) {
  const map = { grocery:'badge-green', electronics:'badge-blue', clothing:'badge-purple', household:'badge-orange', personal_care:'badge-gray' }
  return <span className={`badge ${map[cat] || 'badge-gray'}`}>{cat.replace('_',' ')}</span>
}

export default function Suppliers() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogSupplier, setCatalogSupplier] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await api.get('/suppliers')
      setSuppliers(res.data)
    } catch { toast('Failed to load suppliers', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { loadSuppliers() }, [loadSuppliers])

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.supplier_code.toLowerCase().includes(search.toLowerCase())
  )

  // ── Create Supplier ───────────────────────────────────────
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    defaultValues: { payment_terms_days: 30, lead_time_days: 7 }
  })

  async function onCreateSupplier(data) {
    try {
      await api.post('/suppliers', {
        name: data.name,
        supplier_code: data.supplier_code.toUpperCase(),
        contact_email: data.contact_email || null,
        payment_terms_days: parseInt(data.payment_terms_days),
        lead_time_days: parseInt(data.lead_time_days),
      })
      toast('Supplier added', 'success')
      reset(); setCreateOpen(false); loadSuppliers()
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to add supplier', 'error')
    }
  }

  // ── View Catalog ──────────────────────────────────────────
  async function openCatalog(supplier) {
    setCatalogSupplier(supplier); setCatalog([]); setCatalogLoading(true); setCatalogOpen(true)
    try {
      const res = await api.get(`/suppliers/${supplier.id}/catalog`)
      setCatalog(res.data)
    } catch { toast('Failed to load catalog', 'error') }
    finally { setCatalogLoading(false) }
  }

  return (
    <Layout title="Suppliers" subtitle="Manage supplier records and view their product catalog">
      <div className="card">
        <div className="toolbar">
          <input className="search-input" placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
          {isManager && <button className="btn btn-primary" onClick={() => { reset(); setCreateOpen(true) }}>+ New Supplier</button>}
        </div>
        {!isManager && <div className="role-notice">🔒 Read-only mode. Contact a Manager to add suppliers.</div>}

        <div className="table-wrap">
          {loading
            ? <div className="loading-box"><span className="spinner spinner-dark" /> Loading…</div>
            : (
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Payment Terms</th><th>Lead Time</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={7} className="empty-cell">No suppliers found.</td></tr>
                  : filtered.map(s => (
                    <tr key={s.id}>
                      <td><code>{s.supplier_code}</code></td>
                      <td>{s.name}</td>
                      <td>{s.contact_email || '—'}</td>
                      <td>{s.payment_terms_days} days</td>
                      <td>{s.lead_time_days} days</td>
                      <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-red'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => openCatalog(s)}>View Catalog</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Create Supplier Modal ── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Supplier">
        <form onSubmit={handleSubmit(onCreateSupplier)} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name *</label>
              <input className={`form-control${errors.name ? ' input-error' : ''}`} placeholder="Fresh Farms Ltd"
                {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })} />
              {errors.name && <span className="field-error">{errors.name.message}</span>}
            </div>
            <div className="form-group">
              <label>Supplier Code *</label>
              <input className={`form-control${errors.supplier_code ? ' input-error' : ''}`} placeholder="FF-001"
                style={{ textTransform: 'uppercase' }}
                {...register('supplier_code', {
                  required: 'Code is required',
                  pattern: { value: /^[A-Za-z0-9-]+$/, message: 'Only letters, numbers, hyphens' },
                  minLength: { value: 2, message: 'Min 2 characters' },
                })} />
              {errors.supplier_code && <span className="field-error">{errors.supplier_code.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Contact Email</label>
            <input type="email" className={`form-control${errors.contact_email ? ' input-error' : ''}`} placeholder="contact@supplier.com"
              {...register('contact_email', {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' }
              })} />
            {errors.contact_email && <span className="field-error">{errors.contact_email.message}</span>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment Terms (days)</label>
              <input type="number" className={`form-control${errors.payment_terms_days ? ' input-error' : ''}`}
                {...register('payment_terms_days', { required: 'Required', min: { value: 1, message: 'Min 1 day' } })} />
              {errors.payment_terms_days && <span className="field-error">{errors.payment_terms_days.message}</span>}
            </div>
            <div className="form-group">
              <label>Lead Time (days)</label>
              <input type="number" className={`form-control${errors.lead_time_days ? ' input-error' : ''}`}
                {...register('lead_time_days', { required: 'Required', min: { value: 1, message: 'Min 1 day' } })} />
              {errors.lead_time_days && <span className="field-error">{errors.lead_time_days.message}</span>}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <span className="spinner" /> : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Catalog Modal ── */}
      <Modal isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} title={`🏭 Catalog — ${catalogSupplier?.name}`} wide>
        <div className="modal-body">
          {catalogLoading
            ? <div className="loading-box"><span className="spinner spinner-dark" /></div>
            : !catalog.length
              ? <p style={{ color: 'var(--muted)', paddingBottom: 16 }}>No products linked to this supplier.</p>
              : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Cost Price</th><th>Unit Price</th><th>Reorder Pt.</th></tr></thead>
                <tbody>
                  {catalog.map(p => (
                    <tr key={p.id}>
                      <td><code>{p.sku}</code></td>
                      <td>{p.name}</td>
                      <td><CategoryBadge cat={p.category} /></td>
                      <td>₹{p.cost_price}</td>
                      <td>₹{p.unit_price}</td>
                      <td>{p.reorder_point}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setCatalogOpen(false)}>Close</button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
