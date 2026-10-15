import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandWordmark } from "./brand";
import sanFrancisco from "@/public/images/san-francisco-golden-gate.jpg";

export function EntryLayout({ children, onboarding = false }: { children: ReactNode; onboarding?: boolean }) {
  const HeroHeading = onboarding ? "p" : "h1";
  return <main className={`grid min-h-dvh gap-0 bg-soft p-3 sm:p-4 lg:h-dvh lg:overflow-hidden ${onboarding ? "grid-rows-[auto_1fr] lg:grid-rows-1 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]" : "lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]"}`}>
    <section className={`relative isolate flex min-w-0 flex-col justify-between overflow-hidden rounded-[20px] bg-forest p-6 text-white sm:p-10 lg:min-h-0 lg:p-12 2xl:p-16 ${onboarding ? "min-h-24 sm:min-h-32" : "min-h-80 sm:min-h-[420px]"}`}>
      <Image src={sanFrancisco} alt="The Golden Gate Bridge rising through San Francisco's coastal fog at sunrise" fill preload placeholder="blur" sizes="(min-width: 1024px) max(52vw, 150vh), (min-width: 640px) max(100vw, 630px), max(100vw, 540px)" className="-z-20 object-cover object-[20%_center]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-black/25 via-black/15 to-[#102820]/85" />
      <Link href="https://philoxenia.hustlehours.com/" aria-label="Philoxenia OS" className="inline-flex w-fit rounded-sm"><BrandWordmark className="h-auto w-44 brightness-0 invert sm:w-52" /></Link>
      <div className={`mt-20 ${onboarding ? "hidden lg:block" : ""}`}><HeroHeading className="text-[34px] leading-[1.06] font-medium tracking-[-0.05em] sm:text-5xl lg:text-[clamp(3rem,4.5vw,5.5rem)]">Big ambitions.<br /><span className="text-white/85">A place to begin.</span></HeroHeading><p className="mt-5 max-w-md text-sm leading-6 text-white/80 sm:text-base sm:leading-7">Two weeks in San Francisco. A community in your corner.</p></div>
    </section>
    <section aria-label={onboarding ? "Set up your mission" : "Sign in"} className={`scrollbar-thin flex min-w-0 flex-col pb-5 [--scrollbar-thumb:var(--foreground)] [--scrollbar-track:transparent] lg:overflow-y-auto lg:overscroll-y-contain lg:pt-10 lg:pb-6 ${onboarding ? "px-1 pt-5 sm:px-6 sm:pt-8 lg:px-8 xl:px-10" : "px-3 pt-8 sm:px-10 sm:pt-12 lg:px-8 xl:px-16"}`}>
      <div className={`mx-auto flex w-full flex-1 flex-col ${onboarding ? "max-w-[640px] justify-start lg:justify-center lg:py-4" : "max-w-[480px] justify-center py-6 lg:py-16"}`}>{children}</div>
      <footer className="mx-auto mt-6 w-full text-end text-xs text-muted-foreground lg:mt-0"><p><a href="https://philoxenia.hustlehours.com/" target="_blank" rel="noopener noreferrer" className="rounded-sm text-forest underline decoration-forest/30 underline-offset-4 transition-colors hover:decoration-forest">Philoxenia</a> by Hustle Hours</p></footer>
    </section>
  </main>;
}

export function EntryCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`@container/entry min-w-0 rounded-[24px] surface-overlay p-5 sm:p-8 xl:p-9 ${className}`}>{children}</div>;
}
