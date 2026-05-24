import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLocals } from '../hooks/useLocals'
import { Home, LogOut, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function WorkerLocalSelector() {
  const { user, userRole, logout } = useAuth()
  const navigate = useNavigate()
  const { locales, loading, error } = useLocals()

  const handleSelectLocal = (local) => {
    navigate(`/local/${local.id}/pos`)
  }

  return (
    <main className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[hsl(var(--primary))/20] bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]">
              <img src="/sibaritco-logo.svg" alt="Sibarítco" className="h-6 w-6 object-contain" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-[hsl(var(--primary))] leading-tight">
                POS — Selecciona tu Local
              </h1>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Acceso rápido al sistema</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{user?.email}</span>
              <Badge variant="ghost" className="text-[10px]">{userRole || 'Empleado'}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <section className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-extrabold text-[hsl(var(--primary))] tracking-tight">
              Selecciona tu local
            </h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Serás dirigido directamente al sistema POS
            </p>
          </div>

          {loading && <LoadingSpinner message="Cargando locales..." />}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Error al cargar locales: {error}
            </div>
          )}

          {!loading && !error && locales.length === 0 && (
            <div className="rounded-lg border border-[hsl(var(--border))] bg-white px-6 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No hay locales disponibles para tu cuenta.
            </div>
          )}

          {!loading && !error && locales.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {locales.map((local, i) => (
                <button
                  key={local.id}
                  type="button"
                  onClick={() => handleSelectLocal(local)}
                  className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)} group flex items-center gap-4 rounded-xl border bg-white p-5 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[hsl(var(--primary))/40] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))] transition-colors group-hover:bg-[hsl(var(--primary))] group-hover:text-white">
                    <Home className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block font-bold text-[hsl(var(--foreground))] truncate">{local.name}</span>
                    {local.address && (
                      <span className="block text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                        {local.address}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 text-[hsl(var(--muted-foreground))] shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--primary))]" />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
