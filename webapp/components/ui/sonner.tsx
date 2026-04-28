"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      closeButton
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-primary/30 group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-xl group-[.toaster]:shadow-black/20",
          closeButton:
            "group-[.toast]:border-border/80 group-[.toast]:bg-popover group-[.toast]:text-foreground group-[.toast]:hover:bg-muted group-[.toast]:hover:text-foreground",
          description: "group-[.toast]:text-foreground/80",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
