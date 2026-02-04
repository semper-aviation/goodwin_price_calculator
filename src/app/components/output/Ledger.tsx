import { LineItem, ZoneCalculationInfo } from "@/app/engine/quoteResult"
import { money } from "@/app/engine/utils"

type ZoneMeta = {
  zoneName?: string
  zoneId?: string
  direction?: "origin" | "destination"
  hours?: number
  baseRate?: number
  appliedRate?: number
  fromIcao?: string
  toIcao?: string
  peakPeriod?: string
  peakMultiplier?: number
  occupiedHours?: number
}

function LineItemRow({ li, zoneCalculation }: { li: LineItem; zoneCalculation?: ZoneCalculationInfo }) {
  const meta = li.meta as ZoneMeta | undefined

  // Render zone-based repo line item
  if (li.code === "BASE_REPO_ZONE" && meta?.zoneName) {
    const hasRateChange = meta.baseRate && meta.appliedRate && meta.baseRate !== meta.appliedRate
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
                {meta.fromIcao} → {meta.toIcao} • {meta.hours?.toFixed(2)} hr
              </div>
              <div>
                {meta.direction === "origin" ? "Origin" : "Destination"} Repo Rate: $
                {meta.baseRate?.toLocaleString()}/hr
                {hasRateChange && (
                  <span className="text-amber-600">
                    {" → $"}{meta.appliedRate?.toLocaleString()}/hr
                  </span>
                )}
              </div>
              {meta.peakPeriod && (
                <div className="text-amber-600">
                  Peak: {meta.peakPeriod} ({meta.peakMultiplier}x)
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

  // Render occupied line item with zone info
  if (li.code === "BASE_OCCUPIED" && zoneCalculation?.occupiedRate) {
    const occRate = zoneCalculation.occupiedRate
    const hasRateChange = occRate.baseRate !== occRate.appliedRate
    const peak = zoneCalculation.peakPeriod
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
                {(meta?.occupiedHours ?? 0).toFixed(2)} hr × ${occRate.baseRate.toLocaleString()}/hr
                {hasRateChange && (
                  <span className="text-amber-600">
                    {" → $"}{occRate.appliedRate.toLocaleString()}/hr
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
          <div className="text-xs text-slate-500">{li.code}</div>
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
      {/* Zone Selection Summary - only show if zone pricing is used */}
      {zoneCalculation && (zoneCalculation.outboundZone || zoneCalculation.inboundZone) && (
        <div className="mb-4 pb-3 border-b border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Zone Selection
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {zoneCalculation.outboundZone && (
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="font-medium text-slate-700">Outbound Zone</div>
                <div className="text-slate-600">
                  {zoneCalculation.outboundZone.zoneName} • Base: {zoneCalculation.outboundZone.selectedAirport}
                </div>
              </div>
            )}
            {zoneCalculation.inboundZone && (
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="font-medium text-slate-700">Inbound Zone</div>
                <div className="text-slate-600">
                  {zoneCalculation.inboundZone.zoneName} • Base: {zoneCalculation.inboundZone.selectedAirport}
                </div>
              </div>
            )}
          </div>
          {zoneCalculation.peakPeriod && (
            <div className="mt-2 text-xs text-amber-600 font-medium">
              Peak Period Active: {zoneCalculation.peakPeriod.name}
            </div>
          )}
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
