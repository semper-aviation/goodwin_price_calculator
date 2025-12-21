// engine/repo.ts
import type { Airport, PricingKnobs, CategoryId } from "./quoteRequest"
import type { NormalizedLeg, QuoteResult } from "./quoteResult"
import { Result, ok, err } from "./types"
import { haversineNm, uniqByIcao, reject } from "./utils"

export async function resolveVhbCandidates(
  category: CategoryId,
  knobs: PricingKnobs
): Promise<Airport[]> {
  const fromDefault: Airport[] = knobs.repo.vhbSets?.default ?? []

  // If you still keep byCategory as ICAO strings, you’ll need a resolver.
  // If you switch it to Airport[] (recommended), do:
  // const fromByCat: Airport[] = knobs.repo.vhbSets?.byCategory?.[category] ?? [];

  // With your current schema (byCategory: Partial<Record<CategoryId, string[]>>)
  // and fixedBaseIcao now being Airport, I'd recommend:
  // - drop byCategory ICAO strings entirely OR convert it to Airport[].
  // For now: just ignore byCategory to stay strict + no resolver.
  return uniqByIcao(fromDefault)
}

export function buildRepoLegs(args: {
  itineraryStart: Airport
  itineraryEnd: Airport
  knobs: PricingKnobs
  vhbCandidates: Airport[]
}): Result<{
  legsOut: NormalizedLeg[]
  legsBack: NormalizedLeg[]
  chosenOutBase?: Airport
  chosenBackBase?: Airport
}> {
  const { itineraryStart, itineraryEnd, knobs, vhbCandidates } = args

  const mode = knobs.repo.mode
  const policy = knobs.repo.policy

  let baseOut: Airport | null = null
  let baseBack: Airport | null = null

  if (mode === "fixed_base") {
    const base = knobs.repo.fixedBaseIcao // <-- Airport object (your updated schema)
    if (!base) {
      return err(
        reject(
          "MISSING_BASE",
          "repo.fixedBaseIcao (Airport) required when repo.mode=fixed_base",
          "repo.fixedBaseIcao"
        )
      )
    }
    baseOut = base
    baseBack = base
  } else {
    // vhb_network
    if (!vhbCandidates.length) {
      return err(
        reject(
          "MISSING_VHB_LIST",
          "VHB candidate list is empty.",
          "repo.vhbSets.default"
        )
      )
    }
    baseOut = findClosestAirportByDistance(itineraryStart, vhbCandidates)
    baseBack = findClosestAirportByDistance(itineraryEnd, vhbCandidates)

    if (!baseOut || !baseBack) {
      return err(
        reject(
          "VHB_NOT_FOUND",
          "Could not resolve closest VHB.",
          "repo.vhbSets.default"
        )
      )
    }
  }

  const legsOut: NormalizedLeg[] = []
  const legsBack: NormalizedLeg[] = []

  if (policy === "both" || policy === "outbound_only") {
    if (
      baseOut &&
      baseOut.icao.toUpperCase() !== itineraryStart.icao.toUpperCase()
    ) {
      legsOut.push({
        kind: "REPO",
        from: baseOut,
        to: itineraryStart,
        meta: { chosenBaseIcao: baseOut.icao },
      })
    }
  }

  if (policy === "both" || policy === "inbound_only") {
    if (
      baseBack &&
      itineraryEnd.icao.toUpperCase() !== baseBack.icao.toUpperCase()
    ) {
      legsBack.push({
        kind: "REPO",
        from: itineraryEnd,
        to: baseBack,
        meta: { chosenBaseIcao: baseBack.icao },
      })
    }
  }

  return ok({
    legsOut,
    legsBack,
    chosenOutBase: baseOut ?? undefined,
    chosenBackBase: baseBack ?? undefined,
  })
}

export function findClosestAirportByDistance(
  origin: Airport,
  candidates: Airport[]
): Airport | null {
  let best: { a: Airport; d: number } | null = null
  for (const a of candidates) {
    const d = haversineNm(origin.lat, origin.lon, a.lat, a.lon)
    if (!best || d < best.d) best = { a, d }
  }
  return best?.a ?? null
}

export function enforceRepoConstraints(
  knobs: PricingKnobs,
  repoOutHours: number,
  repoBackHours: number
): QuoteResult | null {
  const c = knobs.repo.constraints
  if (!c || !c.rejectIfExceeded) return null

  if (
    typeof c.maxOriginRepoHours === "number" &&
    repoOutHours > c.maxOriginRepoHours
  ) {
    return reject(
      "REPO_OUT_TOO_LONG",
      `Outbound repo ${repoOutHours.toFixed(2)}h > max ${
        c.maxOriginRepoHours
      }h`,
      "repo.constraints.maxOriginRepoHours"
    )
  }

  if (
    typeof c.maxDestinationRepoHours === "number" &&
    repoBackHours > c.maxDestinationRepoHours
  ) {
    return reject(
      "REPO_BACK_TOO_LONG",
      `Inbound repo ${repoBackHours.toFixed(2)}h > max ${
        c.maxDestinationRepoHours
      }h`,
      "repo.constraints.maxDestinationRepoHours"
    )
  }

  return null
}
