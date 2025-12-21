"use client"
import { useEffect, useMemo, useState } from "react"
import Card from "./Card"
import airportsData, { type Airport } from "../data/airports"
import aircraftModels from "../data/aircraftModels"
import TypeaheadSelect from "./TypeaheadSelect"

// --- Types and Schema (copy from docs or import if available) ---
export type TripType = "ONE_WAY" | "ROUND_TRIP"
export type CategoryId =
  | "CAT1"
  | "CAT2"
  | "CAT3"
  | "CAT4"
  | "CAT5"
  | "CAT6"
  | "CAT7"
  | "CAT8"

export type TripInput = {
  tripType?: TripType
  category?: CategoryId
  aircraftModel?: string
  fromIcao?: string
  toIcao?: string
  departLocalISO?: string
  returnLocalISO?: string
  passengers?: number
}

export type TripUiField =
  | {
      type: "select"
      path: keyof TripInput
      label: string
      why: string
      help: string
      options: { label: string; value: string }[]
      required?: boolean
      enabledWhen?: string
    }
  | {
      type: "airport"
      path: keyof TripInput
      label: string
      why: string
      help: string
      required?: boolean
      enabledWhen?: string
      placeholder?: string
    }
  | {
      type: "datetime"
      path: keyof TripInput
      label: string
      why: string
      help: string
      required?: boolean
      enabledWhen?: string
      minNow?: boolean
    }
  | {
      type: "number"
      path: keyof TripInput
      label: string
      why: string
      help: string
      required?: boolean
      enabledWhen?: string
      min?: number
      max?: number
      step?: number
    }

export type TripUiSection = {
  title: string
  description?: string
  fields: TripUiField[]
}

export type TripPlannerSchema = {
  title: string
  sections: TripUiSection[]
}

export const TRIP_PLANNER_SCHEMA: TripPlannerSchema = {
  // ...schema from docs...
  // (copy the schema object from your docs here)
  // ...existing code...
  title: "Trip Planner",
  sections: [
    // ...existing code...
    // (copy all sections from docs)
    {
      title: "Trip Basics",
      description:
        "These fields define the scenario the calculator will price.",
      fields: [
        {
          type: "select",
          path: "tripType",
          label: "Trip type",
          why: "Determines whether we price one leg or an out-and-back itinerary.",
          help:
            "Trip type controls the passenger itinerary.\n\n" +
            "- One-way: origin → destination\n" +
            "- Round-trip: origin → destination → origin\n\n" +
            "Some fees (like overnights) apply only to round-trips.",
          options: [
            { label: "One-way", value: "ONE_WAY" },
            { label: "Round-trip", value: "ROUND_TRIP" },
          ],
      required: true,
        },
        {
          type: "select",
          path: "category",
          label: "Aircraft category",
          why: "Sets a speed baseline used to estimate flight time (and therefore cost).",
          help:
            "Aircraft category is used as a performance baseline for time estimates.\n\n" +
            "If you later model specific aircraft, category can still be used for defaults.",
          options: [
            { label: "Piston", value: "CAT1" },
            { label: "Turboprop", value: "CAT2" },
            { label: "Very Light Jet", value: "CAT3" },
            { label: "Light Jet", value: "CAT4" },
            { label: "Super Light Jet", value: "CAT5" },
            { label: "Mid-Size Jet", value: "CAT6" },
            { label: "Super Midsize Jet", value: "CAT7" },
            { label: "Heavy Jet", value: "CAT8" },
          ],
      required: true,
        },
      ],
    },
    {
      title: "Route",
      description: "Where the aircraft is flying.",
      fields: [
        {
          type: "airport",
          path: "fromIcao",
          label: "From airport (ICAO)",
          why: "Trip origin airport. Used to compute flight time and repo.",
          help:
            "Enter an ICAO airport code (e.g., KTEB).\n\n" +
            "This airport anchors:\n" +
            "- occupied leg flight time\n" +
            "- repositioning (repo) legs\n" +
            "- high-density / landing fee checks",
          placeholder: "e.g., KTEB",
      required: true,
        },
        {
          type: "airport",
          path: "toIcao",
          label: "To airport (ICAO)",
          why: "Trip destination airport. Used to compute flight time and repo.",
          help:
            "Enter an ICAO airport code (e.g., KMIA).\n\n" +
            "This airport anchors:\n" +
            "- occupied leg flight time\n" +
            "- repositioning (repo) legs\n" +
            "- fee checks (HD, landing, overnight)",
          placeholder: "e.g., KMIA",
      required: true,
        },
      ],
    },
    {
      title: "Schedule",
      description:
        "When the trip happens. Used for eligibility checks and calendar-day fees.",
      fields: [
        {
          type: "datetime",
          path: "departLocalISO",
          label: "Departure (local)",
          why: "Used to compute advance booking window and calendar days touched.",
          help:
            "Departure time is used for:\n" +
            "- advance booking eligibility (max advance days)\n" +
            "- determining calendar days touched (daily fees)\n" +
            "- overnight calculations (round trips)",
      required: true,
        },
        {
          type: "datetime",
          path: "returnLocalISO",
          label: "Return (local)",
          why: "Only required for round-trips. Used to compute overnights and day counts.",
          help:
            "Return time is used for:\n" +
            "- counting overnights\n" +
            "- splitting trips (if overnights exceed threshold)\n" +
            "- daily fee calculations (calendar days touched)",
      required: false,
          enabledWhen: "trip.tripType === 'ROUND_TRIP'",
        },
      ],
    },
    {
      title: "Optional",
      description:
        "Not required for a quote, but can trigger constraints (like pax limits).",
      fields: [
        {
          type: "number",
          path: "passengers",
          label: "Passengers",
          why: "Used for eligibility checks if pax limits are enabled.",
          help:
            "Passenger count can trigger eligibility rules.\n\n" +
            "If 'maxPassengers' is set in eligibility knobs, exceeding it will reject the quote.",
          min: 1,
          max: 19,
          step: 1,
          required: false,
        },
      ],
    },
  ],
}

