"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { LoaderCircle, ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode, ComponentProps } from "react";

export function ActionButton({ children, busy, appearance = "primary", className = "", ...props }: Omit<ComponentProps<typeof Button>, "children"> & { busy?: boolean; appearance?: "primary" | "secondary" | "danger"; children: ReactNode }) {
  const colors = { primary: "bg-forest text-accent-foreground hover:bg-forest/90", secondary: "border border-line bg-white text-foreground hover:bg-soft", danger: "bg-red-700 text-white hover:bg-red-800" }[appearance];
  return <Button {...props} aria-busy={busy || undefined} isDisabled={props.isDisabled || busy} className={`min-h-11 rounded-xl px-4 text-sm font-medium shadow-control transition-[background-color,transform] duration-150 ease-ui active:scale-[0.98] disabled:shadow-none ${colors} ${className}`}>
    {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}{children}
  </Button>;
}

export function Field({ label, className = "", ...props }: ComponentProps<typeof Input> & { label: string }) {
  return <TextField className="w-full space-y-2" isRequired={props.required}>
    <Label className="text-sm font-medium text-foreground">{label}</Label>
    <Input {...props} className={`min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm shadow-control transition-colors focus:border-forest focus:ring-2 focus:ring-forest/10 ${className}`} />
  </TextField>;
}

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
    <div className="min-w-0"><h1 className="text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-[34px]">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div>
    {action}
  </div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-[24px] border border-line bg-white ${className}`}>{children}</section>;
}

export function IconTile({ icon: Icon, tone = "neutral", className = "" }: { icon: LucideIcon; tone?: "neutral" | "green" | "warm"; className?: string }) {
  const colors = { neutral: "bg-soft text-muted", green: "bg-soft text-forest", warm: "bg-warm text-[#806832]" };
  return <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${colors[tone]} ${className}`}><Icon className="size-[19px]" strokeWidth={1.7} aria-hidden /></span>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "gold" }) {
  const colors = { neutral: "bg-soft text-muted", green: "bg-sage text-forest", gold: "bg-warm text-[#806832]" };
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-5 ${colors[tone]}`}>{children}</span>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-forest decoration-forest/40 underline-offset-4 hover:underline">{children}<ArrowUpRight className="size-4" aria-hidden /></Link>;
}

export function InlineError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p> : null;
}

export function LoadingState({ label = "Opening your workspace…" }: { label?: string }) {
  return <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted"><LoaderCircle className="size-6 animate-spin text-forest" aria-hidden /><p className="text-sm">{label}</p></div>;
}

export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") return error.data;
  return error instanceof Error ? error.message : "Unable to save changes. Try again.";
}
