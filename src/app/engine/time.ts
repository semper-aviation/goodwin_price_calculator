// engine/time.ts
import { PricingKnobs, TripInput } from "./quoteRequest"
import { NormalizedLeg } from "./quoteResult"
import { Result, ok, err } from "./types"
import {
  clamp,
  haversineNm,
  roundHours,
  computeCalendarDaysTouched,
  reject,
  sumAdjustedHours,
} from "./utils"

export function applyTimeAdjustmentsAndValidate(args: {
  trip: TripInput
  knobs: PricingKnobs
  legs: NormalizedLeg[]
  actualSeconds: number[]
}): Result<{
  legsWithTime: NormalizedLeg[]
  occupiedHours: number
  repoHours: number
  totalHours: number
}> {
  const { trip, knobs, legs, actualSeconds } = args

  const taxi = clamp(knobs.time.taxiHoursPerLeg, 0, 10)
  const buffer = clamp(knobs.time.bufferHoursPerLeg, 0, 10)
  const applyTo = knobs.time.applyTo
  const mins = knobs.time.minimums ?? {}

  const actualHours = actualSeconds.map((s) => s / 3600)

  if (typeof mins.minActualFlightHoursPerLeg === "number") {
    for (let i = 0; i < legs.length; i++) {
      if (legs[i].kind !== "OCCUPIED") continue
      const a = actualHours[i]
      if (a < mins.minActualFlightHoursPerLeg) {
        return err(
          reject(
            "MIN_LEG_TIME",
            `Occupied leg ${legs[i].from.icao}→${
              legs[i].to.icao
            } actual ${a.toFixed(2)}h < min ${
              mins.minActualFlightHoursPerLeg
            }h`,
            "time.minimums.minActualFlightHoursPerLeg"
          )
        )
      }
    }
  }

  if (typeof mins.minFirstOccupiedLegHours === "number") {
    const idx = legs.findIndex((l) => l.kind === "OCCUPIED")
    if (idx >= 0) {
      const a = actualHours[idx]
      if (a < mins.minFirstOccupiedLegHours) {
        return err(
          reject(
            "MIN_FIRST_OCCUPIED",
            `First occupied leg actual ${a.toFixed(2)}h < min ${
              mins.minFirstOccupiedLegHours
            }h`,
            "time.minimums.minFirstOccupiedLegHours"
          )
        )
      }
    }
  }

  const legsWithTime: NormalizedLeg[] = legs.map((leg, i) => {
    const a = actualHours[i]
    const adjust =
      applyTo === "both" ||
      (applyTo === "occupied" && leg.kind === "OCCUPIED") ||
      (applyTo === "repo" && leg.kind === "REPO")

    const adj = adjust ? a + taxi + buffer : a

    return {
      ...leg,
      meta: {
        ...(leg.meta ?? {}),
        actualHours: a,
        adjustedHours: adj,
        distanceNm: haversineNm(
          leg.from.lat,
          leg.from.lon,
          leg.to.lat,
          leg.to.lon
        ),
      },
    }
  })

  const occupiedHours = roundHours(
    sumAdjustedHours(legsWithTime.filter((l) => l.kind === "OCCUPIED"))
  )
  const repoHours = roundHours(
    sumAdjustedHours(legsWithTime.filter((l) => l.kind === "REPO"))
  )
  const totalHours = roundHours(occupiedHours + repoHours)

  if (
    typeof mins.minTotalTripHours === "number" &&
    totalHours < mins.minTotalTripHours
  ) {
    return err(
      reject(
        "MIN_TOTAL_TIME",
        `Total time ${totalHours.toFixed(2)}h < min ${mins.minTotalTripHours}h`,
        "time.minimums.minTotalTripHours"
      )
    )
  }

  if (
    typeof mins.minOccupiedHoursTotal === "number" &&
    occupiedHours < mins.minOccupiedHoursTotal
  ) {
    return err(
      reject(
        "MIN_OCCUPIED_TOTAL",
        `Occupied time ${occupiedHours.toFixed(2)}h < min ${
          mins.minOccupiedHoursTotal
        }h`,
        "time.minimums.minOccupiedHoursTotal"
      )
    )
  }

  const maxOccPerDay = knobs.time.dailyLimits?.maxOccupiedHoursPerDay
  if (typeof maxOccPerDay === "number") {
    const daysTouched = computeCalendarDaysTouched(
      trip.departLocalISO,
      trip.tripType === "ROUND_TRIP" ? trip.returnLocalISO : undefined
    )
    const avg = daysTouched > 0 ? occupiedHours / daysTouched : occupiedHours
    if (avg > maxOccPerDay + 1e-9) {
      return err(
        reject(
          "DAILY_OCCUPIED_LIMIT",
          `Avg occupied hours/day ${avg.toFixed(2)}h > max ${maxOccPerDay}h`,
          "time.dailyLimits.maxOccupiedHoursPerDay"
        )
      )
    }
  }

  return ok({ legsWithTime, occupiedHours, repoHours, totalHours })
}
