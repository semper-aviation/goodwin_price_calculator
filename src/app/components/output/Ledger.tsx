import { LineItem, ZoneCalculationInfo } from "@/app/engine/quoteResult"
import { money } from "@/app/engine/utils"

type ZoneMeta = {
  zoneName?: string
  zoneId?: string
  direction?: "origin" | "destination"
  zoneRepoTime?: number
  baseRepoTime?: number
  repoRate?: number
  appliedRepoRate?: number
  fromIcao?: string
  toIcao?: string
  peakPeriod?: string
  isPeakOverride?: boolean
  occupiedHours?: number
}

function LineItemRow({ li, zoneCalculation }: { li: LineItem; zoneCalculation?: ZoneCalculationInfo }) {
  const meta = li.meta as ZoneMeta | undefined

  // Render zone-based repo line item
  if (li.code === "BASE_REPO_ZONE") {
    const repoRate = meta?.repoRate ?? 0
    const appliedRepoRate = meta?.appliedRepoRate ?? repoRate
    const hasRateChange = repoRate !== appliedRepoRate
    const zoneRepoTime = meta?.zoneRepoTime ?? 0
    const direction = meta?.direction
    const zoneName = meta?.zoneName ?? "Unknown"
    const peakPeriodName = meta?.peakPeriod
    const isPeakOverride = meta?.isPeakOverride

    // Create clearer label: "Repo cost (origin)" or "Repo cost (destination)"
    const directionLabel = direction === "origin" ? "origin" : "destination"

    // Calculate peak multiplier if rate changed
    const peakMultiplier = hasRateChange && repoRate > 0 ? (appliedRepoRate / repoRate).toFixed(2) : null

    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            +
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Repo cost ({directionLabel})
            </div>
            <div className="text-xs text-slate-500">
              {zoneRepoTime.toFixed(2)} hr × ${(hasRateChange ? appliedRepoRate : repoRate).toLocaleString()}/hr
            </div>
            <div className="text-xs text-slate-400">
              Zone: {zoneName}
            </div>
            {peakPeriodName && (
              <div className="text-xs text-amber-600">
                Peak: {peakPeriodName}
                {peakMultiplier && ` (${peakMultiplier}x)`}
                {isPeakOverride && " - time override"}
              </div>
            )}
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {money(li.amount)}
        </div>
      </div>
    )
  }

  // Render occupied line item with calculation breakdown
  if (li.code === "BASE_OCCUPIED") {
    const occupiedHours = (meta as { occupiedHours?: number })?.occupiedHours ?? 0
    const baseRate = (meta as { baseRate?: number })?.baseRate ?? zoneCalculation?.occupiedRate?.baseRate ?? 0
    const appliedRate = (meta as { appliedRate?: number })?.appliedRate ?? zoneCalculation?.occupiedRate?.appliedRate ?? baseRate
    const hasRateChange = baseRate !== appliedRate
    const peak = zoneCalculation?.peakPeriod

    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            +
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {li.label}
            </div>
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>
                {occupiedHours.toFixed(2)} hr × ${baseRate.toLocaleString()}/hr
                {hasRateChange && (
                  <span className="text-amber-600">
                    {" → $"}{appliedRate.toLocaleString()}/hr
                  </span>
                )}
              </div>
              {peak && peak.multipliers.occupied && (
                <div className="text-amber-600">
                  Peak: {peak.name} ({peak.multipliers.occupied}x)
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {money(li.amount)}
        </div>
      </div>
    )
  }

  // Render standard BASE_REPO (non-zone mode)
  if (li.code === "BASE_REPO") {
    const repoHours = (meta as { repoHours?: number })?.repoHours ?? 0
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            +
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {li.label}
            </div>
            <div className="text-xs text-slate-500">
              {repoHours.toFixed(2)} hr
            </div>
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {money(li.amount)}
        </div>
      </div>
    )
  }

  // Generate description based on line item code
  const getLineItemDescription = (): string | null => {
    switch (li.code) {
      case "FEE_GROUND_HANDLING":
        return "Per-segment handling fee"
      case "FEE_LANDING":
        return "Landing fees"
      case "FEE_HIGH_DENSITY":
        return "High-density airport fee"
      case "FEE_OVERNIGHT":
        return "Overnight fee"
      case "FEE_DAILY":
        return "Daily fee"
      case "FEE_MIN_PRICE_PER_LEG":
      case "FEE_MIN_TRIP_PRICE":
        return "Minimum price adjustment"
      case "DISCOUNT_MAX_TRIP_PRICE_CAP":
        return "Maximum price cap"
      case "DISCOUNT_VHB":
        return "VHB discount"
      case "DISCOUNT_TIME_BASED":
        return "Time-based discount"
      case "INFO_MATCH_SCORE":
        return `Score: ${(meta as { matchScore?: number })?.matchScore?.toFixed(1) ?? "-"}`
      default:
        return null
    }
  }

  const description = getLineItemDescription()

  // Default line item rendering
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            li.amount < 0
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {li.amount < 0 ? "−" : "+"}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {li.label}
          </div>
          {description ? (
            <div className="text-xs text-slate-500">{description}</div>
          ) : null}
        </div>
      </div>
      <div
        className={`text-sm font-semibold ${
          li.amount < 0 ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {money(li.amount)}
      </div>
    </div>
  )
}

export function Ledger({
  items,
  total,
  zoneCalculation,
}: {
  items?: LineItem[]
  total?: number
  zoneCalculation?: ZoneCalculationInfo
}) {
  if (!items || items.length === 0) {
    return (
      <div className="p-5 text-sm text-slate-500">No line items returned.</div>
    )
  }

  const totalValue =
    typeof total === "number"
      ? total
      : items.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="p-5">
      {/* Peak Period Notice - only show if active */}
      {zoneCalculation?.peakPeriod && (
        <div className="mb-4 pb-3 border-b border-slate-200">
          <div className="text-xs text-amber-600 font-medium">
            Peak Period Active: {zoneCalculation.peakPeriod.name}
          </div>
        </div>
      )}

      {/* Line Items */}
      {items.map((li, idx) => (
        <LineItemRow key={`${li.code}-${idx}`} li={li} zoneCalculation={zoneCalculation} />
      ))}

      {/* Total */}
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 -mx-5">
        <div className="text-sm font-semibold text-slate-700">TOTAL</div>
        <div className="text-lg font-semibold text-slate-900">
          {money(totalValue)}
        </div>
      </div>
    </div>
  )
}
