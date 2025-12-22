"use client"

import type {
  Airport,
  PricingKnobs,
  TripInput as ApiTripInput,
} from "../engine/quoteRequest"
import type { TripInput } from "./TripPlanner"
import aircraftModels from "../data/aircraftModels"

type SummaryPanelProps = {
  tripPayload: ApiTripInput | null
  tripDraft: TripInput | null
  knobs: PricingKnobs
  isCalculating: boolean
  canCalculate: boolean
  onCalculateAction: () => void
}

function formatAirportLabel(airport: Airport | undefined | null) {
  if (!airport) return "—"
  return `${airport.icao}, ${airport.state}`
}

function formatAircraftModelLabel(modelId?: string) {
  if (!modelId) return "—"
  const model = aircraftModels.find((item) => item.model_id === modelId)
  return model?.name ?? modelId
}

function formatAirportList(airports: Airport[] | undefined) {
  if (!airports || airports.length === 0) return ""
  return airports.map((airport) => airport.icao).join(", ")
}

export default function SummaryPanel({
  tripPayload,
  tripDraft,
  knobs,
  isCalculating,
  canCalculate,
  onCalculateAction,
}: SummaryPanelProps) {
  void tripPayload

  // Collect all fields with values
  const fields: Array<{ label: string; value: string | number }> = []

  // Trip fields
  if (tripDraft?.tripType)
    fields.push({ label: "Type", value: tripDraft.tripType })
  if (tripDraft?.category)
    fields.push({ label: "Category", value: tripDraft.category })
  if (tripDraft?.aircraftModel)
    fields.push({
      label: "Model",
      value: formatAircraftModelLabel(tripDraft.aircraftModel),
    })
  if (typeof tripDraft?.passengers === "number")
    fields.push({ label: "Passengers", value: tripDraft.passengers })
  if (tripDraft?.fromIcao)
    fields.push({ label: "From", value: tripDraft.fromIcao })
  if (tripDraft?.toIcao) fields.push({ label: "To", value: tripDraft.toIcao })
  if (tripDraft?.departLocalISO)
    fields.push({ label: "Depart", value: tripDraft.departLocalISO })
  if (tripDraft?.returnLocalISO)
    fields.push({ label: "Return", value: tripDraft.returnLocalISO })

  // Knobs fields
  const pushField = (label: string, value: string | number) => {
    fields.push({ label, value })
  }

  if (knobs.repo.mode)
    pushField("Repo mode", knobs.repo.mode)
  if (knobs.repo.policy)
    pushField("Repo policy", knobs.repo.policy)
  if (knobs.repo.fixedBaseIcao)
    pushField("Fixed base", formatAirportLabel(knobs.repo.fixedBaseIcao))
  if (knobs.repo.vhbSelection)
    pushField("VHB selection", knobs.repo.vhbSelection)
  const vhbList = formatAirportList(knobs.repo.vhbSets?.default)
  if (vhbList) pushField("VHB airports", vhbList)
  if (knobs.repo.constraints?.maxOriginRepoHours != null)
    pushField(
      "Max origin repo",
      knobs.repo.constraints.maxOriginRepoHours
    )
  if (knobs.repo.constraints?.maxDestinationRepoHours != null)
    pushField(
      "Max destination repo",
      knobs.repo.constraints.maxDestinationRepoHours
    )
  if (knobs.repo.constraints?.rejectIfExceeded != null)
    pushField(
      "Reject if repo exceeds",
      knobs.repo.constraints.rejectIfExceeded ? "Yes" : "No"
    )

  if (knobs.time.taxiHoursPerLeg > 0)
    pushField("Taxi hrs/leg", knobs.time.taxiHoursPerLeg)
  if (knobs.time.bufferHoursPerLeg > 0)
    pushField("Buffer hrs/leg", knobs.time.bufferHoursPerLeg)
  if (knobs.time.applyTo) pushField("Apply to", knobs.time.applyTo)
  if (knobs.time.minimums?.minActualFlightHoursPerLeg != null)
    pushField(
      "Min flight hrs/leg",
      knobs.time.minimums.minActualFlightHoursPerLeg
    )
  if (knobs.time.minimums?.minFirstOccupiedLegHours != null)
    pushField(
      "Min first occ hrs",
      knobs.time.minimums.minFirstOccupiedLegHours
    )
  if (knobs.time.minimums?.minTotalTripHours != null)
    pushField("Min total trip hrs", knobs.time.minimums.minTotalTripHours)
  if (knobs.time.minimums?.minOccupiedHoursTotal != null)
    pushField(
      "Min occupied hrs",
      knobs.time.minimums.minOccupiedHoursTotal
    )
  if (knobs.time.dailyLimits?.maxOccupiedHoursPerDay != null)
    pushField(
      "Max occ hrs/day",
      knobs.time.dailyLimits.maxOccupiedHoursPerDay
    )

  if (knobs.pricing.rateModel)
    pushField("Rate model", knobs.pricing.rateModel)
  if (knobs.pricing.hourlyRate != null)
    pushField("Hourly rate", knobs.pricing.hourlyRate)
  if (knobs.pricing.repoRate != null)
    pushField("Repo rate", knobs.pricing.repoRate)
  if (knobs.pricing.occupiedRate != null)
    pushField("Occupied rate", knobs.pricing.occupiedRate)

  if (knobs.discounts.vhbDiscount?.mode)
    pushField("VHB discount mode", knobs.discounts.vhbDiscount.mode)
  if (knobs.discounts.vhbDiscount?.percent != null)
    pushField("VHB discount %", knobs.discounts.vhbDiscount.percent)
  if (knobs.discounts.vhbDiscount?.appliesTo)
    pushField("VHB applies to", knobs.discounts.vhbDiscount.appliesTo)

  if (knobs.scoring?.matchScore?.enabled != null)
    pushField(
      "Match score enabled",
      knobs.scoring.matchScore.enabled ? "Yes" : "No"
    )
  if (knobs.scoring?.matchScore?.threshold != null)
    pushField("Match score thresh", knobs.scoring.matchScore.threshold)
  if (knobs.scoring?.matchScore?.action)
    pushField("Match score action", knobs.scoring.matchScore.action)

  if (knobs.fees.groundHandling?.perSegmentAmount != null)
    pushField(
      "Ground handling",
      knobs.fees.groundHandling.perSegmentAmount
    )
  if (knobs.fees.groundHandling?.appliesTo)
    pushField("Ground applies to", knobs.fees.groundHandling.appliesTo)
  const hdList = formatAirportList(knobs.fees.highDensity?.airports)
  if (hdList) pushField("HD airports", hdList)
  if (knobs.fees.highDensity?.feePerVisit != null)
    pushField("HD fee/visit", knobs.fees.highDensity.feePerVisit)
  if (knobs.fees.highDensity?.countingMode)
    pushField("HD counting", knobs.fees.highDensity.countingMode)
  if (knobs.fees.highDensity?.roundTripOriginDoubleCharge != null)
    pushField(
      "HD round-trip charge",
      knobs.fees.highDensity.roundTripOriginDoubleCharge ? "Yes" : "No"
    )
  if (knobs.fees.highDensity?.tripCap != null)
    pushField("HD trip cap", knobs.fees.highDensity.tripCap)
  if (knobs.fees.landingFees?.countingMode)
    pushField("Landing counting", knobs.fees.landingFees.countingMode)
  if (knobs.fees.landingFees?.defaultAmount != null)
    pushField("Landing default", knobs.fees.landingFees.defaultAmount)
  if (knobs.fees.landingFees?.hdOverrideAmount != null)
    pushField("Landing HD override", knobs.fees.landingFees.hdOverrideAmount)
  const hdOverrideList = formatAirportList(knobs.fees.landingFees?.hdAirports)
  if (hdOverrideList) pushField("Landing HD airports", hdOverrideList)
  if (knobs.fees.overnight?.amountPerNight != null)
    pushField("Overnight amount", knobs.fees.overnight.amountPerNight)
  if (knobs.fees.overnight?.appliesWhen)
    pushField("Overnight applies", knobs.fees.overnight.appliesWhen)
  if (knobs.fees.overnight?.maxNightsBeforeSplit != null)
    pushField(
      "Overnight max nights",
      knobs.fees.overnight.maxNightsBeforeSplit
    )
  if (knobs.fees.daily?.amountPerCalendarDay != null)
    pushField("Daily amount", knobs.fees.daily.amountPerCalendarDay)
  if (knobs.fees.daily?.calendarDayCounting)
    pushField(
      "Daily counting",
      knobs.fees.daily.calendarDayCounting
    )

  pushField(
    "Domestic only",
    knobs.eligibility.domesticOnly ? "Yes" : "No"
  )
  if (knobs.eligibility.maxAdvanceDays > 0)
    pushField("Max advance days", knobs.eligibility.maxAdvanceDays)
  if (knobs.eligibility.maxPassengers != null)
    pushField("Max passengers", knobs.eligibility.maxPassengers)
  if (knobs.eligibility.excludeStates?.length)
    pushField("Excluded states", knobs.eligibility.excludeStates.join(", "))

  if (knobs.results.selection)
    pushField("Result selection", knobs.results.selection)
  if (knobs.results.rankMetric)
    pushField("Rank metric", knobs.results.rankMetric)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-slate-800 mb-3">
        Current Inputs
      </div>
      {fields.length > 0 ? (
        <div className="w-full mb-6">
          <div
            className="text-sm text-slate-600"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              columnGap: "2rem",
              rowGap: "0.75rem",
            }}
          >
            {fields.map((field, idx) => (
              <div key={idx} style={{ minWidth: 0 }}>
                <span className="font-medium text-slate-700">
                  {field.label}:
                </span>{" "}
                <span>{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500 italic">
          No inputs configured
        </div>
      )}
      <div className="pt-10 mb-2 flex justify-center px-2">
        <button
          type="button"
          disabled={!canCalculate}
          onClick={onCalculateAction}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            canCalculate
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "cursor-not-allowed bg-slate-200 text-slate-500"
          }`}
        >
          {isCalculating && (
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
          )}
          {isCalculating ? "Calculating..." : "Calculate"}
        </button>
      </div>
    </div>
  )
}
