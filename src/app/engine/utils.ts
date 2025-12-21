// engine/utils.ts
import { Airport, TripInput } from "./quoteRequest"
import { NormalizedLeg, QuoteResult } from "./quoteResult"

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function roundHours(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

export function uniqByIcao(list: Airport[]): Airport[] {
  const m = new Map<string, Airport>()
  for (const a of list) m.set(a.icao.toUpperCase(), a)
  return Array.from(m.values())
}

export function haversineNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R_km = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const km = R_km * c

  return km * 0.539956803 // km -> NM
}

export function sumAdjustedHours(legs: NormalizedLeg[]): number {
  return legs.reduce((acc, l) => acc + (l.meta?.adjustedHours ?? 0), 0)
}

/** Simple local-date based overnights (demo baseline) */
export function computeOvernights(
  departLocalISO: string,
  returnLocalISO: string
): number {
  const d1 = new Date(departLocalISO)
  const d2 = new Date(returnLocalISO)
  const start = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate())
  const end = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate())
  const diffDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )
  return Math.max(0, diffDays)
}

export function computeCalendarDaysTouched(
  departLocalISO: string,
  returnLocalISO?: string
): number {
  const d1 = new Date(departLocalISO)
  const d2 = returnLocalISO ? new Date(returnLocalISO) : d1
  const start = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate())
  const end = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate())
  const diffDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )
  return Math.max(1, diffDays + 1)
}

export function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function listDatesTouched(
  departLocalISO: string,
  returnLocalISO?: string
): string[] {
  const d1 = new Date(departLocalISO)
  const d2 = returnLocalISO ? new Date(returnLocalISO) : d1

  const start = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate())
  const end = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate())

  const dates: string[] = []
  for (
    let dt = new Date(start);
    dt.getTime() <= end.getTime();
    dt.setDate(dt.getDate() + 1)
  ) {
    dates.push(toYYYYMMDD(dt))
  }
  return dates
}

export function findDailyOverride(
  overrides: Array<{
    startDate: string
    endDate: string
    amountPerDay: number
    label?: string
  }>,
  dateYYYYMMDD: string
) {
  for (const o of overrides) {
    if (dateYYYYMMDD >= o.startDate && dateYYYYMMDD <= o.endDate) return o
  }
  return null
}

export function calcMatchScore(
  occupiedHours: number,
  repoHours: number
): number | undefined {
  const denom = occupiedHours + repoHours
  if (denom <= 0) return undefined
  return (occupiedHours / denom) * 10
}

export function reject(
  code: string,
  message: string,
  fieldPath?: string
): QuoteResult {
  return { status: "REJECTED", rejectReasons: [{ code, message, fieldPath }] }
}

/** Convenience: make 1 occupied leg or 2 for round-trip */
export function buildOccupiedLegs(trip: TripInput): NormalizedLeg[] {
  return trip.tripType === "ONE_WAY"
    ? [{ kind: "OCCUPIED", from: trip.from, to: trip.to }]
    : [
        { kind: "OCCUPIED", from: trip.from, to: trip.to },
        { kind: "OCCUPIED", from: trip.to, to: trip.from },
      ]
}
