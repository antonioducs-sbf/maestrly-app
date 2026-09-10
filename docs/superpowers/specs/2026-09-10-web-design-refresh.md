# Web Kanban design refresh — design direction

Approved 2026-09-10. Scope: `apps/web` only (plus the `cardId` field on the executions ledger).

## Subject

A control board where work moves between columns and an agent starts working the moment a card *enters* an automated column; the person's job is to decide what happens next. So the page must answer three things at a glance: where is the work, what is running now, what is waiting for me.

## Alternatives considered

- (B) "cool-gray productivity app" (Inter, blue accent — Linear/Notion look): rejected, it is the template every tool ships.
- (C) "near-black + acid accent editorial": rejected, generic dark-mode default and it fights the brass brand mark.
- **Chosen (A) "Conductor's desk":** keep the brass brand thread (it is in the mark), replace the cream/gold pastiche with near-neutral warm grays, add a single **amber "cue" hue reserved for agent activity**, give the type real character, and spend the boldness in one place: the **cue rail**.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | `#f6f5f1` | `#141615` | page |
| `--surface` | `#eeede8` | `#1b1e1c` | columns, inputs, chips |
| `--surface-raised` | `#ffffff` | `#222524` | cards, panels, dialogs |
| `--ink` | `#1f201e` | `#ece9e1` | text |
| `--muted` | `#6f7169` | `#9ea298` | secondary text |
| `--line` / `--line-strong` | `#e3e2da` / `#c9c8be` | `#2f3330` / `#474c48` | hairlines |
| `--brass` / `--brass-soft` | `#9a7a37` / `#f0e7d2` | `#d4b273` / `#33301f` | brand accent, selected states |
| `--cue` | `#e0a83a` | `#f2bd52` | **only** agent activity (running now) |
| `--moss` | `#2b7a58` | `#63d19c` | success / online |
| `--brick` | `#b34a4d` | `#ff8288` | danger / blocked |
| `--rail`, `--rail-ink`, `--rail-muted` | `#131514`, `#e7e4dc`, `#9a9d95` | same | sidebar (always dark) |
| `--radius-s/m/l` | 6px / 10px / 16px | | |
| `--shadow-card`, `--shadow-pop` | `0 1px 0 rgb(31 32 30/4%), 0 6px 18px rgb(31 32 30/6%)` / `0 18px 48px rgb(0 0 0/18%)` | `0 1px 0 rgb(0 0 0/40%), 0 8px 24px rgb(0 0 0/35%)` / `0 24px 60px rgb(0 0 0/55%)` | |

## Type

Display: *Bricolage Grotesque* (variable, `opsz`/`wdth` axes) for `h1`, dialog titles, column names, metric numerals — tight tracking (`-0.03em`), weight 500–600. Body: *Instrument Sans* variable, 14px/1.55. Data: *JetBrains Mono* variable, 11–12px for ids, timestamps, states, code. Scale: 11 / 12 / 13 / 14 / 16 / 20 / 26 / 34. Fonts are self-hosted through `@fontsource-variable` because the web CSP is `default-src 'self'`.

## Layout

One header row instead of four stacked ones: project name (display) + board tabs + live indicator; beneath it a one-line **pulse**: `12 open · 2 running now · 1 waiting for you`. Sidebar keeps its dark rail but groups navigation by meaning — *Work* (Board, Executions), *Automation* (Automations, Runners, My computers), *Project settings* (Team, Git repositories, Reports). Board columns get a soft surface; cards lose the per-card "column policy" strip; column headers carry the automation state instead.

```
┌ rail ───┬─────────────────────────────────────────────────────┐
│ ◐ maestrly│ Launch control  [Delivery board] [+]        ● Live │
│ WORK     │ 12 open · 2 running now · 1 waiting for you         │
│  Board   ├─────────────────────────────────────────────────────┤
│  Execut. │ [Board][List]   ⌕ search        Archived   + Column │
│ AUTOMAT. │ ┌ Backlog · 3 ┐ ┌═ Review ⟡ · 2 ═┐ ┌ Done ✓ · 5 ┐  │
│  Autom.  │ │ ▍Verify …  │ │ ▍Ship notes    │ │             │  │
│  Runners │ │  high · 2↳ │ │  med           │ │             │  │
│  My PCs  │ │ + Add card │ │ + Add card     │ │             │  │
│ PROJECT  │ └────────────┘ └────────────────┘ └─────────────┘  │
│  Team …  │                                                     │
│ ● Ada    │                                                     │
└──────────┴─────────────────────────────────────────────────────┘
   ═ = cue rail (brass hairline on automated columns; light travels along it while an agent works there)
```

## Signature: the cue rail

Automated columns have a 2px brass rail across the top (manual columns have none). While any job in that column is running, a light sweeps along the rail (2.4s loop); when a card is dropped into an automated column and the API returns a `jobId`, the column fires a one-shot cue: the rail flashes, the card gets a brief amber edge glow. This is the product thesis ("automation starts on a real column entry") made visible, and it derives from the two arcs in the brand mark.

## Motion inventory

All disabled under `prefers-reduced-motion`. Columns stagger in (40ms apart, 260ms fade+rise); cards lift 2px + shadow on hover, slight tilt + 0.98 scale while dragging, drop target shows a brass outline; dialogs scale 0.98→1 with backdrop blur; sidebar collapse animates width; cue rail sweep + one-shot flash as above. Nothing else animates.

## Icons

Lucide (already bundled), chosen on purpose: column roles `Inbox` (backlog) / `CheckCheck` (done) / `Bot` (automated) / `CircleDashed` (manual); priority glyphs `ChevronsUp` high, `Equal` medium, `ChevronDown` low (with text label for a11y); card actions `ArrowUp`/`ArrowDown`/`MonitorPlay`; nav as before plus group captions. Empty states use one inline SVG illustration built from the brand arcs (`EmptyState` component), tinted by CSS variables so it follows the theme. One generated raster image only: an abstract brass-arcs atmosphere for the login screen backdrop.

## Constraints

- Every class hook and accessible name used by `apps/web/e2e/*.spec.ts` is preserved.
- All copy goes through `t()` with `en` and `ptBR` entries.
- No horizontal overflow at 390px and 1440px; visible focus rings; hit targets ≥ 32px (44px on ≤ 850px).
- Stylesheets are organised as `@layer tokens, base, shell, board, panels, dialogs, motion` in `apps/web/src/styles/`.
