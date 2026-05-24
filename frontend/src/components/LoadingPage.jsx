export default function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="flex flex-col items-center gap-6">
        <div className="h-20 w-20 rounded-2xl bg-[hsl(var(--primary))] flex items-center justify-center shadow-lg">
          <img src="/sibaritco-logo.svg" alt="Sibarítco" className="h-12 w-12 object-contain" />
        </div>

        <div className="h-10 w-10 rounded-full border-4 border-[hsl(var(--primary))/20] border-t-[hsl(var(--primary))] animate-spin" />

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-extrabold text-[hsl(var(--primary))] tracking-tight">SibaGestion</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
        </div>
      </div>
    </div>
  )
}
