import { NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { path: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { path: '/products',  icon: '📋', label: 'Products' },
  { path: '/suppliers', icon: '🏭', label: 'Suppliers' },
  { path: '/orders',    icon: '🛒', label: 'Purchase Orders' },
  { path: '/alerts',    icon: '🔔', label: 'Stock Alerts' },
]

const ROLE_BADGE = { manager: 'badge-purple', admin: 'badge-indigo', staff: 'badge-gray' }

export default function Layout({ children, title, subtitle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() { logout(); navigate('/') }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">📦</div>
          <h2>InvenTrack</h2>
          <p>Inventory Management</p>
        </div>
        <div className="brand-divider" />
        <nav>
          {NAV.map(item => (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) => isActive ? 'active' : undefined}>
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="user-info">
          <div className="user-divider" />
          {/* Clicking the user card navigates to profile */}
          <Link to="/profile" className="user-profile-link">
            <div className="user-avatar">{(user?.full_name || user?.email || 'U')[0].toUpperCase()}</div>
            <div>
              <span className="user-name">{user?.full_name || user?.email}</span>
              <span className={`badge ${ROLE_BADGE[user?.role] || 'badge-gray'} user-role-badge`}>{user?.role}</span>
            </div>
          </Link>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      <main className="main">
        {(title || subtitle) && (
          <div className="page-header">
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
