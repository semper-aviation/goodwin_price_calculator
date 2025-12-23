import { FlightLegInput } from "../engine/quoteRequest"
import { haversineNm } from "../engine/utils"

export type IGoodwinCalculatorFlightLegsInput = {
  flightLegs: FlightLegInput[]
}

export type ICalculatedFlightTime = {
  durationDetails: Array<{
    originIcao: string
    destinationIcao: string
    departDate: string
    departTime?: string
    durationSec: number
  }>
}

const DEFAULT_TAXI_SECONDS = 12 * 60 // 12 mins

type FlightTimeApiResponse = {
  data?: {
    results?: Array<{
      modelId?: string
      flightLegs?: Array<{
        departDate?: string
        departTime?: string
        origin?: { icao?: string }
        destination?: { icao?: string }
        flightTime?: { flightTimeSec?: number }
        flightTimeAscDescAdjusted?: { flightTimeSec?: number }
      }>
    }>
  }
}

const getTaxiTime = () => {
  const taxiTime = parseInt(
    process.env.NEXT_PUBLIC_TAXI_TIME_MINUTES ?? "0",
    10
  )
  return Number.isNaN(taxiTime) ? 0 : taxiTime
}

function buildFallbackResult(
  modelId: string,
  avgSpeedKnots: number,
  flightLegs: IGoodwinCalculatorFlightLegsInput,
  addTaxiTime: boolean
): ICalculatedFlightTime {
  const durationDetails = flightLegs.flightLegs.map((leg) => {
    const distanceNm = haversineNm(
      leg.originLat,
      leg.originLon,
      leg.destinationLat,
      leg.destinationLon
    )
    const hours = avgSpeedKnots > 0 ? distanceNm / avgSpeedKnots : 0
    const durationSec = Math.max(
      0,
      Math.round(hours * 3600) + (addTaxiTime ? DEFAULT_TAXI_SECONDS : 0)
    )
    return {
      originIcao: leg.originIcao,
      destinationIcao: leg.destinationIcao,
      departDate: leg.departDate,
      departTime: leg.departTime,
      durationSec,
    }
  })

  return {
    durationDetails,
  }
}

export const calculateFlightTimeForModels = async (input: {
  aircraftModels: { modelId: string; avgSpeedKnots: number }[]
  flightLegs: IGoodwinCalculatorFlightLegsInput
  addTaxiTime?: boolean
}): Promise<Record<string, ICalculatedFlightTime>> => {
  const { aircraftModels, flightLegs, addTaxiTime = true } = input
  const taxiTimePerLegInSeconds = getTaxiTime() * 60
  try {
    const response = await fetch("/api/flight-time", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        aircraftModels,
        flightLegs,
        addTaxiTime,
      }),
    })

    if (!response.ok) {
      console.warn("Flight time API returned non-OK status", response.status)
      throw new Error(`Flight time API failed: ${response.status}`)
    }

    const payload = (await response.json()) as FlightTimeApiResponse
    const results = payload.data?.results ?? []
    const mapped: Record<string, ICalculatedFlightTime> = {}

    results.forEach((result) => {
      if (!result?.modelId) return
      const durationDetails =
        result.flightLegs?.map((leg) => ({
          originIcao: leg.origin?.icao ?? "",
          destinationIcao: leg.destination?.icao ?? "",
          departDate: leg.departDate ?? "",
          departTime: leg.departTime,
          durationSec: addTaxiTime
            ? (leg.flightTimeAscDescAdjusted?.flightTimeSec ??
                leg.flightTime?.flightTimeSec ??
                0) + taxiTimePerLegInSeconds
            : leg.flightTimeAscDescAdjusted?.flightTimeSec ??
              leg.flightTime?.flightTimeSec ??
              0,
        })) ?? []
      mapped[result.modelId] = {
        durationDetails,
      }
    })

    aircraftModels.forEach((model) => {
      if (!mapped[model.modelId]) {
        mapped[model.modelId] = buildFallbackResult(
          model.modelId,
          model.avgSpeedKnots,
          flightLegs,
          addTaxiTime
        )
      }
    })

    return mapped
  } catch (error) {
    console.warn("Flight time API request failed, using fallback", error)
    return Object.fromEntries(
      aircraftModels.map((model) => [
        model.modelId,
        buildFallbackResult(
          model.modelId,
          model.avgSpeedKnots,
          flightLegs,
          addTaxiTime
        ),
      ])
    )
  }
}
