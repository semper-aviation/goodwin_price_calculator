/* ----------------------------- Engine Output ----------------------------- */

import { Airport } from "./quoteRequest"

export type NormalizedLeg = {
  kind: "OCCUPIED" | "REPO"
  from: Airport
  to: Airport
  meta?: {
    chosenBaseIcao?: string
    actualHours?: number
    adjustedHours?: number
    distanceNm?: number
    // Zone-based pricing metadata
    zoneId?: string
    zoneName?: string
    zoneRepoTime?: number         // zone repo time added (origin or destination)
    repoDirection?: "origin" | "destination"
    peakPeriodName?: string
    isPeakOverride?: boolean      // true if peak period overrides the zone repo time
  }
}

export type LineItem = {
  code:
    | "BASE_OCCUPIED"
    | "BASE_REPO"
    | "BASE_REPO_ZONE"
    | "DISCOUNT_VHB"
    | "DISCOUNT_TIME_BASED"
    | "DISCOUNT_MAX_TRIP_PRICE_CAP"
    | "FEE_GROUND_HANDLING"
    | "FEE_HIGH_DENSITY"
    | "FEE_LANDING"
    | "FEE_OVERNIGHT"
    | "FEE_DAILY"
    | "FEE_MIN_PRICE_PER_LEG"
    | "FEE_MIN_TRIP_PRICE"
    | "INFO_MATCH_SCORE"
    | "PEAK_ADJUSTMENT_REPO"
    | "PEAK_ADJUSTMENT_OCCUPIED"
  label: string
  amount: number
  meta?: Record<string, unknown>
}

export type ZoneCalculationInfo = {
  outboundZone?: {
    zoneId: string
    zoneName: string
    selectedAirport: string
    baseRepoTime: number          // base zone repo time (hours)
    appliedRepoTime: number       // applied time (may be peak override)
    repoDirection: "origin"
  }
  inboundZone?: {
    zoneId: string
    zoneName: string
    selectedAirport: string
    baseRepoTime: number
    appliedRepoTime: number
    repoDirection: "destination"
  }
  repoRate?: {
    baseRate: number
    appliedRate: number           // after peak multiplier
  }
  occupiedRate?: {
    baseRate: number
    appliedRate: number
  }
  peakPeriod?: {
    id: string
    name: string
    timeOverrides: {
      outboundRepoTime?: number   // peak override for outbound zone repo time
      inboundRepoTime?: number    // peak override for inbound zone repo time
    }
    multipliers: {
      repoRate?: number           // multiplier for repo rate during peak
      occupied?: number           // multiplier for occupied rate during peak
    }
  }
}

export type QuoteResult = {
  status: "OK" | "REJECTED"
  rejectReasons?: Array<{ code: string; message: string; fieldPath?: string }>

  legs?: NormalizedLeg[]

  times?: {
    occupiedHours: number
    repoHours: number
    totalHours: number
    matchScore?: number
    overnights?: number
    calendarDaysTouched?: number
  }

  lineItems?: LineItem[]

  totals?: {
    baseOccupied: number
    baseRepo: number
    discounts: number
    fees: number
    total: number
  }

  zoneCalculation?: ZoneCalculationInfo
}
