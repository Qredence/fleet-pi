import { Eye, EyeOff, Lock } from "lucide-react"
import { useId } from "react"
import { Field, FieldLabel } from "../../../../field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../../../input-group"
import { cn } from "../../../../../lib/utils"
import { HIT_AREA_EXPAND_CLASS } from "../../../styles/tokens"
import type { LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

/** Invalid only after an attempted save — never paint empty fields red on open. */
export function isFieldInvalid(
  value: string,
  attemptedSave: boolean,
  required = true
): boolean {
  return attemptedSave && required && value.trim().length === 0
}

function CredentialInputField({
  attemptedSave,
  autoComplete,
  icon: Icon,
  inputType,
  label,
  onChange,
  placeholder,
  required = true,
  trailingAddon,
  value,
}: {
  attemptedSave: boolean
  autoComplete?: ComponentProps<"input">["autoComplete"]
  icon: LucideIcon
  inputType: ComponentProps<"input">["type"]
  label: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  trailingAddon?: ReactNode
  value: string
}) {
  const controlId = useId()
  const invalid = isFieldInvalid(value, attemptedSave, required)

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Icon />
        </InputGroupAddon>
        <InputGroupInput
          id={controlId}
          type={inputType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          aria-invalid={invalid || undefined}
        />
        {trailingAddon}
      </InputGroup>
    </Field>
  )
}

export function SecretCredentialField({
  attemptedSave,
  label,
  onChange,
  onToggleVisibility,
  placeholder,
  required = true,
  showPassword,
  value,
}: {
  attemptedSave: boolean
  label: string
  onChange: (value: string) => void
  onToggleVisibility: () => void
  placeholder: string
  required?: boolean
  showPassword: boolean
  value: string
}) {
  return (
    <CredentialInputField
      attemptedSave={attemptedSave}
      autoComplete="off"
      icon={Lock}
      inputType={showPassword ? "text" : "password"}
      label={label}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      value={value}
      trailingAddon={
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            className={cn(
              HIT_AREA_EXPAND_CLASS,
              "transition-[background-color,transform] duration-150 active:scale-[0.96]"
            )}
            aria-label={showPassword ? "Hide value" : "Show value"}
            onClick={onToggleVisibility}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      }
    />
  )
}

export function TextCredentialField({
  attemptedSave,
  icon,
  inputType = "text",
  label,
  onChange,
  placeholder,
  required = true,
  value,
}: {
  attemptedSave: boolean
  icon: LucideIcon
  inputType?: ComponentProps<"input">["type"]
  label: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  value: string
}) {
  return (
    <CredentialInputField
      attemptedSave={attemptedSave}
      icon={icon}
      inputType={inputType}
      label={label}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      value={value}
    />
  )
}
