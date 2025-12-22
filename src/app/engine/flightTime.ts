// engine/flightTime.ts

import { CategoryId, TripInput } from "./quoteRequest"
import { NormalizedLeg } from "./quoteResult"
import { haversineNm, toYYYYMMDD } from "./utils"
import aircraftModels from "../data/aircraftModels"
import {
  calculateFlightTimeForModels,
  IGoodwinCalculatorFlightLegsInput,
} from "../services/FlightTimeCalculatorService"

export async function calcFlightSeconds(
  legs: NormalizedLeg[],
  category: CategoryId,
  trip: TripInput
): Promise<number[]> {
  const fallback = () => {
    console.log("Using fallback flight time calculations")
    const speed = categoryAvgSpeedKnots(category)
    return legs.map((l) => {
      const dNm = haversineNm(l.from.lat, l.from.lon, l.to.lat, l.to.lon)
      const hours = dNm / speed
      return Math.max(0, Math.round(hours * 3600))
    })
  }

  const selectedModelId = trip.aircraftModelId
  const selectedModel =
    selectedModelId &&
    aircraftModels.find((model) => model.model_id === selectedModelId)
  const modelsForCategory = selectedModel
    ? [selectedModel]
    : aircraftModels.filter(
        (model) => model.guid === category && model.model_id
      )

  if (modelsForCategory.length === 0) {
    return fallback()
  }

  const modelInputs = modelsForCategory.map((model) => ({
    modelId: model.model_id,
    avgSpeedKnots:
      model.model_speed ??
      model.category_speed ??
      categoryAvgSpeedKnots(category),
  }))

  const flightLegsInput = buildFlightLegsInput(legs, trip)
  try {
    const results = await calculateFlightTimeForModels({
      aircraftModels: modelInputs,
      flightLegs: flightLegsInput,
      addTaxiTime: false,
    })

    const perLegTotals = new Array(legs.length).fill(0)
    let modelCount = 0

    for (const model of modelInputs) {
      const details = results[model.modelId]?.durationDetails
      if (!details || details.length < legs.length) continue
      for (let i = 0; i < legs.length; i++) {
        perLegTotals[i] += details[i]?.durationSec ?? 0
      }
      modelCount += 1
    }

    if (modelCount > 0) {
      return perLegTotals.map((total) =>
        Math.max(0, Math.round(total / modelCount))
      )
    }
  } catch (error) {
    console.warn("Flight time API error, using fallback calculations", error)
    return fallback()
  }
  return fallback()
}

function categoryAvgSpeedKnots(category: CategoryId): number {
  switch (category) {
    case "CAT1":
      return 160
    case "CAT2":
      return 260
    case "CAT3":
      return 330
    case "CAT4":
      return 380
    case "CAT5":
      return 410
    case "CAT6":
      return 430
    case "CAT7":
      return 450
    case "CAT8":
      return 470
    default:
      return 430
  }
}

function buildFlightLegsInput(
  legs: NormalizedLeg[],
  trip: TripInput
): IGoodwinCalculatorFlightLegsInput {
  const now = new Date()
  const departDateTime = safeDate(trip.departLocalISO) ?? now
  const returnDateTime =
    (trip.returnLocalISO ? safeDate(trip.returnLocalISO) : null) ??
    departDateTime

  const occupiedIdxs = legs
    .map((leg, index) => (leg.kind === "OCCUPIED" ? index : -1))
    .filter((index) => index >= 0)
  const firstOccupiedIdx = occupiedIdxs[0] ?? -1
  const lastOccupiedIdx =
    occupiedIdxs.length > 0 ? occupiedIdxs[occupiedIdxs.length - 1] : -1

  return {
    flightLegs: legs.map((leg, index) => {
      const { date, time } = pickLegDateTime(
        leg,
        index,
        trip,
        occupiedIdxs,
        firstOccupiedIdx,
        lastOccupiedIdx,
        departDateTime,
        returnDateTime
      )

      return {
        originIcao: leg.from.icao,
        destinationIcao: leg.to.icao,
        departDate: date,
        departTime: time,
        originLat: leg.from.lat,
        originLon: leg.from.lon,
        destinationLat: leg.to.lat,
        destinationLon: leg.to.lon,
      }
    }),
  }
}

function pickLegDateTime(
  leg: NormalizedLeg,
  index: number,
  trip: TripInput,
  occupiedIdxs: number[],
  firstOccupiedIdx: number,
  lastOccupiedIdx: number,
  departDateTime: Date,
  returnDateTime: Date
) {
  if (trip.tripType === "ROUND_TRIP" && trip.returnLocalISO) {
    if (index > lastOccupiedIdx && lastOccupiedIdx >= 0) {
      return formatDateTime(returnDateTime)
    }
    if (leg.kind === "REPO" && firstOccupiedIdx >= 0 && lastOccupiedIdx >= 0) {
      const position = index < firstOccupiedIdx ? "outbound" : "inbound"
      return position === "inbound"
        ? formatDateTime(returnDateTime)
        : formatDateTime(departDateTime)
    }
    if (leg.kind === "OCCUPIED" && occupiedIdxs.length > 1) {
      const isReturnLeg = index === occupiedIdxs[occupiedIdxs.length - 1]
      const occupiedIdx = isReturnLeg ? "inbound" : "outbound"
      return occupiedIdx === "inbound"
        ? formatDateTime(returnDateTime)
        : formatDateTime(departDateTime)
    }
  }

  return formatDateTime(departDateTime)
}

function formatDateTime(d: Date) {
  return {
    date: toYYYYMMDD(d),
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  }
}

function pad2(value: number) {
  return value.toString().padStart(2, "0")
}

function safeDate(value?: string) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
