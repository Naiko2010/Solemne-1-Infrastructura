import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import { useMesasConEstado } from '../../hooks/useMesasConEstado'
import MesasKPICards from './MesasKPICards'
import MesasFilters from './MesasFilters'
import MesasVisualization from './MesasVisualization'
import CreateMesaModal from './CreateMesaModal'
import EditMesaModal from './EditMesaModal'
import DeleteMesaModal from './DeleteMesaModal'
import ReportesModal from './ReportesModal'
import MenuModal from './MenuModal'
import MesaDetailModal from './MesaDetailModal'
import { useAuth } from '../../context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function POSModule() {
  const { isWorker } = useAuth()
  const navigate = useNavigate()
  const { localId } = useParams()
  const { mesas, loading: mesasLoading, createMesa, updateMesa, deleteMesa, refresh: refreshMesas } = useMesasConEstado(localId)
  const [showModal, setShowModal] = useState(false)
  const [filteredMesas, setFilteredMesas] = useState([])
  const [editingMesa, setEditingMesa] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingMesa, setDeletingMesa] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [showReportes, setShowReportes] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedMesaDetail, setSelectedMesaDetail] = useState(null)
  const [showMesaDetail, setShowMesaDetail] = useState(false)
  const kpiRefreshRef = useRef(null)

  const selectedLocal = useSelectedLocal(localId, 'locales-only')

  const handleSubmitMesa = async (formData) => {
    await createMesa(formData)
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleMesaSelect = (mesa) => {
    setSelectedMesaDetail(mesa)
    setShowMesaDetail(true)
  }

  const handleMesaDetailClose = () => {
    setShowMesaDetail(false)
    setSelectedMesaDetail(null)
  }

  const handleTableUpdated = () => {
    refreshMesas()
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleFilteredMesasChange = (filtered, activeFilters) => {
    setFilteredMesas(filtered)
  }

  const handleEditMesa = (mesa) => {
    setEditingMesa(mesa)
    setShowEditModal(true)
  }

  const handleUpdateMesa = async (formData) => {
    try {
      setIsUpdating(true)
      await updateMesa({
        id: formData.id,
        name: formData.name,
        capacidad: formData.capacidad,
        zona: formData.zona,
        is_active: formData.is_active,
      })
      setShowEditModal(false)
      setEditingMesa(null)
      if (kpiRefreshRef.current) kpiRefreshRef.current()
    } catch (error) {
      console.error('Error updating mesa:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteMesa = (mesa) => {
    setDeleteError(null)
    setDeletingMesa(mesa)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingMesa) return
    try {
      setIsDeleting(true)
      setDeleteError(null)
      await deleteMesa(deletingMesa.id)
      setShowDeleteModal(false)
      setDeletingMesa(null)
      if (kpiRefreshRef.current) kpiRefreshRef.current()
    } catch (error) {
      console.error('Error deleting mesa:', error)
      let errorMsg = 'Error al eliminar la mesa'
      if (error.message) {
        const match = error.message.match(/^\d+:\s*(.+)$/)
        errorMsg = match ? match[1] : error.message
      }
      setDeleteError(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Topbar */}
      <header className="flex items-center justify-between px-6 h-14 shrink-0 border-b border-[hsl(var(--border))] bg-white">
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] leading-none">
            {selectedLocal?.name || 'Local'}
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Punto de venta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowMenu(true)}>🍽 Menú</Button>
          {!isWorker && (
            <Button variant="outline" size="sm" onClick={() => setShowReportes(true)}>📊 Reportes</Button>
          )}
          {!isWorker && (
            <Button size="sm" onClick={() => setShowModal(true)}>+ Nueva Mesa</Button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <MesasKPICards localId={localId} onRefreshReady={(fn) => { kpiRefreshRef.current = fn }} />

        <section className="space-y-4">
          <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">Visualización de Mesas</h3>
          <MesasFilters mesas={mesas} onFilteredMesasChange={handleFilteredMesasChange} />
          <MesasVisualization
            mesas={filteredMesas.length > 0 ? filteredMesas : mesas}
            loading={mesasLoading}
            onMesaSelect={handleMesaSelect}
            onEditMesa={isWorker ? null : handleEditMesa}
            onDeleteMesa={isWorker ? null : handleDeleteMesa}
          />
        </section>
      </main>

      {showModal && (
        <CreateMesaModal
          mesas={mesas}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitMesa}
        />
      )}

      {showEditModal && editingMesa && (
        <EditMesaModal
          mesa={editingMesa}
          onClose={() => {
            setShowEditModal(false)
            setEditingMesa(null)
          }}
          onSubmit={handleUpdateMesa}
        />
      )}

      {showDeleteModal && deletingMesa && (
        <DeleteMesaModal
          mesa={deletingMesa}
          onClose={() => {
            setShowDeleteModal(false)
            setDeletingMesa(null)
            setDeleteError(null)
          }}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          error={deleteError}
        />
      )}

      {showMenu && (
        <MenuModal localId={localId} onClose={() => setShowMenu(false)} />
      )}

      {showReportes && (
        <ReportesModal localId={localId} onClose={() => setShowReportes(false)} />
      )}

      {showMesaDetail && selectedMesaDetail && (
        <MesaDetailModal
          mesa={selectedMesaDetail}
          localId={localId}
          onClose={handleMesaDetailClose}
          onTableUpdated={handleTableUpdated}
        />
      )}
    </>
  )
}
