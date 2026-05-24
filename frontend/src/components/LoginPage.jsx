import { useState } from 'react'
import { Eye, EyeOff, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    errorMessage,
    successMessage,
    handleSubmit,
  } = login

  const [showPassword, setShowPassword] = useState(false)

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center gap-7 px-4 py-10"
      style={{
        backgroundImage: "url('/sibaritco-logo.svg')",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: '40%',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-white/92" />

      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] shadow-lg">
          <Building2 className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-[hsl(var(--primary))]">SibaGestion</h1>
        <p className="text-base text-emerald-500">Sistema de Gestión Integral</p>
      </div>

      <section
        aria-label="Formulario de inicio de sesión"
        className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--primary-border,150,50%,75%))] bg-white/80 p-7 shadow-xl backdrop-blur-sm"
      >
        <h2 className="mb-5 text-center text-2xl font-bold text-[hsl(var(--foreground))]">Iniciar Sesión</h2>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@empresa.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--primary))] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="mt-1 h-12 text-base" disabled={isLoading || !email || !password}>
            {isLoading ? 'Validando...' : 'Entrar'}
          </Button>

          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}
