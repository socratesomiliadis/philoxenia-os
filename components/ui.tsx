"use client";

import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field as FormField, FieldDescription, FieldLabel } from "./ui/field";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CircleAlert, LoaderCircle, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useModalNotifications } from "./notification-context";
import { controlSurface } from "./ui/control-styles";

export function ActionButton({ children, busy, appearance = "primary", className = "", ...props }: Omit<ComponentProps<typeof Button>, "children"> & { busy?: boolean; appearance?: "primary" | "secondary" | "danger"; children?: ReactNode }) {
  const colors = appearance === "danger" ? "bg-red-700 text-white hover:bg-red-800" : "";
  return <Button variant={appearance === "secondary" ? "secondary" : "default"} {...props} aria-busy={busy || undefined} disabled={props.disabled || busy} className={cn("min-h-11", colors, className)}>
    {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}{children}
  </Button>;
}

export function Field({ label, className = "", id, ...props }: ComponentProps<typeof Input> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <FormField className="min-w-0 w-full gap-2">
    <FieldLabel htmlFor={fieldId} className="text-sm font-medium text-foreground">{label}</FieldLabel>
    {props.type === "search" ? <SearchField {...props} id={fieldId} className={className} /> : <Input {...props} id={fieldId} className={className} />}
  </FormField>;
}

export function SearchField({ containerClassName, className, children, ...props }: ComponentProps<typeof Input> & { containerClassName?: string; children?: ReactNode }) {
  return <div data-slot="search-field" className={cn("flex min-w-0 items-center gap-2.5 rounded-xl border px-3.5 transition-[box-shadow] duration-150 focus-within:ring-2 focus-within:ring-ring/35", controlSurface, containerClassName)}>
    <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
    <Input {...props} type="search" className={cn("min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 [&::-webkit-search-cancel-button]:appearance-none", className)} />
    {children}
  </div>;
}

export function TextareaField({ label, description, className, labelClassName, id, ...props }: ComponentProps<typeof Textarea> & { label: string; description?: ReactNode; labelClassName?: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = `${fieldId}-description`;
  return <FormField className="min-w-0 gap-2">
    <FieldLabel htmlFor={fieldId} className={cn("text-sm font-medium text-foreground", labelClassName)}>{label}</FieldLabel>
    <Textarea {...props} id={fieldId} aria-describedby={description ? descriptionId : props["aria-describedby"]} className={className} />
    {description ? <FieldDescription id={descriptionId} className="text-xs leading-5 text-muted-foreground">{description}</FieldDescription> : null}
  </FormField>;
}

export function CheckboxField({ children, description, className, contentClassName, controlClassName, id, ...props }: ComponentProps<typeof Checkbox> & { children: ReactNode; description?: ReactNode; contentClassName?: string; controlClassName?: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = `${fieldId}-description`;
  return <div className={cn("flex min-w-0 flex-col gap-1", props.disabled && "opacity-50", className)}>
    <Label htmlFor={fieldId} className={cn("flex min-w-0 cursor-pointer items-center gap-2.5 text-sm font-normal", contentClassName)}>
      <Checkbox {...props} id={fieldId} aria-describedby={description ? descriptionId : props["aria-describedby"]} className={cn("size-4 shrink-0 rounded-md", controlClassName)} />
      <span className="min-w-0 text-foreground wrap-anywhere">{children}</span>
    </Label>
    {description ? <FieldDescription id={descriptionId} className="mt-2 ps-7 text-xs leading-5 text-muted-foreground">{description}</FieldDescription> : null}
  </div>;
}

export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-5">
    <div className="min-w-0"><h1 className="text-3xl leading-tight font-medium tracking-[-0.045em] text-foreground wrap-anywhere sm:text-[38px]">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>
    {action}
  </div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={cn("surface-card min-w-0 rounded-[24px]", className)}>{children}</section>;
}

export function IconTile({ icon: Icon, tone = "neutral", className = "" }: { icon: LucideIcon; tone?: "neutral" | "green" | "warm"; className?: string }) {
  const colors = { neutral: "bg-soft text-muted-foreground", green: "bg-sage text-forest", warm: "bg-gold-soft text-gold-foreground" };
  return <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${colors[tone]} ${className}`}><Icon className="size-[19px]" strokeWidth={1.7} aria-hidden /></span>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "gold" }) {
  const colors = { neutral: "bg-soft text-muted-foreground", green: "bg-sage text-forest", gold: "bg-gold-soft text-gold-foreground" };
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-5 ${colors[tone]}`}>{children}</span>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center rounded-sm text-sm font-medium text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">{children}</Link>;
}

export function InlineError({ message }: { message: string | null }) {
  return message ? <Alert variant="destructive" role="alert" className="rounded-xl border-0 bg-red-50 p-3.5"><CircleAlert aria-hidden className="size-4 text-red-700" /><AlertDescription className="text-sm leading-6 text-red-800 wrap-anywhere">{message}</AlertDescription></Alert> : null;
}

export function ChoiceField({ label, value, options, onChange, disabled = false, compact = false }: {
  label: string; value: string; options: readonly { value: string; label: string; disabled?: boolean }[]; onChange: (value: string) => void; disabled?: boolean; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useModalNotifications(open);
  const key = (value: string) => value || "__empty__";
  return <FormField className="min-w-0 w-full gap-2">
    {!compact ? <FieldLabel htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</FieldLabel> : null}
    <Select open={open} onOpenChange={setOpen} value={key(value)} items={options.map((option) => ({ value: key(option.value), label: option.label }))} onValueChange={(value) => onChange(value === "__empty__" ? "" : String(value ?? ""))} disabled={disabled}>
      <SelectTrigger id={id} size={compact ? "sm" : "default"} aria-label={compact ? label : undefined} className="w-full"><SelectValue className="min-w-0 flex-1 truncate" /></SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} aria-label={label} className="scrollbar-thin max-h-64 max-w-[calc(100vw-32px)] rounded-xl surface-card p-1 shadow-lg ring-0">{options.map((option) => <SelectItem key={key(option.value)} value={key(option.value)} disabled={option.disabled} className="min-h-10 rounded-lg px-3 py-2 pe-8 text-sm text-foreground data-selected:bg-sage data-selected:text-forest"><span className="min-w-0 flex-1 whitespace-normal wrap-anywhere">{option.label}</span></SelectItem>)}</SelectContent>
    </Select>
  </FormField>;
}

export function LoadingState({ label = "Opening your workspace…" }: { label?: string }) {
  return <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground"><LoaderCircle className="size-6 animate-spin text-forest" aria-hidden /><p className="text-sm">{label}</p></div>;
}

export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") return error.data;
  return error instanceof Error ? error.message : "Unable to save changes. Try again.";
}
