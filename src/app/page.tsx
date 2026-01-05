"use client"

// --- Layout and component skeletons for CalculatorPage ---

import { useMemo, useRef, useState, type ChangeEvent } from "react"
import Header from "./components/Header"
import TypeaheadSelect from "./components/TypeaheadSelect"
import TripPlanner, { type TripInput } from "./components/TripPlanner"
import KnobPanel from "./components/KnobPanel"
import ResultsPanel from "./components/ResultsPanel"
import SummaryPanel from "./components/SummaryPanel"
import {
  type PricingKnobs,
  type QuoteRequestPayload,
} from "./engine/quoteRequest"
import { quoteEngine } from "./engine"
import type { QuoteResult } from "./engine/quoteResult"
import { logQuoteRequest } from "./services/calculatePricing"
import {
  areKnobValuesEqual,
  areTripValuesEqual,
  buildDefaultKnobValues,
  buildExportName,
  buildPricingKnobs,
  buildTripInput,
  isKnobsReady,
  mergeDeep,
  normalizeImportedKnobs,
  type KnobValues,
} from "./utils/pageUtils"
import { TEMPLATES } from "./templates"

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
    maxAdvanceDays: 60,
    jetInsights: {},
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
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [importName, setImportName] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [tripSeed, setTripSeed] = useState(0)
  const [knobSeed, setKnobSeed] = useState(0)
  const defaultKnobValues = useMemo(
    () => buildDefaultKnobValues(DEFAULT_KNOBS),
    []
  )
  const [knobDefaults, setKnobDefaults] =
    useState<KnobValues>(defaultKnobValues)
  const [knobValues, setKnobValues] = useState<KnobValues>(defaultKnobValues)
  const mergedKnobs = useMemo(
    () =>
      mergeDeep(DEFAULT_KNOBS, buildPricingKnobs(knobValues)) as PricingKnobs,
    [knobValues]
  )
  const knobsReady = useMemo(() => isKnobsReady(mergedKnobs), [mergedKnobs])
  const resultsRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const tripPayload = useMemo(() => {
    if (!trip) return null
    return buildTripInput(trip)
  }, [trip])

  const handleCalculate = async () => {
    if (!tripComplete || isCalculating || !knobsReady) return
    if (!tripPayload) return
    setIsCalculating(true)
    try {
      const payload: QuoteRequestPayload = {
        trip: tripPayload,
        knobs: mergedKnobs,
      }
      logQuoteRequest(payload)
      const result = await quoteEngine(payload, (message) => {
        console.log(message)
      })
      setQuote(result)
    } catch (error) {
      console.warn("Quote engine failed", error)
      setQuote(null)
    } finally {
      setIsCalculating(false)
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }

  const canExport = tripComplete && !isCalculating && knobsReady

  const handleExport = () => {
    if (!canExport || !trip) return
    const exportName = importName ?? buildExportName(trip)
    const payload = {
      version: 1,
      name: exportName,
      trip,
      knobs: knobValues,
      quote,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${exportName}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleClearAll = () => {
    setImportName(null)
    setSelectedTemplateId("")
    setQuote(null)
    setKnobSeed((prev) => prev + 1)
    setKnobDefaults(defaultKnobValues)
    setKnobValues(defaultKnobValues)
  }

  const applyImportedData = (data: {
    name?: string
    trip?: TripInput
    knobs?: KnobValues
    quote?: QuoteResult | null
  }) => {
    setImportName(data.name ?? null)
    if (data.trip) {
      setTrip(data.trip)
      setTripComplete(false)
      setTripSeed((prev) => prev + 1)
    }
    if (data.knobs) {
      const normalizedKnobs = normalizeImportedKnobs(data.knobs)
      setKnobDefaults(normalizedKnobs)
      setKnobValues(normalizedKnobs)
      setKnobSeed((prev) => prev + 1)
    }
    if (data.quote) {
      setQuote(data.quote)
    } else {
      setQuote(null)
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text) as {
        name?: string
        trip?: TripInput
        knobs?: KnobValues
        quote?: QuoteResult | null
      }
      applyImportedData(data)
    } catch (error) {
      console.warn("Failed to import data", error)
    } finally {
      event.target.value = ""
    }
  }

  const handleTemplateChange = (value: string | number | undefined) => {
    const id = typeof value === "string" ? value : ""
    setSelectedTemplateId(id)
    const template = TEMPLATES.find((item) => item.id === id)
    if (template) {
      applyImportedData(template.data)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-8">
        <Header />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="min-w-[260px]">
            <TypeaheadSelect
              value={selectedTemplateId}
              options={TEMPLATES.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
              placeholder="Select operator..."
              onChange={handleTemplateChange}
              inputClassName="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            Import
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              canExport
                ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            Export
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            Clear All
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImport}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        {/* Top row: TripPlanner, KnobPanel */}
        {importName ? (
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            {importName}
          </div>
        ) : null}

        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          <div className="lg:w-[45%]">
            <TripPlanner
              key={`trip-${tripSeed}`}
              initialTrip={trip ?? undefined}
              onTripChangeAction={(nextTrip, complete) => {
                setTrip((prev) => {
                  if (areTripValuesEqual(prev, nextTrip)) return prev
                  setQuote(null)
                  setImportName(null)
                  setSelectedTemplateId("")
                  return nextTrip
                })
                setTripComplete(complete)
              }}
            />
          </div>
          <div className="lg:w-[55%]">
            <KnobPanel
              key={`knobs-${knobSeed}`}
              tripComplete={tripComplete}
              onKnobsChangeAction={(values) => {
                setKnobValues((prev) => {
                  if (areKnobValuesEqual(prev, values)) return prev
                  setQuote(null)
                  setImportName(null)
                  setSelectedTemplateId("")
                  return values
                })
              }}
              defaultValues={knobDefaults}
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
          <ResultsPanel quote={quote} />
        </div>
      </div>
    </div>
  )
}
