import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'danger-quiet' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  loadingText?: string
  icon?: ReactNode
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-ivory hover:bg-ink-soft shadow-soft',
  outline: 'border border-champagne/70 text-ink bg-transparent hover:bg-champagne-light/40',
  ghost: 'text-ink-soft hover:bg-cream hover:text-ink',
  danger: 'bg-rose text-white hover:bg-rose/90 shadow-soft',
  /** Delete / remove buttons that don't need to shout: rose text, rose tint on hover. */
  'danger-quiet': 'text-rose hover:bg-rose/10',
  subtle: 'bg-cream text-ink hover:bg-linen',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3.5 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-[0.95rem] gap-2',
  lg: 'min-h-14 px-8 text-base gap-2.5 tracking-[0.14em] uppercase',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, loadingText, icon, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-ui="button"
      className={cn(
        'inline-flex select-none items-center justify-center rounded-md font-medium transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  )
})
