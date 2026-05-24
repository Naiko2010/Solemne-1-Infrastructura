import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import CreateLocalModal from './CreateLocalModal'
import LocalsGrid from './LocalsGrid'
import LoadingSpinner from './LoadingSpinner'

function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { locales, loading, error, refetch } = useLocals()

  useEffect(() => {
    if (loading) return
    const st = location.state
    const fid = st?.focusLocalId
    const loc = st?.local
    if (!fid && !loc?.id) return
    if (!locales?.length) return

    let idx = -1
    if (loc?.id) {
      idx = locales.findIndex((l) => String(l.id) === String(loc.id))
    } else if (fid) {
      idx = locales.findIndex((l) => String(l.id) === String(fid))
    }

    const path = location.pathname === '/' ? '/admin' : location.pathname
    if (idx >= 0) {
      const local = locales[idx]
      navigate(`/local/${local.id}/dashboard`, { state: { local }, replace: true })
      return
    }
    navigate(path, { replace: true, state: {} })
  }, [loading, locales, location.state, location.pathname, navigate])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="Cargando locales..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <LocalsGrid
          locales={locales}
          onLocalSelect={(local) => navigate(`/local/${local.id}/dashboard`, { state: { local } })}
          onCreateLocal={() => setIsModalOpen(true)}
        />
      </div>
      <CreateLocalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </>
  )
}

export default AdminDashboard
