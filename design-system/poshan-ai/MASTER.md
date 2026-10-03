# Poshan AI — Design System (MASTER)

> Source of truth for the UI revamp. Direction: **Energetic Fitness** — bold,
> motivational, athletic. Flat design, high energy, green + macro-orange.
> Light + dark, driven by the system color scheme.

## Principles

1. **Energetic, not loud.** Bold Barlow Condensed titles, confident color, but
   generous whitespace and clean data. Motivate without clutter.
2. **Data reads at a glance.** Numbers are first-class — large, tabular, high
   contrast. Charts and rings are the hero of each data screen.
3. **One primary action per screen.** Primary CTA = green; high-intent CTA
   (log/scan) = orange accent. Everything else is subordinate.
4. **Tokens only.** No hardcoded hex or `green-600` in screens. Use semantic
   Tailwind tokens (className) or `useThemeColors()` for SVG/charts/tab bar.
5. **Native-correct.** Safe areas via `Screen`, 44pt+ touch targets, press
   feedback, no emoji icons (use `lucide-react-native`).

## Color tokens

Defined as CSS variables in `global.css` (light `:root` + dark
`@media (prefers-color-scheme: dark)`), mapped in `tailwind.config.js`, and
mirrored for SVG in `lib/theme.ts` (`useThemeColors()`).

| Token (className)         | Light      | Dark       | Use |
|---------------------------|------------|------------|-----|
| `bg-background`           | `#F5F6F4`  | `#0B0F0E`  | App canvas |
| `bg-surface`              | `#FFFFFF`  | `#15191A`  | Cards, sheets |
| `bg-surface-muted`        | `#F0F2EE`  | `#1C2122`  | Inputs, fills, chart tracks |
| `bg-surface-strong`       | `#111814`  | `#050A08`  | Inverted hero blocks |
| `text-foreground`         | `#0B1210`  | `#F2F5F3`  | Primary text |
| `text-muted-foreground`   | `#5B646C`  | `#9BA69F`  | Secondary text |
| `border-border` / `-strong` | `#E4E7E2`/`#CBD0C9` | `#272D2B`/`#373E3B` | Lines |
| `bg-primary` (+`-pressed`,`-soft`) | `#059669` | `#10B981` | Brand green / primary CTA |
| `text-on-primary`         | `#FFFFFF`  | `#06140F`  | Text on primary |
| `bg-accent` (+`-pressed`,`-soft`) | `#EA580C` | `#F97316` | Macro orange / log+scan CTA |
| `text-on-accent`          | `#FFFFFF`  | `#0A0603`  | Text on accent |
| `text-success/warning/info` | — | — | Semantic states |
| `bg-danger`/`-soft`, `text-danger` | `#DC2626` | `#F87171` | Destructive |
| `macro-protein/carbs/fat/calories` | green/amber/violet/orange | brightened | Nutrition accents |

White on `#059669`/`#EA580C` ≈ 3.9:1 — AA for the large/bold button labels we use.

## Typography — Barlow family

Loaded in `app/_layout.tsx` via `@expo-google-fonts/barlow(-condensed)`.

| className              | Font                         | Use |
|------------------------|------------------------------|-----|
| `font-display`         | Barlow Condensed 700         | Hero/section titles (often `uppercase tracking-wide`) |
| `font-display-semibold`| Barlow Condensed 600         | Card titles |
| `font-sans`            | Barlow 400                   | Body |
| `font-medium`/`-semibold`/`-bold` | Barlow 500/600/700 | UI labels, emphasis, numbers |

Use `<Heading level={1..4} uppercase>` and `<Text variant=...>` — don't set raw
font classes in screens. Big stats use `font-display` (e.g. ProgressRing value).

## Shape & spacing

- Radius: cards/buttons `rounded-2xl` (20px), chips/inputs `rounded-full`/`-2xl`,
  pills `rounded-full`. Radius scale overridden in tailwind config.
- Spacing: 4/8pt rhythm. Page horizontal padding `px-5`. Card padding `p-4`.
  Section gap `gap-4`/`mb-6`.
- Elevation: flat by default (border only). `Card elevated` adds a soft shadow
  for the one hero card per screen.

## Primitives (`components/ui`, import from `components/ui`)

`Text`, `Heading`, `Button` (primary/accent/secondary/ghost/danger · sm/md/lg ·
loading · icon), `IconButton`, `Card`/`PressableCard`, `Input` (label/error/
helper/icon), `Screen` (safe-area + header + sticky footer), `Chip` (selectable),
`Badge`, `EmptyState`, `ProgressRing`, `MacroBar`.

**Rules for screens:** wrap every screen in `<Screen>`; never hand-roll headers
or `pt-14`. Never use emoji as icons — use lucide. Never hardcode colors. Give
every icon-only control an `accessibilityLabel`.

## Icons

`lucide-react-native`, stroke width default, size tokens 18/20/22/24. Color via
`useThemeColors()`. Common: Home, UtensilsCrossed, ClipboardList,
MessageCircle, Settings, Plus, Camera, Flame, Activity, TrendingUp, ChevronLeft.
