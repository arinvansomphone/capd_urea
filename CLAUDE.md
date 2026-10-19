# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static, single-page web app that simulates a peritoneal dialysis (PD) weekly cycle and reports (in this display order) Peak Concentration, TAC, time-averaged `Kurea`, and weekly `Kt/Vurea`. Authored by Arin Vansomphone for Dr. Tim Meyer's group at Stanford. No build system, no tests, no package manager — vanilla HTML/CSS/JS with Chart.js loaded from a CDN. Deployed to GitHub Pages via Jekyll on push to `master` (see `.github/workflows/jekyll-gh-pages.yml`).

## Run / iterate

Open [index.html](index.html) directly in a browser, or serve the directory (`python3 -m http.server`). No tooling, no install step. There are no tests.

## Active vs. legacy files

Only these scripts are loaded by [index.html](index.html):

- [controller.js](controller.js) — input gathering, the simulation, the results table, run/reset.
- [graph.js](graph.js) — Chart.js setup and the plotting helper.

[script.js](script.js) is **legacy and unreferenced**. It contains an older `pdCalculator` with a different signature, different unit system, different DOM IDs (`exVolume 1`, `pdCalculatorForm`, `m_fluid_removal`, etc.) that no longer exist in `index.html`. Do not edit it expecting changes to take effect, and do not copy patterns from it without checking against `controller.js` first.

## Architecture

[index.html](index.html) is the only page wired to the simulator (`about.html` is plain content). Both pages load [site.css](site.css) for the shared design tokens, root font scaling, reset and **header** (title, contact email, "Last updated", About); each page keeps only its own layout in an inline `<style>`. Change the header in one place: the markup is duplicated in both HTML files, but the styling lives only in site.css. Neither page has a footer. The page has four boxes: Patient Data (top-left), Graph (top-right), Prescription Data (bottom-left), Numeric Results (bottom-right).

**Layout fits one screen, no scrolling.** The body is locked to the window height (`overflow: hidden`); the top row takes the leftover height and the graph fills it (`.chart-container`, with `maintainAspectRatio: false` in graph.js). All CSS sizes are `rem`, and the root font size (in site.css) is `clamp(11px, min(1.9vh, 1.15vw), 23px)`, so the whole page scales with the window. Shared colors and spacing are CSS variables on `:root`. Chart text is drawn on a canvas and can't use `rem`, so `applyChartScale()` in graph.js sizes it from the root font size (on load and on window resize). The `1.9vh` / `1.15vw` factors were tuned by measurement across 18 window sizes, from 920×600 to 3440×1440. The binding constraint is Patient Data's content height, plus header wrapping (Numeric Results "Prescription N", prescription column headers) on relatively narrow windows. Raising either factor overflows common laptop sizes (1440×900, 1024×700), so re-measure before changing them. The CAPD version's 4th prescription row made the bottom row taller, so the prescription table (`td` padding, 2rem inputs) and Patient Data's spacing (`.data-box` margins) were tightened to keep Patient Data inside its box. Measured 2026-10-18: fits from 960×640 to 3440×1440; only 920×600 (font clamped at its 11px floor) still overflows Patient Data by ~1.7rem. When adding UI, use `rem` (not `px`) and keep new content within the existing box heights, or the bottom row will be clipped. Windows under 560px tall or 900px wide fall back to a normal scrolling page (media query at the end of the `<style>`). Don't bring back `maintainAspectRatio: true`: it ties graph height to window width, which is what caused the original scrolling. The graph legend sits in a column to the **right** of the chart (`.graph-body`), not underneath: underneath, it took 2–3 rows of chart height and grew with each prescription added. Moving it gained ~20% chart height. Because that makes the chart narrower, the x-axis switches to Mon/Tue/… when a day's width is under ~7× the tick font size (tick `callback` in graph.js).

Flow on "Add Prescription" click:

1. `gatherPrescriptionInputs(2)` reads patient + prescription fields. This is the **CAPD** version: four identical rows (blank label cell), each with "Number of Exchanges", Volume, Total Time and Total UF, IDs `p2-r1-*` … `p2-r4-*`, listed once in `ROW_TYPES` (controller.js) — every per-row loop (gather, validate, listeners, reset) iterates that constant. One row N=4 / 24 h is classic CAPD; four N=1 rows give uneven dwells (e.g. 5/5/5/9). (The sibling APD version had Repeated / Last Fill / Additional Cycle rows.) The rows run in that order within each day and are expanded into per-exchange `volumeData`/`timeData`/`ufData` arrays — `timeData` stores **hours per single exchange** (total time ÷ number), and `ufData` stores **mL per single exchange** (row total UF ÷ number), mirroring each other.
2. `pdCalculator(...)` runs a minute-by-minute simulation over `7 × 24 × 60 = 10080` minutes. Outer loop iterates the whole week until end-of-week plasma concentration converges (tolerance 0.1 mg/L, max 10000 iterations) — that's the "weekly steady state."
3. Each treatment-day exchange has three phases: start-of-exchange (fresh fill, dead-volume carry-forward via `prevDialysateConc_mgL`), active dwell (mass transfer via **diffusion only** — `MTAC · ΔC`, no convective term), and dead time (drain/fill, no transfer). An exchange no longer than the 15-min dead time is treated as all dead time (no diffusion, no UF) rather than dividing by a zero/negative dwell — nonsensical prescriptions are allowed, not blocked. Non-treatment minutes apply renal excretion + urea generation only.
4. Result is appended to `treatmentHistory` (max 4, run order — the new run takes the next Prescription number; a 5th drops the oldest and the rest shift down). `updateGraphWithTreatment` redraws the chart with all 4. `updateAllResults` populates the four result columns (`tx1`–`tx4`).

