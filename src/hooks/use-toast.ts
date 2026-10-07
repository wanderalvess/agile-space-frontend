"use client"

// Compat shim: mantém a API `toast({ title, description, variant })` usada em
// todo o app, mas renderiza tudo via Sonner (único <Toaster/> montado no
// layout). Evita ter dois sistemas de toast rodando em paralelo.
import * as React from "react"
import { toast as sonnerToast } from "sonner"

type ToastAction = {
  label: React.ReactNode
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
}

type Toast = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive"
  duration?: number
  action?: ToastAction
}

function toast({ title, description, variant, duration, action }: Toast) {
  const options = { description, duration, action }
  const id =
    variant === "destructive"
      ? sonnerToast.error(title, options)
      : sonnerToast(title, options)

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
  }
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  }
}

export { useToast, toast }
