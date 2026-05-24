export default function LoadingSpinner({ message = 'Cargando...' }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
      <div className="h-9 w-9 rounded-full border-4 border-[hsl(var(--primary))/20] border-t-[hsl(var(--primary))] animate-spin" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
    </div>
  )
}
