import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['grocery','electronics','clothing','household','personal_care']
const MOVEMENT_TYPES = [
  { value: 'receipt',    label: 'Receipt (Inbound)' },
  { value: 'sale',       label: 'Sale (Outbound)' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'transfer',   label: 'Transfer (Outbound)' },
  { value: 'return',     label: 'Return (Inbound)' },
]

function CategoryBadge({ cat }) {
  const map = { grocery:'badge-green', electronics:'badge-blue', clothing:'badge-purple', household:'badge-orange', personal_care:'badge-gray' }
  return <span className={`badge ${map[cat] || 'badge-gray'}`}>{cat.replace('_',' ')}</span>
}

export default function Products() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [detailData, setDetailData] = useState(null)

  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get('/products')
      setProducts(res.data)
    } catch { toast('Failed to load products', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    loadProducts()
    api.get('/suppliers').then(r => setSuppliers(r.data)).catch(() => {})
  }, [loadProducts])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  // ── Create product ────────────────────────────────────────
  const { register: regC, handleSubmit: handleC, formState: { errors: errC, isSubmitting: savingC }, reset: resetC, watch: watchC } = useForm({ defaultValues: { reorder_point: 10, reorder_quantity: 50 } })
  const categoryVal = watchC('category')

  async function onCreateProduct(data) {
    try {
      await api.post('/products', {
        name: data.name, category: data.category,
        unit_price: parseFloat(data.unit_price), cost_price: parseFloat(data.cost_price),
        unit_of_measure: data.unit_of_measure || 'pieces',
        reorder_point: parseInt(data.reorder_point),
        reorder_quantity: parseInt(data.reorder_quantity),
        supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
      })
      toast('Product registered successfully', 'success')
      resetC(); setCreateOpen(false); loadProducts()
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to create product', 'error')
    }
  }

  // ── Update stock ──────────────────────────────────────────
  const { register: regS, handleSubmit: handleS, formState: { errors: errS, isSubmitting: savingS }, reset: resetS } = useForm({ defaultValues: { movement_type: 'receipt' } })

  function openStockModal(p) { setSelectedProduct(p); resetS({ movement_type: 'receipt' }); setStockOpen(true) }

  async function onUpdateStock(data) {
    try {
      await api.patch(`/products/${selectedProduct.id}/stock`, {
        movement_type: data.movement_type,
        quantity: parseInt(data.quantity),
        reference_number: data.reference_number || null,
        notes: data.notes || null,
      })
      toast('Stock updated', 'success')
      setStockOpen(false); loadProducts()
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to update stock', 'error')
    }
  }

  // ── Product detail ────────────────────────────────────────
  async function openDetail(p) {
    setSelectedProduct(p); setDetailData(null); setDetailOpen(true)
    try {
      const res = await api.get(`/products/${p.id}`)
      setDetailData(res.data)
    } catch { toast('Failed to load product detail', 'error') }
  }

  return (
    <Layout title="Products" subtitle="Register products and manage stock levels">
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <input className="search-input" placeholder="Search by name or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isManager && <button className="btn btn-primary" onClick={() => { resetC(); setCreateOpen(true) }}>+ New Product</button>}
        </div>
        {!isManager && (
          <div className="role-notice">🔒 You are in <strong>read-only</strong> mode. Contact a Manager to add or update products.</div>
        )}

        <div className="table-wrap">
          {loading
            ? <div className="loading-box"><span className="spinner spinner-dark" /> Loading…</div>
            : (
            <table>
              <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Unit Price</th><th>Margin</th><th>On Hand</th><th>Available</th><th>Reorder Pt.</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={8} className="empty-cell">No products found.</td></tr>
                  : filtered.map(p => {
                    const sl = p.stock_level
                    const onHand  = sl?.quantity_on_hand ?? 0
                    const avail   = sl?.quantity_available ?? 0
                    const lowStyle = avail === 0 ? { color: 'var(--danger)', fontWeight: 700 }
                      : avail <= p.reorder_point ? { color: 'var(--warning)', fontWeight: 700 } : {}
                    return (
                      <tr key={p.id}>
                        <td><code>{p.sku}</code></td>
                        <td>{p.name}</td>
                        <td><CategoryBadge cat={p.category} /></td>
                        <td>₹{p.unit_price.toLocaleString('en-IN')}</td>
                        <td>{(() => { const m = ((p.unit_price - p.cost_price) / p.unit_price * 100).toFixed(1); const cls = m >= 40 ? 'margin-high' : m >= 25 ? 'margin-mid' : 'margin-low'; return <span className={`margin-pill ${cls}`}>{m}%</span>; })()}</td>
                        <td>{onHand}</td>
                        <td style={lowStyle}>{avail}</td>
                        <td>{p.reorder_point}</td>
                        <td>
                          <div className="action-btns">
                            {isManager && <button className="btn btn-sm btn-outline" onClick={() => openStockModal(p)}>Update Stock</button>}
                            <button className="btn btn-sm btn-ghost"   onClick={() => openDetail(p)}>Detail</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Create Product Modal ── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Register New Product">
        <form onSubmit={handleC(onCreateProduct)} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label>Product Name *</label>
              <input className={`form-control${errC.name ? ' input-error' : ''}`} placeholder="e.g. Basmati Rice"
                {...regC('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })} />
              {errC.name && <span className="field-error">{errC.name.message}</span>}
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select className={`form-control${errC.category ? ' input-error' : ''}`}
                {...regC('category', { required: 'Category is required' })}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
              </select>
              {errC.category && <span className="field-error">{errC.category.message}</span>}
              {categoryVal && <span className="hint">SKU prefix: SKU-{{'grocery':'GRO','electronics':'ELC','clothing':'CLO','household':'HHD','personal_care':'PRC'}[categoryVal]}-NNNN</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unit Price (₹) *</label>
              <input type="number" step="0.01" className={`form-control${errC.unit_price ? ' input-error' : ''}`} placeholder="120.00"
                {...regC('unit_price', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
              {errC.unit_price && <span className="field-error">{errC.unit_price.message}</span>}
            </div>
            <div className="form-group">
              <label>Cost Price (₹) *</label>
              <input type="number" step="0.01" className={`form-control${errC.cost_price ? ' input-error' : ''}`} placeholder="85.00"
                {...regC('cost_price', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
              {errC.cost_price && <span className="field-error">{errC.cost_price.message}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unit of Measure</label>
              <input className="form-control" placeholder="pieces" {...regC('unit_of_measure')} />
            </div>
            <div className="form-group">
              <label>Supplier</label>
              <select className="form-control" {...regC('supplier_id')}>
                <option value="">None</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Reorder Point</label>
              <input type="number" className={`form-control${errC.reorder_point ? ' input-error' : ''}`}
                {...regC('reorder_point', { required: 'Required', min: { value: 0, message: 'Min 0' } })} />
              {errC.reorder_point && <span className="field-error">{errC.reorder_point.message}</span>}
            </div>
            <div className="form-group">
              <label>Reorder Quantity</label>
              <input type="number" className={`form-control${errC.reorder_quantity ? ' input-error' : ''}`}
                {...regC('reorder_quantity', { required: 'Required', min: { value: 1, message: 'Min 1' } })} />
              {errC.reorder_quantity && <span className="field-error">{errC.reorder_quantity.message}</span>}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={savingC}>
              {savingC ? <span className="spinner" /> : 'Register Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Update Stock Modal ── */}
      <Modal isOpen={stockOpen} onClose={() => setStockOpen(false)} title={`Update Stock — ${selectedProduct?.sku}`}>
        <form onSubmit={handleS(onUpdateStock)} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label>Movement Type *</label>
              <select className="form-control" {...regS('movement_type', { required: true })}>
                {MOVEMENT_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input type="number" className={`form-control${errS.quantity ? ' input-error' : ''}`} placeholder="50"
                {...regS('quantity', {
                  required: 'Required',
                  min: { value: 1, message: 'Must be ≥ 1' },
                  validate: v => Number.isInteger(Number(v)) || 'Must be a whole number',
                })} />
              {errS.quantity && <span className="field-error">{errS.quantity.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Reference Number</label>
            <input className="form-control" placeholder="e.g. GRN-001" {...regS('reference_number')} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input className="form-control" placeholder="Optional notes" {...regS('notes')} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStockOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={savingS}>
              {savingS ? <span className="spinner" /> : 'Update Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Product Detail Modal ── */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="📋 Product Detail" wide>
        <div className="modal-body">
          {!detailData
            ? <div className="loading-box"><span className="spinner spinner-dark" /></div>
            : (
            <>
              <div className="detail-grid">
                <div><b>SKU:</b> <code>{detailData.sku}</code></div>
                <div><b>Name:</b> {detailData.name}</div>
                <div><b>Category:</b> <CategoryBadge cat={detailData.category} /></div>
                <div><b>Unit Price:</b> ₹{detailData.unit_price}</div>
                <div><b>Cost Price:</b> ₹{detailData.cost_price}</div>
                <div><b>UOM:</b> {detailData.unit_of_measure}</div>
                <div><b>Reorder Point:</b> {detailData.reorder_point}</div>
                <div>
                  <b>On Hand:</b> {detailData.stock_level?.quantity_on_hand ?? 0}
                  &nbsp;|&nbsp;
                  <b>Available:</b> {detailData.stock_level?.quantity_available ?? 0}
                </div>
              </div>

              <div className="section-title">📦 Stock Movements</div>
              {!detailData.movements?.length
                ? <p style={{ color: 'var(--muted)', paddingBottom: 12 }}>No movements recorded yet.</p>
                : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Type</th><th>Qty</th><th>Reference</th><th>Notes</th><th>Recorded At</th></tr></thead>
                    <tbody>
                      {[...detailData.movements].reverse().map(m => (
                        <tr key={m.id}>
                          <td><span className="badge badge-blue">{m.movement_type}</span></td>
                          <td>{m.quantity}</td>
                          <td>{m.reference_number || '—'}</td>
                          <td>{m.notes || '—'}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{new Date(m.recorded_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="form-actions">
                <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>Close</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Layout>
  )
}
