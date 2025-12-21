"use client"

// --- Layout and component skeletons for CalculatorPage ---

import { useMemo, useRef, useState } from "react"
import Header from "./components/Header"
import TripPlanner, { type TripInput } from "./components/TripPlanner"
import KnobPanel from "./components/KnobPanel"
import ResultsPanel from "./components/ResultsPanel"
import SummaryPanel from "./components/SummaryPanel"
import { KNOB_UI_TABS } from "./components/knobsSchema"
import {
  type Airport,
  type CategoryId,
  type PricingKnobs,
  type QuoteRequestPayload,
  type TripInput as ApiTripInput,
} from "./engine/quoteRequest"
import airportsData from "./data/airports"
import { logQuoteRequest } from "./services/calculatePricing"

type KnobValues = Record<string, string | number | boolean | undefined>

const airportsByIcao = new Map(
  airportsData.map((airport) => [airport.icao, airport])
)

const AIRPORT_MULTI_PATHS = new Set(
  KNOB_UI_TABS.flatMap((tab) =>
    tab.sections.flatMap((section) =>
      section.fields
        .filter((field) => field.type === "airportMulti")
        .map((field) => field.path)
    )
  )
)

const AIRPORT_SINGLE_PATHS = new Set(
  KNOB_UI_TABS.flatMap((tab) =>
    tab.sections.flatMap((section) =>
      section.fields
        .filter((field) => field.type === "airportSingle")
        .map((field) => field.path)
    )
  )
)

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
) {
  const parts = path.split(".")
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]
    const nextValue = current[key]
    if (
      !nextValue ||
      typeof nextValue !== "object" ||
      Array.isArray(nextValue)
    ) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

function buildPricingKnobs(values: KnobValues) {
  const result: Record<string, unknown> = {}
  Object.entries(values).forEach(([path, value]) => {
    if (value == null || value === "") return
    let finalValue: unknown = value
    if (AIRPORT_MULTI_PATHS.has(path) && typeof value === "string") {
      finalValue = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((code) => toApiAirport(code))
        .filter((airport): airport is Airport => airport !== null)
    }
    if (AIRPORT_SINGLE_PATHS.has(path) && typeof value === "string") {
      finalValue = toApiAirport(value)
    }
    setNestedValue(result, path, finalValue)
  })
  return result
}

function getNestedValue(obj: Record<string, unknown>, path: string) {
  const parts = path.split(".")
  let current: unknown = obj
  for (const key of parts) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function buildDefaultKnobValues(knobs: PricingKnobs): KnobValues {
  const result: KnobValues = {}
  KNOB_UI_TABS.forEach((tab) => {
    tab.sections.forEach((section) => {
      section.fields.forEach((field) => {
        const value = getNestedValue(
          knobs as Record<string, unknown>,
          field.path
        )
        if (value == null) return
        if (AIRPORT_MULTI_PATHS.has(field.path) && Array.isArray(value)) {
          const airports = value
            .map((item) =>
              item && typeof item === "object"
                ? (item as { icao?: string }).icao
                : undefined
            )
            .filter((code): code is string => Boolean(code))
          result[field.path] = airports.join(", ")
          return
        }
        if (AIRPORT_SINGLE_PATHS.has(field.path)) {
          if (value && typeof value === "object") {
            const icao = (value as { icao?: string }).icao
            if (icao) {
              result[field.path] = icao
              return
            }
          }
        }
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          result[field.path] = value
        }
      })
    })
  })
  return result
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mergeDeep(
  base: Record<string, unknown>,
  override: Record<string, unknown>
) {
  const result: Record<string, unknown> = { ...base }
  Object.entries(override).forEach(([key, value]) => {
    const existing = result[key]
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = mergeDeep(existing, value)
    } else {
      result[key] = value
    }
  })
  return result
}

function isKnobsReady(knobs: PricingKnobs) {
  const repoReady =
    (knobs.repo.mode === "fixed_base" &&
      Boolean(knobs.repo.fixedBaseIcao?.icao)) ||
    (knobs.repo.mode === "vhb_network" &&
      Boolean(knobs.repo.vhbSets?.default?.length)) ||
    (knobs.repo.mode !== "fixed_base" && knobs.repo.mode !== "vhb_network")

  const pricingReady =
    (knobs.pricing.rateModel === "single_hourly" &&
      typeof knobs.pricing.hourlyRate === "number" &&
      knobs.pricing.hourlyRate > 0) ||
    (knobs.pricing.rateModel === "dual_rate_repo_occupied" &&
      typeof knobs.pricing.repoRate === "number" &&
      knobs.pricing.repoRate > 0 &&
      typeof knobs.pricing.occupiedRate === "number" &&
      knobs.pricing.occupiedRate > 0)

  return repoReady && pricingReady
}

