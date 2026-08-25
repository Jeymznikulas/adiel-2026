import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'soft'
export type ButtonSize = 'compact' | 'small' | 'medium' | 'large'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'ui-button--primary',
  secondary: 'ui-button--secondary',
  ghost: 'ui-button--ghost',
  danger: 'ui-button--danger',
  destructive: 'ui-button--destructive',
  soft: 'ui-button--soft',
}

const sizeClasses: Record<ButtonSize, string> = {
  compact: 'ui-button--compact',
  small: 'ui-button--small',
  medium: 'ui-button--medium',
  large: 'ui-button--large',
}

export function Button({
  variant = 'secondary',
  size = 'medium',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="ui-button__icon" aria-hidden="true">{leadingIcon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
      {trailingIcon ? <span className="ui-button__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  size?: 'small' | 'medium'
  variant?: Exclude<ButtonVariant, 'primary' | 'destructive'>
}

export function IconButton({ label, size = 'medium', variant = 'ghost', className = '', type = 'button', children, ...props }: IconButtonProps) {
  return (
    <button
      className={`ui-icon-button ui-icon-button--${size} ${variantClasses[variant]} ${className}`}
      type={type}
      aria-label={label}
      title={props.title ?? label}
      {...props}
    >
      {children}
    </button>
  )
}
