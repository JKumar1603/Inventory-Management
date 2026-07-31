import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import Layout from '../components/Layout'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ROLE_COLOR = { manager: 'badge-purple', admin: 'badge-indigo', staff: 'badge-gray' }
const ROLE_DESC  = { manager: 'Full write access', admin: 'Full access + settings', staff: 'Read-only access' }

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [profileData, setProfileData] = useState(null)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  useEffect(() => {
    api.get('/auth/me').then(r => {
      setProfileData(r.data)
      reset({ full_name: r.data.full_name, phone: r.data.phone || '', address: r.data.address || '' })
    }).catch(() => {})
  }, [reset])

  async function onSave(data) {
    setSaving(true)
    try {
      await api.patch('/auth/me', {
        full_name: data.full_name || null,
        phone: data.phone || null,
        address: data.address || null,
      })
      await refreshUser()
      toast('Profile updated successfully', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'Update failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const initial = (user?.full_name || user?.email || 'U')[0].toUpperCase()
  const role = user?.role || 'staff'

  return (
    <Layout title="My Profile" subtitle="Manage your account information">
      {/* ── Profile header card ── */}
      <div className="profile-header">
        <div className="profile-avatar">{initial}</div>
        <div className="profile-info">
          <div className="profile-name">{user?.full_name || '—'}</div>
          <div className="profile-email">{user?.email}</div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${ROLE_COLOR[role] || 'badge-gray'}`}>{role}</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>{ROLE_DESC[role]}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        {/* ── Edit profile form ── */}
        <div className="card">
          <div className="section-title">✏️ Edit Profile</div>
          <form onSubmit={handleSubmit(onSave)} noValidate>
            <div className="form-group">
              <label>Full Name</label>
              <input className={`form-control${errors.full_name ? ' input-error' : ''}`}
                placeholder="Your full name"
                {...register('full_name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'At least 2 characters' },
                })} />
              {errors.full_name && <span className="field-error">{errors.full_name.message}</span>}
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input className={`form-control${errors.phone ? ' input-error' : ''}`}
                placeholder="+91 98765 43210" type="tel"
                {...register('phone', {
                  pattern: { value: /^[+\d\s\-()]{7,20}$/, message: 'Enter a valid phone number' },
                })} />
              {errors.phone && <span className="field-error">{errors.phone.message}</span>}
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea className="form-control" rows={3} placeholder="Your address (optional)"
                {...register('address')} style={{ resize: 'vertical', minHeight: 72 }} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Account info (read-only) ── */}
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="section-title">🔐 Account Details</div>
            <div className="profile-info-grid">
              <div className="profile-info-row"><span>Email</span><strong>{profileData?.email || '—'}</strong></div>
              <div className="profile-info-row"><span>Role</span><span className={`badge ${ROLE_COLOR[role] || 'badge-gray'}`}>{role}</span></div>
              <div className="profile-info-row"><span>Status</span><span className="badge badge-green">Active</span></div>
              <div className="profile-info-row"><span>Phone</span><strong>{profileData?.phone || 'Not set'}</strong></div>
              <div className="profile-info-row"><span>Address</span><strong style={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>{profileData?.address || 'Not set'}</strong></div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">🔑 Access Permissions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <PermRow label="View Products & Suppliers" allowed />
              <PermRow label="View Purchase Orders" allowed />
              <PermRow label="Create / Edit Products" allowed={role !== 'staff'} />
              <PermRow label="Create Purchase Orders" allowed={role !== 'staff'} />
              <PermRow label="Receive PO & Update Stock" allowed={role !== 'staff'} />
              <PermRow label="View Dashboard Analytics" allowed={role !== 'staff'} />
              <PermRow label="View Low-Stock Alerts" allowed={role !== 'staff'} />
              <PermRow label="Admin Settings" allowed={role === 'admin'} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function PermRow({ label, allowed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text)' }}>{label}</span>
      <span style={{ color: allowed ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: '0.82rem' }}>
        {allowed ? '✓ Allowed' : '✗ Restricted'}
      </span>
    </div>
  )
}
