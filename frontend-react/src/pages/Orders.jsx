import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import api from '../api/client'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const STATUS_BADGE = { draft:'badge-gray', submitted:'badge-blue', acknowledged:'badge-purple', received:'badge-green', cancelled:'badge-red' }

function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_BADGE[status] || 'badge-gray'}`}>{status}</span>
}

export default function Orders() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isManager = user?.role === 'manager' || user?.role === 'admin'
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [suppliersMap, setSuppliersMap] = useState({})
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders')
      setOrders(res.data)
    } catch { toast('Failed to load orders', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    loadOrders()
    api.get('/suppliers').then(r => {
      setSuppliers(r.data)
      const m = {}; r.data.forEach(s => { m[s.id] = s }); setSuppliersMap(m)
    }).catch(() => {})
    api.get('/products').then(r => setAllProducts(r.data)).catch(() => {})
  }, [loadOrders])

  const filtered = statusFilter ? orders.filter(o => o.status === statusFilter) : orders

  // ── Status transitions ────────────────────────────────────
  async function transitionPO(id, status) {
    try {
      await api.patch(`/orders/${id}/status`, { status })
      toast(`PO ${status}`, 'success'); loadOrders()
    } catch (err) { toast(err.response?.data?.detail || 'Failed', 'error') }
  }

  async function receivePO(id, po_number) {
    if (!window.confirm(`Mark ${po_number} as received? Stock will be updated automatically.`)) return
    try {
      await api.patch(`/orders/${id}/receive`)
      toast('PO received — stock updated', 'success'); loadOrders()
    } catch (err) { toast(err.response?.data?.detail || 'Failed to receive PO', 'error') }
  }

  // ── Create PO form ────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm({
    defaultValues: { supplier_id: '', order_date: today, expected_delivery: '', items: [{ product_id: '', quantity_ordered: 1, unit_cost: 0 }] }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchedItems = watch('items')
  const total = watchedItems?.reduce((s, it) => s + (parseFloat(it.quantity_ordered) || 0) * (parseFloat(it.unit_cost) || 0), 0) || 0

  function handleProductChange(index, productId) {
    const p = allProducts.find(x => x.id === parseInt(productId))
    if (p) setValue(`items.${index}.unit_cost`, p.cost_price)
  }

  async function onCreatePO(data) {
    const items = data.items.map(it => ({
      product_id: parseInt(it.product_id),
      quantity_ordered: parseInt(it.quantity_ordered),
      unit_cost: parseFloat(it.unit_cost),
    }))
    try {
      await api.post('/orders', {
        supplier_id: parseInt(data.supplier_id),
        order_date: data.order_date,
        expected_delivery: data.expected_delivery || null,
        items,
      })
      toast('Purchase order created', 'success')
      reset({ supplier_id: '', order_date: today, expected_delivery: '', items: [{ product_id: '', quantity_ordered: 1, unit_cost: 0 }] })
      setCreateOpen(false); loadOrders()
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to create PO', 'error')
    }
  }

  function openDetail(po) { setSelectedPO(po); setDetailOpen(true) }

  return (
    <Layout title="Purchase Orders" subtitle="Raise and manage purchase orders with suppliers">
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {['draft','submitted','acknowledged','received','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {isManager && (
            <button className="btn btn-primary" onClick={() => { reset({ supplier_id:'', order_date:today, expected_delivery:'', items:[{product_id:'',quantity_ordered:1,unit_cost:0}] }); setCreateOpen(true) }}>
              + New Purchase Order
            </button>
          )}
        </div>
        {!isManager && <div className="role-notice">🔒 Read-only mode. Contact a Manager to create purchase orders.</div>}

        <div className="table-wrap">
          {loading
            ? <div className="loading-box"><span className="spinner spinner-dark" /> Loading…</div>
            : (
            <table>
              <thead><tr><th>PO Number</th><th>Supplier</th><th>Order Date</th><th>Exp. Delivery</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {[...filtered].reverse().length === 0
                  ? <tr><td colSpan={7} className="empty-cell">No purchase orders found.</td></tr>
                  : [...filtered].reverse().map(o => (
                    <tr key={o.id}>
                      <td><b>{o.po_number}</b></td>
                      <td>{suppliersMap[o.supplier_id]?.name || o.supplier_id}</td>
                      <td>{o.order_date}</td>
                      <td>{o.expected_delivery || '—'}</td>
                      <td>₹{o.total_amount.toLocaleString('en-IN')}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td>
                        <div className="action-btns">
                          <button className="btn btn-sm btn-ghost" onClick={() => openDetail(o)}>Detail</button>
                            {isManager && o.status === 'draft'       && <button className="btn btn-sm btn-outline" onClick={() => transitionPO(o.id,'submitted')}>Submit</button>}
                            {isManager && o.status === 'submitted'   && <button className="btn btn-sm btn-outline" onClick={() => transitionPO(o.id,'acknowledged')}>Acknowledge</button>}
                            {isManager && (o.status === 'submitted' || o.status === 'acknowledged') &&
                            <button className="btn btn-sm btn-success" onClick={() => receivePO(o.id, o.po_number)}>Receive</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Create PO Modal ── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Purchase Order" wide>
        <form onSubmit={handleSubmit(onCreatePO)} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label>Supplier *</label>
              <select className={`form-control${errors.supplier_id ? ' input-error' : ''}`}
                {...register('supplier_id', { required: 'Supplier is required' })}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>)}
              </select>
              {errors.supplier_id && <span className="field-error">{errors.supplier_id.message}</span>}
            </div>
            <div className="form-group">
              <label>Order Date *</label>
              <input type="date" className={`form-control${errors.order_date ? ' input-error' : ''}`}
                {...register('order_date', { required: 'Order date is required' })} />
              {errors.order_date && <span className="field-error">{errors.order_date.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Expected Delivery</label>
            <input type="date" className="form-control" {...register('expected_delivery')} />
          </div>

          <div className="section-title" style={{ marginTop: 10 }}>Line Items</div>
          {fields.map((field, index) => (
            <div className="po-item-row" key={field.id}>
              <div className="form-group">
                {index === 0 && <label>Product *</label>}
                <select
                  className={`form-control${errors.items?.[index]?.product_id ? ' input-error' : ''}`}
                  {...register(`items.${index}.product_id`, { required: 'Required' })}
                  onChange={e => handleProductChange(index, e.target.value)}>
                  <option value="">Select product…</option>
                  {allProducts.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                {errors.items?.[index]?.product_id && <span className="field-error">{errors.items[index].product_id.message}</span>}
              </div>
              <div className="form-group">
                {index === 0 && <label>Qty *</label>}
                <input type="number"
                  className={`form-control${errors.items?.[index]?.quantity_ordered ? ' input-error' : ''}`}
                  {...register(`items.${index}.quantity_ordered`, { required: 'Required', min: { value: 1, message: 'Min 1' } })} />
                {errors.items?.[index]?.quantity_ordered && <span className="field-error">{errors.items[index].quantity_ordered.message}</span>}
              </div>
              <div className="form-group">
                {index === 0 && <label>Unit Cost (₹) *</label>}
                <input type="number" step="0.01"
                  className={`form-control${errors.items?.[index]?.unit_cost ? ' input-error' : ''}`}
                  {...register(`items.${index}.unit_cost`, { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
                {errors.items?.[index]?.unit_cost && <span className="field-error">{errors.items[index].unit_cost.message}</span>}
              </div>
              <button type="button" className="remove-item-btn" onClick={() => remove(index)} disabled={fields.length === 1}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => append({ product_id: '', quantity_ordered: 1, unit_cost: 0 })}>
            + Add Item
          </button>
          {total > 0 && <div className="po-total">Total: ₹{total.toLocaleString('en-IN')}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <span className="spinner" /> : 'Create PO'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── PO Detail Modal ── */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Purchase Order Detail" wide>
        {selectedPO && (
          <div className="modal-body">
            <div className="detail-grid">
              <div><b>PO Number:</b> <b style={{ color: 'var(--primary)' }}>{selectedPO.po_number}</b></div>
              <div><b>Status:</b> <StatusBadge status={selectedPO.status} /></div>
              <div><b>Supplier:</b> {suppliersMap[selectedPO.supplier_id]?.name || selectedPO.supplier_id}</div>
              <div><b>Total:</b> ₹{selectedPO.total_amount.toLocaleString('en-IN')}</div>
              <div><b>Order Date:</b> {selectedPO.order_date}</div>
              <div><b>Expected Delivery:</b> {selectedPO.expected_delivery || '—'}</div>
              <div><b>Received Date:</b> {selectedPO.received_date || '—'}</div>
            </div>
            <div className="section-title">Line Items</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product ID</th><th>Qty Ordered</th><th>Unit Cost</th><th>Line Total</th><th>Qty Received</th></tr></thead>
                <tbody>
                  {selectedPO.items?.map(item => (
                    <tr key={item.id}>
                      <td>{item.product_id}</td>
                      <td>{item.quantity_ordered}</td>
                      <td>₹{item.unit_cost}</td>
                      <td>₹{(item.quantity_ordered * item.unit_cost).toLocaleString('en-IN')}</td>
                      <td>{item.quantity_received ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
