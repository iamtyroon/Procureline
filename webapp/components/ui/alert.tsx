import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  autoDismissMs?: number
  closeLabel?: string
  dismissKey?: string
  dismissible?: boolean
  onDismiss?: () => void
}

const Alert = React.forwardRef<
  HTMLDivElement,
  AlertProps
>(
  (
    {
      children,
      autoDismissMs,
      className,
      closeLabel = "Dismiss alert",
      dismissKey,
      dismissible = false,
      onDismiss,
      variant,
      ...props
    },
    ref
  ) => {
    const [isDismissed, setIsDismissed] = React.useState(false)
    const onDismissRef = React.useRef(onDismiss)

    React.useEffect(() => {
      onDismissRef.current = onDismiss
    }, [onDismiss])

    React.useEffect(() => {
      if (dismissible) {
        setIsDismissed(false)
      }
    }, [dismissKey, dismissible])

    React.useEffect(() => {
      if (!dismissible || !autoDismissMs || autoDismissMs <= 0) {
        return
      }

      const timeoutId = window.setTimeout(() => {
        setIsDismissed(true)
        onDismissRef.current?.()
      }, autoDismissMs)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }, [autoDismissMs, dismissKey, dismissible])

    if (dismissible && isDismissed) {
      return null
    }

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          alertVariants({ variant }),
          dismissible && "pr-12",
          className
        )}
        {...props}
      >
        {dismissible ? (
          <button
            type="button"
            aria-label={closeLabel}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-current/70 transition-colors hover:bg-black/5 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10"
            onClick={() => {
              setIsDismissed(true)
              onDismiss?.()
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {children}
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-alert-description
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
