import { QuoteResult } from "../engine/quoteResult"
import Card from "./Card"
import { Ledger } from "./output/Ledger"
import { LegPlan } from "./output/LegPlan"
import { QuoteSummary } from "./output/QuoteSummary"
import { ValidationPanel } from "./output/ValidationPanel"

export default function ResultsPanel({ quote }: { quote: QuoteResult | null }) {
  if (!quote) {
    return (
      <Card title="Results">
        <div className="text-sm text-muted-foreground">
          Enter trip details and pricing to see results.
        </div>
      </Card>
    )
  }

  const splitNote = quote.rejectReasons?.find(
    (reason) => reason.code === "INFO_SPLIT"
  )?.message

  return (
    <Card title="Results">
      {quote.status === "REJECTED" ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <ValidationPanel quote={quote} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
            <QuoteSummary quote={quote} />
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <SectionHeader
              title="Trip plan"
              subtitle="Computed legs and billable time"
            />
            {splitNote ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                {splitNote}
              </div>
            ) : null}

            <LegPlan legs={quote.legs ?? []} />
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <SectionHeader
              title="Price breakdown"
              subtitle="Line items and totals"
            />

            <Ledger items={quote.lineItems ?? []} zoneCalculation={quote.zoneCalculation} />
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <SectionHeader
              title="Validation"
              subtitle="Eligibility + constraints"
            />

            <ValidationPanel quote={quote} />
          </div>
        </div>
      )}
    </Card>
  )
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
  )
}
