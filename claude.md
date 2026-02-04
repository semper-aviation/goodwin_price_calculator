# Goodwin Charter Pricing Calculator

## Project Overview

Charter flight pricing engine built with **Next.js 16 + React 19 + TypeScript**. Calculates quotes for charter operators based on configurable pricing models, fee structures, and eligibility rules.

**Key Purpose:** Deterministic quote output for ML training data generation.

## Quick Start

```bash
yarn install
yarn dev        # Development at localhost:3000
yarn build      # Production build
yarn lint       # ESLint check
```

## Architecture

```
src/app/
├── engine/           # Core pricing logic (pure functions, no React)
├── components/       # React UI components
├── services/         # External API integrations
├── utils/            # Shared helpers
├── data/             # Reference data (airports, aircraft)
├── templates/        # Operator pricing profiles (JSON)
└── api/              # Next.js API routes
```

### Engine Flow (`engine/index.ts`)

```
quoteEngine(payload) → QuoteResult

1. Validate trip → 2. Split long RTs → 3. Build legs → 4. Check eligibility
→ 5. Calculate times → 6. Apply rates → 7. Apply discounts → 8. Apply fees
→ 9. Enforce constraints → 10. Generate line items
```

## Core Concepts

### Repository Modes

| Mode | Description |
|------|-------------|
| `fixed_base` | Aircraft starts/ends at single home airport |
| `vhb_network` | Uses closest Virtual Hub Base from network |
| `floating_fleet` | No repo legs - aircraft at trip endpoints |

### Pricing Models

- **Dual Rate**: `(occupied_hours × occupied_rate) + (repo_hours × repo_rate)`
- **Single Hourly**: `total_hours × hourly_rate`

### Fee Types

| Fee | Calculation |
|-----|-------------|
| Ground Handling | `segments × perSegmentAmount` |
| High-Density (HD) | `visits × feePerVisit` (capped) |
| Landing | `landings × amount` (with HD overrides) |
| Overnight | `nights × amountPerNight` |
| Daily | `calendar_days × amountPerDay` (with date overrides) |

### Eligibility Rules

- `domesticOnly` - US flights only
- `maxAdvanceDays` - Booking window limit
- `maxPassengers` - Pax count limit
- `excludeStates` - Blacklisted states
- **Geographic Rules** - Mississippi rule variants for east/west restrictions

## Key Files

### Engine (in `src/app/engine/`)

| File | Purpose |
|------|---------|
| `index.ts` | Main `quoteEngine()` entry point |
| `quoteRequest.ts` | Input types: `Trip`, `Knobs` |
| `quoteResult.ts` | Output types: `QuoteResult`, `Leg`, `LineItem` |
| `repo.ts` | Repository mode leg building |
| `pricing.ts` | Base cost + price constraints |
| `fees.ts` | All fee calculations |
| `discounts.ts` | VHB + time-based discounts |
| `eligibility.ts` | Trip validation + geo rules |
| `time.ts` | Time adjustments + daily limits |
| `types.ts` | `Result<T>` error handling pattern |

### Components (in `src/app/components/`)

| File | Purpose |
|------|---------|
| `KnobPanel.tsx` | Tabbed configuration UI |
| `knobsSchema.ts` | UI field definitions + visibility rules |
| `TripPlanner.tsx` | Trip input form |
| `QuoteSummary.tsx` | Hero totals display |
| `Ledger.tsx` | Line item breakdown |
| `LegPlan.tsx` | Visual leg representation |

### Data (in `src/app/data/`)

| File | Purpose |
|------|---------|
| `airports.ts` | ~800+ airports with ICAO, coords, timezone, Mississippi direction |
| `aircraftModels.ts` | Aircraft categories (CAT1-CAT8) and speeds |

## Type Patterns

### Result<T> (Error Handling)

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: QuoteError };
```

### QuoteResult Output

```typescript
{
  status: "OK" | "REJECTED",
  rejection?: { code: string, message: string },
  legs: Leg[],
  lineItems: LineItem[],
  times: { occupiedHours, repoHours, totalHours, matchScore },
  totals: { baseOccupied, baseRepo, discounts, fees, total }
}
```

### Line Item Codes

- `BASE_OCCUPIED`, `BASE_REPO` - Hourly charges
- `FEE_GROUND_HANDLING`, `FEE_HD`, `FEE_LANDING`, `FEE_OVERNIGHT`, `FEE_DAILY`
- `DISCOUNT_VHB`, `DISCOUNT_TIME_BASED`
- `CONSTRAINT_MIN_*`, `CONSTRAINT_MAX_*` - Floor/ceiling adjustments

## Common Tasks

### Adding a New Fee Type

1. Add types to `engine/quoteResult.ts` (line item code)
2. Implement calculation in `engine/fees.ts`
3. Call from `engine/index.ts` in fee calculation section
4. Add UI fields to `components/knobsSchema.ts`
5. Add to `KnobPanel.tsx` render logic

### Adding a New Eligibility Rule

1. Add to `Knobs` type in `engine/quoteRequest.ts`
2. Implement check in `engine/eligibility.ts`
3. Add rejection code to `engine/types.ts`
4. Add UI field in Eligibility tab of `knobsSchema.ts`

### Adding a New Template

Create JSON in `src/app/templates/` with:
```typescript
{
  name: "Operator Name",
  trip: { tripType, category, from, to, departLocalISO, ... },
  knobs: { /* full knob configuration */ }
}
```

## Testing Approach

Run the UI at `localhost:3000`, select a template, and verify:
1. Quote calculates without errors
2. Line items match expected breakdown
3. Totals are mathematically correct
4. Rejection rules trigger appropriately

Use browser console logs for debugging (extensive logging in engine).

## Code Style

- **TypeScript strict mode** - No implicit any
- **Pure functions in engine** - No side effects, deterministic
- **Tailwind CSS** - Utility-first styling
- **Path aliases** - Use `@/` for `src/app/` imports

## Important Conventions

1. **Knob field names** match engine property paths exactly
2. **Airport objects** must have `icao`, `lat`, `lon` at minimum
3. **Times are in hours** (not minutes) throughout engine
4. **Amounts are in dollars** (raw numbers, not cents)
5. **Dates use ISO format** with local timezone: `"2026-01-21T10:00"`

## Mississippi Rule Logic

Geographic restriction based on river dividing line:

| Rule | ONE_WAY | ROUND_TRIP ≤N nights | ROUND_TRIP >N nights |
|------|---------|---------------------|---------------------|
| `mississippi_rule` | Both same side | Origin on side | Both same side |
| `mississippi_ppj_round_trip` | Both EAST | Origin EAST | Both EAST |

## Match Score

Efficiency metric: `(occupiedHours / totalHours) × 10`
- 10 = all flying is revenue (ideal)
- 0 = all flying is repositioning (worst)

Used for ranking quotes or rejection threshold, not pricing.

## External Dependencies

- **Flight Time API** - Real flight time calculations (with Haversine fallback)
- **JetInsights iCal** - Calendar integration for availability
