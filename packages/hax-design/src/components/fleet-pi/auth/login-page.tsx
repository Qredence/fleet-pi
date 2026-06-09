import { Button } from "../../button"
import { Input } from "../../input"
import { GoogleIcon } from "../icons/google-icon"
import { CenteredLoader } from "../primitives/centered-loader"
import type { FormEvent } from "react"

export type LoginPageProps = {
  mode: "signin" | "signup"
  email: string
  password: string
  name: string
  loading: boolean
  error: string | null
  title: string
  subtitle: string
  continueWithoutAuthLabel?: string
  toggleModeLabel: string
  submitLabel: string
  loadingLabel: string
  googleButtonLabel: string
  onModeChange: (mode: "signin" | "signup") => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onNameChange: (value: string) => void
  onEmailSubmit: (event: FormEvent) => void
  onGoogleSignIn: () => void
  onContinueWithoutAuth: () => void
}

export type LoginPageLoadingProps = {
  className?: string
}

export function LoginPageLoading({ className }: LoginPageLoadingProps) {
  return <CenteredLoader className={className} />
}

export function LoginPage({
  mode,
  email,
  password,
  name,
  loading,
  error,
  title,
  subtitle,
  continueWithoutAuthLabel = "Continue without signing in",
  toggleModeLabel,
  submitLabel,
  loadingLabel,
  googleButtonLabel,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onNameChange,
  onEmailSubmit,
  onGoogleSignIn,
  onContinueWithoutAuth,
}: LoginPageProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <form onSubmit={onEmailSubmit} className="space-y-3">
          {mode === "signup" && (
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
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
            {loading ? loadingLabel : submitLabel}
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
          onClick={onGoogleSignIn}
        >
          <GoogleIcon />
          {googleButtonLabel}
        </Button>

        <div className="space-y-2 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              onModeChange(mode === "signin" ? "signup" : "signin")
            }}
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {toggleModeLabel}
          </button>
          <div>
            <button
              type="button"
              onClick={onContinueWithoutAuth}
              className="text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {continueWithoutAuthLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
