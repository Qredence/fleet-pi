import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "sonner"
import { signIn, signUp, useSession } from "@/lib/auth/use-auth"

export const Route = createFileRoute("/login")({ component: LoginPage })

function LoginPage() {
  const navigate = useNavigate()
  const { data: session, isPending: sessionLoading } = useSession()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sessionLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" />
      </div>
    )
  }

  if (session) {
    void navigate({ to: "/" })
    return null
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === "signup") {
        const { error: signUpError } = await signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        })
        if (signUpError) {
          setError(signUpError.message ?? "Sign up failed")
          return
        }
        toast.success("Account created")
      } else {
        const { error: signInError } = await signIn.email({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message ?? "Sign in failed")
          return
        }
      }
      void navigate({ to: "/" })
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    await signIn.social({
      provider: "google",
      callbackURL: "/",
    })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your account"
              : "Create a new account to get started"}
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === "signup" && (
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
          />

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          onClick={handleGoogleSignIn}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="space-y-2 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin")
              setError(null)
            }}
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
          <div>
            <button
              type="button"
              onClick={() => void navigate({ to: "/" })}
              className="text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Continue without signing in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
