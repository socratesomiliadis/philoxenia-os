"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useModalNotifications } from "./notification-context";
import { cn } from "@/lib/utils";
import { ActionButton, InlineError } from "./ui";

export function WorkspaceDialog({ title, children, onClose, footer, size = "default", wide = false, busy = false, closeLabel = "Close dialog", className, bodyClassName }: {
  title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; size?: "compact" | "default" | "large"; wide?: boolean; busy?: boolean; closeLabel?: string; className?: string; bodyClassName?: string;
}) {
  useModalNotifications();
  const width = { compact: "sm:max-w-xl", default: "sm:max-w-3xl", large: "sm:max-w-5xl" }[size];
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent aria-label={title} showCloseButton={false} className={cn("top-1/2 bottom-auto flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-y-1/2 flex-col gap-0 overflow-hidden surface-overlay rounded-[24px] p-0 text-foreground shadow-lg ring-0 motion-reduce:animate-none sm:max-h-[calc(100dvh-4rem)]", width, wide && "h-[calc(100dvh-2rem)] sm:max-w-[1440px]", className)}>
      <DialogClose disabled={busy} aria-label={closeLabel} render={<Button variant="ghost" size="icon-sm" className="absolute end-4 top-4 text-muted-foreground sm:end-6 sm:top-5" />}><X className="size-4" aria-hidden /></DialogClose>
      <DialogHeader className="shrink-0 px-5 py-5 pe-14 sm:px-8 sm:py-6 sm:pe-16"><DialogTitle className="text-xl leading-7 font-medium tracking-tight text-foreground wrap-anywhere sm:text-2xl sm:leading-8">{title}</DialogTitle></DialogHeader>
      <div data-slot="workspace-dialog-body" className={cn("scrollbar-thin min-h-0 flex-1 scroll-py-6 overflow-y-auto overscroll-contain px-5 py-6 text-sm leading-6 text-muted-foreground wrap-anywhere [scrollbar-gutter:stable] sm:px-8", bodyClassName)}>{children}</div>
      {footer ? <div data-slot="workspace-dialog-footer" className="shrink-0 px-5 py-4 sm:px-8 sm:py-5">{footer}</div> : null}
    </DialogContent>
  </Dialog>;
}

export function DialogFormActions({ formId, onClose, busy, label, error, disabled, danger = false }: {
  formId: string; onClose: () => void; busy?: boolean; label: ReactNode; error?: string | null; disabled?: boolean; danger?: boolean;
}) {
  return <div className="space-y-3"><InlineError message={error ?? null} /><div className="flex flex-wrap justify-end gap-3"><ActionButton appearance="secondary" disabled={busy} onClick={onClose}>Cancel</ActionButton><ActionButton form={formId} type="submit" appearance={danger ? "danger" : "primary"} busy={busy} disabled={disabled}>{label}</ActionButton></div></div>;
}
