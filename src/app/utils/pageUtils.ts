import type { TripInput } from ".././components/TripPlanner"
import { KNOB_UI_TABS } from ".././components/knobsSchema"
import airportsData from ".././data/airports"
import type {
  Airport,
  CategoryId,
  PricingKnobs,
  TripInput as ApiTripInput,
} from ".././engine/quoteRequest"
import type { MississippiRule } from ".././components/GeoRulesEditor"
import { KnobValue } from "../components/KnobPanel"

export type KnobValues = Record<string, KnobValue>

const TRIP_KEYS: Array<keyof TripInput> = [
  "tripType",
  "category",
  "aircraftModel",
  "fromIcao",
  "toIcao",
  "departLocalISO",
  "returnLocalISO",
  "passengers",
]

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

export function buildPricingKnobs(values: KnobValues) {
  const result: Record<string, unknown> = {}
  Object.entries(values).forEach(([path, value]) => {
    if (value == null || value === "") return
    let finalValue: unknown = value
    let finalPath = path
    if (path.startsWith("fees.landing.")) {
      finalPath = path.replace("fees.landing.", "fees.landingFees.")
    }
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
    if (
      finalPath === "fees.landingFees.countingMode" &&
      finalValue === "landings"
    ) {
      finalValue = "landings_including_repo"
    }
    setNestedValue(result, finalPath, finalValue)
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

export function buildDefaultKnobValues(knobs: PricingKnobs): KnobValues {
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

export function areTripValuesEqual(a: TripInput | null, b: TripInput | null) {
  if (a === b) return true
  if (!a || !b) return false
  return TRIP_KEYS.every((key) => a[key] === b[key])
}

export function areKnobValuesEqual(a: KnobValues, b: KnobValues) {
  if (a === b) return true
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => a[key] === b[key])
}

export function buildExportName(trip: TripInput | null) {
  if (!trip) return "untitled"
  const parts = [
    trip.tripType ?? "trip",
    trip.category ?? "cat",
    trip.fromIcao ?? "from",
    trip.toIcao ?? "to",
  ]
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

type LegacyMississippiRule = {
  type: "mississippi"
  config?: {
    oneWay?: { originSide?: "east" | "west"; destinationSide?: "east" | "west" }
    roundTripShort?: {
      maxOvernights?: number
      originSide?: "east" | "west"
    }
    roundTripLong?: {
      minOvernights?: number
      originSide?: "east" | "west"
      destinationSide?: "east" | "west"
    }
  }
}

function normalizeGeoRulesValue(value: unknown) {
  if (!Array.isArray(value)) return value
  if (value.length === 0) return value
  const first = value[0] as LegacyMississippiRule
  if (!first?.config || first.type !== "mississippi") return value
  const oneWayRequires =
    first.config.oneWay?.originSide === "west" &&
    first.config.oneWay?.destinationSide === "west"
      ? "both_west"
      : "both_east"
  const roundTripUpToNightsRequiresOrigin =
    typeof first.config.roundTripShort?.maxOvernights === "number"
      ? first.config.roundTripShort.maxOvernights
      : 0
  const roundTripUpToNightsSide =
    first.config.roundTripShort?.originSide === "west" ? "west" : "east"
  const roundTripBeyondNightsRequires =
    first.config.roundTripLong?.originSide === "west" &&
    first.config.roundTripLong?.destinationSide === "west"
      ? "both_west"
      : "both_east"

  const normalized: MississippiRule = {
    type: "mississippi_rule",
    oneWayRequires,
    roundTripUpToNightsRequiresOrigin,
    roundTripUpToNightsSide,
    roundTripBeyondNightsRequires,
  }

  return [
    {
      ...normalized,
    },
  ]
}

export function normalizeImportedKnobs(knobs: KnobValues) {
  const next = { ...knobs }
  if (Array.isArray(next["repo.vhbSets.default"])) {
    next["repo.vhbSets.default"] = (
      next["repo.vhbSets.default"] as string[]
    ).join(", ")
  }
  if (Array.isArray(next["fees.highDensity.airports"])) {
    next["fees.highDensity.airports"] = (
      next["fees.highDensity.airports"] as string[]
    ).join(", ")
  }
  if ("eligibility.geoRules" in next) {
    next["eligibility.geoRules"] = normalizeGeoRulesValue(
      next["eligibility.geoRules"]
    ) as KnobValue
  }
  return next
}

export function mergeDeep(
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

export function isKnobsReady(knobs: PricingKnobs) {
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

export function buildTripInput(trip: TripInput): ApiTripInput | null {
  if (!trip.fromIcao || !trip.toIcao) return null
  const fromAirport = toApiAirport(trip.fromIcao)
  const toAirport = toApiAirport(trip.toIcao)
  if (!fromAirport || !toAirport) return null
  if (!trip.tripType || !trip.category || !trip.departLocalISO) return null

  return {
    tripType: trip.tripType as ApiTripInput["tripType"],
    category: trip.category as CategoryId,
    aircraftModelId: trip.aircraftModel || undefined,
    from: fromAirport,
    to: toAirport,
    departLocalISO: trip.departLocalISO,
    returnLocalISO: trip.returnLocalISO || undefined,
    passengers:
      typeof trip.passengers === "number" ? trip.passengers : undefined,
  }
}