export const EMPTY_TRIP: TripInput = {
  tripType: undefined,
  category: undefined,
  aircraftModel: undefined,
  fromIcao: undefined,
  toIcao: undefined,
  departLocalISO: undefined,
  returnLocalISO: undefined,
  passengers: undefined,
}

export function isTripComplete(trip: TripInput): boolean {
  if (!trip.tripType) return false
  if (!trip.category) return false
  if (!trip.fromIcao || !trip.toIcao) return false
  if (!trip.departLocalISO) return false
  if (trip.tripType === "ROUND_TRIP" && !trip.returnLocalISO) return false
  return true
}

// Convert airportsData to dropdown options
type AirportOption = {
  label: string
  value: Airport
}
const AIRPORTS_OPTIONS: AirportOption[] = airportsData.map((a) => ({
  label: a.icao,
  value: a,
}))
const CONTROL_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
const AIRCRAFT_MODELS = aircraftModels
  .slice()
  .filter((model) => model.guid && model.name)
  .sort((a, b) => {
    const aOrder = a.sort_order ?? 0
    const bOrder = b.sort_order ?? 0
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name!.localeCompare(b.name!)
  })

type AircraftModelOption = {
  label: string
  value: string
  category: string
}
const AIRCRAFT_MODEL_OPTIONS: AircraftModelOption[] = AIRCRAFT_MODELS.map(
  (model) => ({
    label: model.name!,
    value: model.name!,
    category: model.guid!,
  })
)

