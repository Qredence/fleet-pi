import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  LoginPage,
  LoginPageLoading,
} from "@workspace/hax-design/components/fleet-pi/auth/login-page"
import { toast } from "sonner"
import { signIn, signUp, useSession } from "@/lib/auth/use-auth"
import { isLocalAnonymousAuthAllowed } from "@/lib/auth/auth-mode"

export const Route = createFileRoute("/login")({ component: LoginRoute })

function LoginRoute() {
  const navigate = useNavigate()
  const { data: session, isPending: sessionLoading } = useSession()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      void navigate({ to: "/" })
    }
  }, [session, navigate])

  if (sessionLoading || session) {
    return <LoginPageLoading />
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
    <LoginPage
      mode={mode}
      email={email}
      password={password}
      name={name}
      loading={loading}
      error={error}
      title={mode === "signin" ? "Sign in" : "Create account"}
      subtitle={
        mode === "signin"
          ? "Sign in to your account"
          : "Create a new account to get started"
      }
      submitLabel={mode === "signin" ? "Sign in" : "Create account"}
      loadingLabel="Please wait..."
      googleButtonLabel="Continue with Google"
      toggleModeLabel={
        mode === "signin"
          ? "Don't have an account? Sign up"
          : "Already have an account? Sign in"
      }
      onModeChange={(nextMode) => {
        setMode(nextMode)
        setError(null)
      }}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onNameChange={setName}
      onEmailSubmit={handleEmailSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      onContinueWithoutAuth={
        isLocalAnonymousAuthAllowed()
          ? () => void navigate({ to: "/" })
          : undefined
      }
    />
  )
}
