"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useModalNotifications } from "./notification-context";
import { cn } from "@/lib/utils";

export function WorkspaceDialog({ title, children, onClose, footer, wide = false, closeLabel = "Close dialog", className, bodyClassName }: {
  title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean; closeLabel?: string; className?: string; bodyClassName?: string;
}) {
  useModalNotifications();
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent aria-label={title} showCloseButton={false} className={cn("top-auto bottom-4 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg translate-y-0 flex-col gap-0 overflow-hidden rounded-[24px] bg-white p-5 text-foreground shadow-lg ring-0 sm:top-1/2 sm:bottom-auto sm:max-h-[calc(100dvh-5rem)] sm:max-w-lg sm:-translate-y-1/2 sm:p-7", wide && "h-[calc(100dvh-2rem)] max-w-none sm:max-w-none", className)}>
      <DialogClose aria-label={closeLabel} render={<Button variant="ghost" size="icon-sm" className="absolute end-4 top-4 text-muted-foreground" />}><X className="size-4" aria-hidden /></DialogClose>
      <DialogHeader className="mb-5 shrink-0 pe-8"><DialogTitle className="text-2xl leading-normal font-medium tracking-tight text-foreground wrap-anywhere">{title}</DialogTitle></DialogHeader>
      <div className={cn("scrollbar-thin -mx-[3px] min-h-0 flex-1 overflow-y-auto overscroll-contain px-[3px] text-sm leading-[1.43] text-muted-foreground wrap-anywhere", bodyClassName)}>{children}</div>
      {footer ? <div className="mt-5 block shrink-0 border-t border-line pt-4">{footer}</div> : null}
    </DialogContent>
  </Dialog>;
}