function AirportDropdownField({
  label,
  value,
  required,
  onChange,
}: {
  label: string
  value: Airport | undefined
  required?: boolean
  onChange: (v: Airport | undefined) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasTyped, setHasTyped] = useState(false)

  const suggestions = useMemo(() => {
    if (!hasTyped) return AIRPORTS_OPTIONS.slice(0, 10)
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return AIRPORTS_OPTIONS.slice(0, 10)
    const matches = AIRPORTS_OPTIONS.filter((opt) => {
      const icao = opt.label.toLowerCase()
      const name = (opt.value.name ?? "").toLowerCase()
      const city = (opt.value.city ?? "").toLowerCase()
      const state = opt.value.state.toLowerCase()
      return (
        icao.includes(trimmed) ||
        name.includes(trimmed) ||
        city.includes(trimmed) ||
        state.includes(trimmed)
      )
    })
    return matches.slice(0, 10)
  }, [query, hasTyped])

  const formatOptionLabel = (airport: Airport) => {
    const parts = []
    if (airport.city) parts.push(airport.city)
    if (airport.state) parts.push(airport.state)
    return `${airport.name ?? airport.icao}${
      parts.length ? ` (${parts.join(", ")})` : ""
    }`
  }

  return (
    <div className="mb-4 relative">
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {label}
        {required ? <span className="ml-1 text-amber-600">*</span> : null}
      </label>
      <div className="relative">
        <input
          type="text"
          className={`${CONTROL_CLASSES} pr-10`}
          placeholder="Type ICAO, airport name, or city..."
          value={isEditing ? query : value?.icao ?? ""}
          onChange={(e) => {
            setQuery(e.target.value)
            setHasTyped(true)
            setOpen(true)
            if (e.target.value.trim() === "") {
              onChange(undefined)
            }
          }}
          onFocus={() => {
            setQuery(value?.icao ?? "")
            setHasTyped(false)
            setIsEditing(true)
            setOpen(true)
          }}
          onBlur={() => {
            setTimeout(() => {
              setOpen(false)
              setIsEditing(false)
            }, 120)
          }}
        />
        {(value || query.trim()) && (
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("")
              setHasTyped(false)
              setIsEditing(true)
              setOpen(true)
              onChange(undefined)
            }}
            aria-label="Clear selection"
          >
            <span className="-mt-px">×</span>
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              No matching airports.
            </div>
          ) : (
            suggestions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt.value)
                  setQuery(opt.value.icao)
                  setOpen(false)
                  setIsEditing(false)
                  setHasTyped(false)
                }}
              >
                <span className="min-w-[3.5rem] font-semibold text-slate-700">
                  {opt.value.icao}
                </span>
                <span className="text-slate-600">
                  {formatOptionLabel(opt.value)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function AircraftModelDropdownField({
  label,
  value,
  required,
  options,
  onChange,
}: {
  label: string
  value: string | undefined
  required?: boolean
  options: AircraftModelOption[]
  onChange: (v: string | undefined) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasTyped, setHasTyped] = useState(false)

  const suggestions = useMemo(() => {
    if (!hasTyped) return options.slice(0, 10)
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return options.slice(0, 10)
    const matches = options.filter((opt) =>
      opt.label.toLowerCase().includes(trimmed)
    )
    return matches.slice(0, 10)
  }, [options, query, hasTyped])

  return (
    <div className="mb-4 relative">
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {label}
        {required ? <span className="ml-1 text-amber-600">*</span> : null}
      </label>
      <div className="relative">
        <input
          type="text"
          className={`${CONTROL_CLASSES} h-11 pr-10 leading-5`}
          placeholder="Type aircraft model..."
          value={isEditing ? query : value ?? ""}
          onChange={(e) => {
            setQuery(e.target.value)
            setHasTyped(true)
            setOpen(true)
            if (e.target.value.trim() === "") {
              onChange(undefined)
            }
          }}
          onFocus={() => {
            setQuery(value ?? "")
            setHasTyped(false)
            setIsEditing(true)
            setOpen(true)
          }}
          onBlur={() => {
            setTimeout(() => {
              setOpen(false)
              setIsEditing(false)
            }, 120)
          }}
        />
        {(value || query.trim()) && (
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("")
              setHasTyped(false)
              setIsEditing(true)
              setOpen(true)
              onChange(undefined)
            }}
            aria-label="Clear selection"
          >
            <span className="-mt-px">×</span>
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              No matching models.
            </div>
          ) : (
            suggestions.map((opt) => (
              <button
                key={`${opt.category}-${opt.value}`}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt.value)
                  setQuery(opt.label)
                  setOpen(false)
                  setIsEditing(false)
                  setHasTyped(false)
                }}
              >
                <span className="text-slate-700">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// --- Field Renderer ---
function Field({
  field,
  value,
  onChange,
  trip,
}: {
  field: TripUiField
  value: string | number | undefined
  onChange: (v: string | number | undefined) => void
  trip: TripInput
}) {
  // enabledWhen logic using React state instead of eval
  if (field.enabledWhen) {
    if (
      field.enabledWhen === "trip.tripType === 'ROUND_TRIP'" &&
      trip.tripType !== "ROUND_TRIP"
    ) {
      return null
    }
  }

  switch (field.type) {
    case "select":
      return (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {field.label}
            {field.required ? (
              <span className="ml-1 text-amber-600">*</span>
            ) : null}
          </label>
          <TypeaheadSelect
            value={value as string | undefined}
            options={field.options}
            onChange={(v) => onChange(typeof v === "string" ? v : undefined)}
            inputClassName={`${CONTROL_CLASSES} pr-10`}
          />
        </div>
      )
    case "airport":
      // This is now handled by AirportDropdownField in the main component
      return null
    case "datetime":
      return (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {field.label}
            {field.required ? (
              <span className="ml-1 text-amber-600">*</span>
            ) : null}
          </label>
          <input
            type="datetime-local"
            className={CONTROL_CLASSES}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </div>
      )
    case "number":
      return (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {field.label}
            {field.required ? (
              <span className="ml-1 text-amber-600">*</span>
            ) : null}
          </label>
          <input
            type="number"
            className={CONTROL_CLASSES}
            value={
              typeof value === "number" || typeof value === "string"
                ? value
                : ""
            }
            min={typeof field.min === "number" ? field.min : undefined}
            max={typeof field.max === "number" ? field.max : undefined}
            step={typeof field.step === "number" ? field.step : undefined}
            onChange={(e) =>
              onChange(
                e.target.value === "" ? undefined : Number(e.target.value)
              )
            }
          />
        </div>
      )
    default:
      return null
  }
}

// --- Main TripPlanner ---
export default function TripPlanner({
  onTripChangeAction,
}: {
  onTripChangeAction?: (trip: TripInput, complete: boolean) => void
}) {
  const [trip, setTrip] = useState<TripInput>({ ...EMPTY_TRIP })

  useEffect(() => {
    if (onTripChangeAction) onTripChangeAction(trip, isTripComplete(trip))
  }, [trip, onTripChangeAction])

  const modelOptions = useMemo(() => {
    if (!trip.category) return AIRCRAFT_MODEL_OPTIONS
    return AIRCRAFT_MODEL_OPTIONS.filter(
      (option) => option.category === trip.category
    )
  }, [trip.category])

  // Find selected airport objects for dropdowns
  const fromAirportObj = AIRPORTS_OPTIONS.find(
    (opt) => opt.value.icao === trip.fromIcao
  )?.value
  const toAirportObj = AIRPORTS_OPTIONS.find(
    (opt) => opt.value.icao === trip.toIcao
  )?.value

  return (
    <Card title={TRIP_PLANNER_SCHEMA.title}>
      <div className="space-y-6">
        {/* Row 1: Trip type and Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Field
              field={TRIP_PLANNER_SCHEMA.sections[0].fields[0]}
              value={trip.tripType ?? ""}
              onChange={(v) =>
                setTrip({
                  ...trip,
                  tripType: typeof v === "string" ? (v as TripType) : undefined,
                })
              }
              trip={trip}
            />
          </div>
          <div className="md:col-span-1">
            <Field
              field={TRIP_PLANNER_SCHEMA.sections[0].fields[1]}
              value={trip.category ?? ""}
              onChange={(v) =>
                setTrip((prev) => {
                  const nextCategory =
                    typeof v === "string" ? (v as CategoryId) : undefined
                  const nextTrip = { ...prev, category: nextCategory }
                  if (nextCategory) {
                    const stillValid = AIRCRAFT_MODEL_OPTIONS.some(
                      (option) =>
                        option.category === nextCategory &&
                        option.value === prev.aircraftModel
                    )
                    if (!stillValid) {
                      nextTrip.aircraftModel = undefined
                    }
                  }
                  return nextTrip
                })
              }
              trip={trip}
            />
          </div>
          <div className="md:col-span-1">
          <AircraftModelDropdownField
            label="Aircraft model"
            value={trip.aircraftModel}
            required={true}
            options={modelOptions}
            onChange={(v) =>
              setTrip({
                ...trip,
                aircraftModel: v || undefined,
              })
            }
          />
          </div>
        </div>
        {/* Row 2: From and To ICAO as dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AirportDropdownField
            label="From airport (ICAO)"
            value={fromAirportObj}
            required={true}
            onChange={(v) =>
              setTrip({ ...trip, fromIcao: v ? v.icao : undefined })
            }
          />
          <AirportDropdownField
            label="To airport (ICAO)"
            value={toAirportObj}
            required={true}
            onChange={(v) =>
              setTrip({ ...trip, toIcao: v ? v.icao : undefined })
            }
          />
        </div>
        {/* Row 3: Depart and Return Date Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field
            field={TRIP_PLANNER_SCHEMA.sections[2].fields[0]}
            value={
              typeof trip.departLocalISO === "string" ? trip.departLocalISO : ""
            }
            onChange={(v) =>
              setTrip({
                ...trip,
                departLocalISO: typeof v === "string" ? v : "",
              })
            }
            trip={trip}
          />
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Return (local)
              {trip.tripType === "ROUND_TRIP" ? (
                <span className="ml-1 text-amber-600">*</span>
              ) : null}
            </label>
            <input
              type="datetime-local"
              className={CONTROL_CLASSES}
              value={
                typeof trip.returnLocalISO === "string"
                  ? trip.returnLocalISO
                  : ""
              }
              onChange={(e) =>
                setTrip({
                  ...trip,
                  returnLocalISO:
                    e.target.value !== "" ? e.target.value : undefined,
                })
              }
              disabled={trip.tripType !== "ROUND_TRIP"}
            />
          </div>
        </div>
        {/* Row 4: Optional Passengers */}
        <div>
          <Field
            field={TRIP_PLANNER_SCHEMA.sections[3].fields[0]}
            value={trip.passengers}
            onChange={(v) =>
              setTrip({
                ...trip,
                passengers: typeof v === "number" ? v : undefined,
              })
            }
            trip={trip}
          />
        </div>
      </div>
    </Card>
  )
}
