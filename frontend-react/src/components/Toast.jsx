import { useToast } from '../context/ToastContext'

export default function Toast() {
  const { toasts } = useToast()
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
