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
  }
}

export type LineItem = {
  code:
    | "BASE_OCCUPIED"
    | "BASE_REPO"
    | "DISCOUNT_VHB"
    | "FEE_GROUND_HANDLING"
    | "FEE_HIGH_DENSITY"
    | "FEE_LANDING"
    | "FEE_OVERNIGHT"
    | "FEE_DAILY"
    | "INFO_MATCH_SCORE"
  label: string
  amount: number
  meta?: Record<string, unknown>
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
}