The chart in [graph.js](graph.js) pre-creates 8 datasets (4 treatments × {solid line, dashed average}) and the custom legend toggles `meta.hidden` on those slots — keep this 8-dataset structure intact when changing the graph.

## Units (read this before touching the math)

The simulation's internal unit system is documented at [controller.js:140](controller.js:140). It is easy to break:

- Concentrations inside `pdCalculator` are **mg/L of plasma water** (urea distributes only into body water, and Watson's V is total body water — so the mass-balance equations naturally track plasma-water concentration). The UI reports **mg/dL of whole plasma**, the lab/clinical convention: the boundary multiplies by `0.93 / 10` (`updateAllResults`, `updateGraphWithTreatment`). Whole-plasma concentration is *lower* than plasma-water because urea is excluded from the protein/lipid fraction (~7%).
- **All four metrics are computed in one place:** `computeMetrics(entry)` in [controller.js](controller.js), used by both the results table and the console log. It returns `tac`/`apc` in internal units (mg/L plasma water); the display multiplies by `0.93 / 10`. `apc` is now the **single highest** plasma concentration of the week (labeled "Peak Concentration" in the UI; the `apc` key and `apc-tx*` IDs were kept). It used to be the mean of start-of-day peaks (`peakConcentration`), which `pdCalculator` still returns but nothing reads.
- **Excel upslope test (#2):** with the whole-plasma display, recover `gen` from the observed plasma slope as `gen = slope × V_water / 0.93 / 100` (slope in mg/dL/min, V_water in mL). Without the `÷ 0.93`, the back-calc gives `0.93 × gen`.
- `kru` and `mtac` are **mL/min**. The `kru` input is treated as **whole plasma** clearance and converted to **plasma water** inside `pdCalculator` via `kru = kru * 0.93` ([controller.js:143](controller.js:143)) — plasma-water clearance is *smaller* than whole-plasma because urea is concentrated in the water fraction, so `K_pw = 0.93 × K_wp`. This is a local parameter reassignment, so it doesn't touch `inputs.kru`. Verified: weekly renal removal from the simulation equals `Kru_input × C_whole-plasma` summed minute-by-minute to floating-point exactness, and steady-state mass balance closes to 0.005%. **Do not add a second `× 0.93`** — it would under-clear renal urea by 7%.
- **Time-averaged Kurea (mL plasma/min)** is *total* weekly solute removal (dialysate flux + renal excretion) ÷ (whole-plasma TAC × totalMinutes) × 1000. It divides by `tac * 0.93` so the clearance is on the **whole-plasma** basis its label states. (Before 2026-09, this cell was renal-only and just recovered the entered Kru; it now includes dialysis by request.) **Weekly Kt/Vurea** = `Kurea × 10080 / Vd` (Vd in mL, baseline `volume*1000`), which is numerically identical to the old `stdKt/V` formula `weeklyRemoval / (tac*0.93) × 1000 / V_mL`. Don't drop the 0.93 — the result would be ~7.5% off.
- `volume` (Vd) input is **L**, converted to `V_mL` once — this is the **baseline** body water. Body water is now **time-varying** (`bodyVolume[t]`, mL): UF drains it during each effective dwell at rate `uf = ufData/effectiveTime_min`, and a steady daily intake `addRate = dailyUF / 1440` mL/min (the sum of the day's UF, 0 on skipped days) refills it, so `bodyVolume` returns to `V_mL` exactly at every day boundary. Concentration is **derived** each minute as `amountBody / bodyVolume * 1000`, not incremented — so the mass balance (`amountBody`) and the volume bookkeeping (`volRate`) are tracked separately. `Kt/Vurea` still uses the baseline `volume*1000` as V_urea.
- `ufData` is **mL per exchange**, derived by `gatherPrescriptionInputs` as the row's entered "Total UF (mL)" ÷ number of exchanges in that row (same pattern as `timeData`) — the UI field is a row/day total, not a per-exchange amount. An entered **0** is silently treated as **1 mL** (row total) by `readRowUF()`. The field keeps showing 0; the substitution only happens when inputs are read for the simulation. The same `uf` rate feeds the body-volume drain — there is no longer a solute-convection use of UF.
- **Dialysate volume** (denominator for `dialysateConc`) is `deadVolume_mL + fillVolume[exchange] + ufData[exchange]` — residual + instilled + the exchange's full UF, present from the start of the dwell (manuscript simplification). A larger bag lowers `Cd`, widening the `MTAC · (Cp − Cd)` gradient, so it raises modeled removal — negligible at low UF, but material for long high-UF dwells. This matches the reference spreadsheet, which computes the same sum as `=$C$5*1000+$C$11+$G$6` (fill + residual + UF per cycle). *(An earlier note here claimed the spreadsheet omits the `+ ufData` term — that was wrong; verified against `8.17.26 ARIN CHECK New Test .xlsx`.)*
- `gen` (urea-N generation, mg/min) comes from `computeGeneration(pna, weight)` using Bergström's CAPD equation 4A (Kidney Int 1993;44:1048, `PNA = 19 + 7.62 × UNA`, solved for UNA): `(nPNA × weight − 19) / 7.62 × 1000 / 1440`, clamped at zero. nPNA is g/kg/day. (Labeled "Borah" before 2026-09; the math was always Bergström 4A.)
- Vd auto-fill in `calculateVolume()` **displays** 1 decimal but stores the unrounded value in `#volume`'s `data-exact`, which `gatherPrescriptionInputs` uses for the simulation. Read Vd from there, not from the field's text.
- Vd auto-fill in `calculateVolume()` uses the Watson formulas (sex-specific) — different from the formula in legacy `script.js`.

If you change a unit, audit every place the variable flows and trace through to the four output cells. Recent commit history (`1bf9075`, `ff71611`, `7b4cc45`, `01919b5`) is almost entirely unit-conversion fixes — be deliberate.

## Parity with the reference spreadsheet

Validated against `8.17.26 ARIN CHECK New Test .xlsx`, sheet `CAPD 4 x 2L 24hrs`, by extracting
every formula and rebuilding its algorithm independently. **The app and that spreadsheet agree to
0.12%.** Structurally they are the same model:

| | Spreadsheet | `pdCalculator` |
|---|---|---|
| Renal term | `C9 = 0.93*F9` applied to plasma water (`N = H/100*$C$9*5`) | `kru * 0.93` applied to plasma water |
| Dead volume | 150 mL, carries end-of-dwell dialysate mass | 150 mL via `prevDialysateConc_mgL` |
| Dead time | 15 min, diffusion off, renal continues | 15 min, same |
| Dialysate volume | `=$C$5*1000+$C$11+$G$6` (fill + residual + UF) | `deadVolume_mL + fillVolume + ufData` |
| Body volume | `C + D/1000 − E/1000` (intake vs UF) | `bodyVolume[t] + volRate[t]` |
| Diffusion | `(H−I)/100 × MTAC × Δt`, no convection | `(Cp − Cd) * mtac / 1000` |
| Time step | 5 min | **1 min** (app is the finer integrator) |
| Horizon | one day iterated to steady state | full week (equivalent for 7-day CAPD) |
| Generation | hardcoded `F8 = 4.947467` mg/min ("Bergstrom") | Bergström 4A → 5.012394 mg/min |

Two things to know before chasing any future mismatch:

- **The `× 0.93` on Kru is confirmed correct and identical to the reference.** The spreadsheet's own
  `C9 = 0.93*F9` converts "Kru ml/min plasma" to "ml/min water" and applies it to the plasma-water
  column, exactly as [controller.js:151](controller.js:151) does. Adding a second factor moves
  *away* from the reference. Do not re-litigate this.
- **The remaining ~1.3% is the generation *input*, not the equation.** Both use Bergström 4A
  (`PNA = 19 + 7.62 × UNA`). The app gets PNA = nPNA × weight = 74 g/day → 7.2178 g/day UNA
  (5.012394 mg/min). The sheet's hardcoded 7.1243523 g/day (4.947467 mg/min) back-solves through
  the same equation to PNA = 73.29 g/day, so the sheet used a different PNA/normalization for the
  standard patient (not recorded in the sheet). Feeding `4.947467` into the app reproduces the
  sheet's TAC to 0.12%.

Known defects *in the spreadsheet* (not the app), as of the 8.17.26 file: in `CAPD 4 x 2L 24hrs`
the four dwells run 70/69/89/49 five-minute intervals instead of 69 each, which inflates TAC by
0.55–0.94% and unevenly across Kru; and typing a value into `C9` overwrites the `=0.93*F9` formula
and silently switches the Kru basis to ml/min water (cell `H1` warns about this). Any reference
table regenerated from that sheet should be checked for both first.

## State conventions

- **UI says "Prescription", code says "treatment".** Every user-visible label (table headers, legend, tooltips, button, alerts) reads "Prescription N" / "Add Prescription", but identifiers (`treatmentHistory`, `TREATMENT_LABELS`, `run-treatment-2`, `.treatment-box`) were deliberately left as-is. Keep new user-facing text on "Prescription".

- `treatments.treatment2` holds only the most recent run (kept for back-compat with the older graph code shape).
- `treatmentHistory` is the source of truth for the table and graph: index 0 is the oldest shown (Prescription 1), new runs are appended, length capped at 4 (a 5th run drops index 0).
- `resetAll()` clears history, table, prescription inputs, and re-checks all day boxes — but **preserves patient data**. Match this scope if extending reset.
- "Add Prescription" button is gated by `validatePrescription(2)` via `updateButtonStates()` on every relevant input change; keep new inputs wired into that listener set.
