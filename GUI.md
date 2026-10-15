# Philoxenia UI

The design language follows the supplied Graphical UI reference and subsequent refinements: a white content surface, subtly outlined white cards, warm off-white navigation, and stone/taupe illustration backgrounds. Retain Philoxenia’s green accent and welcoming voice.

## Foundations

- Use the semantic shadcn Tailwind tokens in `app/globals.css`. The primary brand color is `#003C2E`; forest maps to brand green. Preserve the established neutral palette: white workspace content and cards, `#f5f4f1` soft navigation and controls, `#efefee` base canvas, `#ebe8e1` warm surfaces, and `#d3cebf` stone surfaces. Text is charcoal and supporting text uses `text-muted-foreground` in gray-green. Primary action text is white.
- Use the supplied SVG assets in `public/brand/` through `BrandWordmark` and `BrandMark`. Use the full logotype in the expanded sidebar, mobile drawer, and sign-in screen; use the OS logomark in the collapsed rail. Preserve the artwork’s aspect ratios and paths. Normalize asset fills to the exact brand green; do not rebuild the logo from text or substitute an icon.
- Geist is the single font family. Page titles use 30–34px with medium weight and tight tracking; section titles use 16–24px. Body text is 14px with 24–28px line height; metadata is 12px. Use tabular figures for dates and numeric summaries.
- Use the existing 4px spacing scale. Page margins are 20px on small screens and 24px on larger screens; panels use 24–28px padding. Related dashboard cards have 16px gutters; separate sections have 24px or more.
- Controls and icon tiles have 12px corners; panels and hero surfaces have 24px corners. Fully round only avatars and status badges. Separate white cards with subtle 1px borders using `border-line` and deliberate spacing. Avoid decorative shadows and gray rounded wrappers behind the page content or preview notice. Render the preview notice as a plain row with a bottom divider.

## Components and layout

- Compose `PageHeading`, `Panel`, `IconTile`, `Badge`, `Field`, `TextareaField`, `CheckboxField`, `ActionButton`, and `TextLink` from `components/ui.tsx`, and `WorkspaceDialog` for shared dialogs. Use the shadcn Base UI primitives in `components/ui/` for interactions and Sonner for notifications; install any new shadcn components with the shadcn add command. The `base-nova` registry style is configured in `components.json`.
- Reserve the filled green treatment for the main action in a view. Secondary actions use a neutral surface or outlined control. Give links a hover underline, controls a visible focus ring, and buttons immediate press feedback.
- Titles lead directly. Do not add decorative eyebrow text, uppercase navigation group labels, card category labels above another title, or slogans that repeat the heading. Keep status badges only when they communicate actual state.
- Use short, concrete copy. Name the object and the action consistently: cohort, Hustler, invitation, Sprint, Command Center. Empty states explain what appears here and how to continue. Avoid repeating introductory copy inside every card.
- The Command Center separates Cohorts, Opportunities, Open Doors, and Settings with shadcn tabs. Imports belong beside opportunity listings; email delivery and backend status belong in Settings. Fit new organizer tools into those sections rather than extending one long dashboard.
- Within a cohort, Overview prioritizes follow-ups and Participants handles invitations and access. Keep secondary totals collapsed and CSV exports in a menu. Preserve section links, browser history, and filters when switching tabs; load each section on its first visit.
- Use Lucide SVG icons with a consistent stroke weight. Keep illustrations free of decorative text and use the same restrained palette as the interface.
- Use Tailwind and composable React components. Prefer logical spacing properties, wrapping text and action rows, `min-w-0`, and `minmax(0, 1fr)` tracks. Dense tables may scroll inside their panel; the page must not overflow horizontally.
- Mobile navigation is a modal with focus containment, Escape dismissal, and focus restoration. Close it when switching to the desktop layout. Keep important actions reachable at 320px and at 200% zoom.
- Desktop navigation is a continuous warm off-white strip attached directly to the inset white content surface, with no gap or independent card outline. Do not add an outer decorative frame or background border around the app. Collapse navigation to a 72px icon rail with accessible link names and tooltips on hover or keyboard focus. Keep the full-width mobile drawer independent of the saved desktop collapse preference.
- Sidebar width transitions take 200ms with `ease-ui`; keep icons in place and fade labels without replacing the navigation elements. Respect reduced motion. The workspace occupies `100dvh`; scroll inside the white inset panel with its header sticky and opaque. Keep sidebar scrolling independent, reserve scrollbar space, and reset panel scroll on navigation.
- Workspace scrollbars use the local `scrollbar-thin` Tailwind utility with a transparent track and the charcoal foreground token for the handle. Use the same treatment for the inset panel, desktop navigation, and mobile drawer.
- Center page content within a 1200px maximum width, including on ultrawide displays. Cap hero illustration height at 256px so the artwork cannot inflate adjacent cards as the viewport grows. Let text and padding determine card height.
- Keep color transitions around 150ms. Use motion only for feedback or spatial explanation, avoid decorative hover movement, and respect reduced motion.

## Verification

Reuse a running dev server. Check the affected views at desktop and mobile widths, plus 320px for overflow. Run the existing navigation smoke test, TypeScript, and lint for changes to shared components. Verify live data views when connected; do not treat preview data as coverage of authenticated behavior.
