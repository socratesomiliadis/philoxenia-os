"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { LoaderCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode, ComponentProps } from "react";

export function ActionButton({ children, busy, ...props }: Omit<ComponentProps<typeof Button>, "children"> & { busy?: boolean; children: ReactNode }) {
  return <Button {...props} isDisabled={props.isDisabled || busy} className={`min-h-11 rounded-xl bg-forest px-5 text-sm font-medium text-white ${props.className ?? ""}`}>
    {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}{children}
  </Button>;
}

export function Field({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  return <TextField className="w-full space-y-2" isRequired={props.required}>
    <Label className="text-sm font-medium text-forest">{label}</Label>
    <Input {...props} className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10" />
  </TextField>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
    <div><p className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">{eyebrow}</p>
      <h1 className="font-display text-4xl tracking-tight text-forest sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{description}</p></div>
    {action}
  </div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "gold" }) {
  const colors = { neutral: "bg-stone-100 text-muted", green: "bg-forest/7 text-forest", gold: "bg-gold/15 text-[#76581b]" };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${colors[tone]}`}>{children}</span>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm font-medium text-forest hover:underline">{children}<ArrowUpRight className="size-4" aria-hidden /></Link>;
}

export function InlineError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p> : null;
}

export function LoadingState({ label = "Opening your workspace…" }: { label?: string }) {
  return <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted"><LoaderCircle className="size-6 animate-spin text-forest" aria-hidden /><p className="text-sm">{label}</p></div>;
}

export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") return error.data;
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
