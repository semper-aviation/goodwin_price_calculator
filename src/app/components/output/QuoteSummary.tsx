import { QuoteResult } from "@/app/engine/quoteResult"
import { money, hours } from "@/app/engine/utils"

function Metric({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  emphasis?: boolean
}) {
  return (
    <div className="p-5">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 ${
          emphasis
            ? "text-3xl font-bold text-slate-900"
            : "text-xl font-semibold text-slate-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-sm text-slate-600">{sub}</div>}
    </div>
  )
}

export function QuoteSummary({ quote }: { quote: QuoteResult }) {
  const t = quote.totals
  const times = quote.times

  if (!t || !times) return null

  return (
    <div className="p-6">
      {/* ───────────── HERO TOTAL ───────────── */}
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Metric
          label="Total price"
          value={money(t.total)}
          sub={
            <span className="font-medium">{hours(times.totalHours)} total</span>
          }
          emphasis
        />

        <div className="flex flex-col justify-center p-5">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Efficiency
          </div>
          <div className="mt-2 flex items-center gap-4">
            <div>
              <div className="text-sm text-slate-500">Occupied</div>
              <div className="font-semibold text-slate-900">
                {hours(times.occupiedHours)}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Repo</div>
              <div className="font-semibold text-slate-900">
                {hours(times.repoHours)}
              </div>
            </div>
            {typeof times.matchScore === "number" && (
              <div className="ml-auto text-right">
                <div className="text-sm text-slate-500">Match</div>
                <div
                  className={`font-semibold ${
                    times.matchScore >= 7
                      ? "text-emerald-700"
                      : times.matchScore >= 5
                      ? "text-slate-700"
                      : "text-rose-700"
                  }`}
                >
                  {times.matchScore.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ───────────── BASE BREAKDOWN ───────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
        <Metric
          label="Base — Occupied"
          value={money(t.baseOccupied)}
          sub={`${hours(times.occupiedHours)} occupied`}
        />

        <Metric
          label="Base — Reposition"
          value={money(t.baseRepo)}
          sub={`${hours(times.repoHours)} repo`}
        />
      </div>

      {/* ───────────── SECONDARY TOTALS ───────────── */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>
          Fees <strong className="text-slate-900">{money(t.fees)}</strong>
        </span>
        <span>•</span>
        <span>
          Discounts{" "}
          <strong className="text-emerald-700">{money(t.discounts)}</strong>
        </span>
        <span>•</span>
        <span>
          Base total{" "}
          <strong className="text-slate-900">
            {money(t.baseOccupied + t.baseRepo)}
          </strong>
        </span>
      </div>
    </div>
  )
}
