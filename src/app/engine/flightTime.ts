// engine/flightTime.ts

import { CategoryId, PricingEngineDeps } from "./quoteRequest"
import { NormalizedLeg } from "./quoteResult"
import { haversineNm } from "./utils"

export async function calcFlightSeconds(
  legs: NormalizedLeg[],
  category: CategoryId,
  external?: PricingEngineDeps["calculateFlightSeconds"]
): Promise<number[]> {
  if (external) {
    return external(
      legs.map((l) => ({ from: l.from, to: l.to, kind: l.kind })),
      category
    )
  }

  const speed = categoryAvgSpeedKnots(category)
  return legs.map((l) => {
    const dNm = haversineNm(l.from.lat, l.from.lon, l.to.lat, l.to.lon)
    const hours = dNm / speed
    return Math.max(0, Math.round(hours * 3600))
  })
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