function toApiAirport(icao: string): Airport | null {
  const airport = airportsByIcao.get(icao)
  if (!airport) return null
  return {
    icao: airport.icao,
    lat: airport.lat,
    lon: airport.lon,
    country: airport.country,
    state: airport.state,
    timezoneId: airport.timezone_id,
    mississippi_direction:
      airport.mississippi_direction as Airport["mississippi_direction"],
  }
}

function buildTripInput(trip: TripInput): ApiTripInput | null {
  if (!trip.fromIcao || !trip.toIcao) return null
  const fromAirport = toApiAirport(trip.fromIcao)
  const toAirport = toApiAirport(trip.toIcao)
  if (!fromAirport || !toAirport) return null
  if (!trip.tripType || !trip.category || !trip.departLocalISO) return null

  return {
    tripType: trip.tripType as ApiTripInput["tripType"],
    category: trip.category as CategoryId,
    from: fromAirport,
    to: toAirport,
    departLocalISO: trip.departLocalISO,
    returnLocalISO: trip.returnLocalISO || undefined,
    passengers:
      typeof trip.passengers === "number" ? trip.passengers : undefined,
  }
}

const DEFAULT_KNOBS: PricingKnobs = {
  repo: {
    mode: "fixed_base",
    policy: "both",
    vhbSelection: "closest_by_distance",
  },
  time: {
    taxiHoursPerLeg: 0,
    bufferHoursPerLeg: 0,
    applyTo: "both",
  },
  pricing: {
    currency: "USD",
    rateModel: "single_hourly",
    hourlyRate: undefined,
  },
  discounts: {},
  fees: {},
  eligibility: {
    domesticOnly: true,
    maxAdvanceDays: 0,
  },
  results: {
    selection: "lowest",
    rankMetric: "price",
  },
}

// --- Main CalculatorPage layout ---
export default function CalculatorPage() {
  const [tripComplete, setTripComplete] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [trip, setTrip] = useState<TripInput | null>(null)
  const defaultKnobValues = useMemo(
    () => buildDefaultKnobValues(DEFAULT_KNOBS),
    []
  )
  const [knobValues, setKnobValues] =
    useState<KnobValues>(defaultKnobValues)
  const mergedKnobs = useMemo(
    () =>
      mergeDeep(
        DEFAULT_KNOBS,
        buildPricingKnobs(knobValues)
      ) as PricingKnobs,
    [knobValues]
  )
  const knobsReady = useMemo(() => isKnobsReady(mergedKnobs), [mergedKnobs])
  const resultsRef = useRef<HTMLDivElement>(null)

  const tripPayload = useMemo(() => {
    if (!trip) return null
    return buildTripInput(trip)
  }, [trip])

  const handleCalculate = () => {
    if (!tripComplete || isCalculating || !knobsReady) return
    setIsCalculating(true)
    setTimeout(() => {
      setIsCalculating(false)
      if (tripPayload) {
        const payload: QuoteRequestPayload = {
          trip: tripPayload,
          knobs: mergedKnobs,
        }
        logQuoteRequest(payload)
      }
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 900)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-8">
        <Header />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            Import
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            Export
          </button>
        </div>

        {/* Top row: TripPlanner, KnobPanel */}
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          <div className="lg:w-[45%]">
            <TripPlanner
              onTripChangeAction={(nextTrip, complete) => {
                setTrip(nextTrip)
                setTripComplete(complete)
              }}
            />
          </div>
          <div className="lg:w-[55%]">
            <KnobPanel
              tripComplete={tripComplete}
              onKnobsChangeAction={setKnobValues}
              defaultValues={defaultKnobValues}
            />
          </div>
        </div>

          <SummaryPanel
            tripPayload={tripPayload}
            tripDraft={trip}
            knobs={mergedKnobs}
            isCalculating={isCalculating}
            canCalculate={tripComplete && !isCalculating && knobsReady}
            onCalculateAction={handleCalculate}
          />

        {/* Results */}
        <div ref={resultsRef}>
          <ResultsPanel />
        </div>
      </div>
    </div>
  )
}
