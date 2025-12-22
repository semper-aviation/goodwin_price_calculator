import { QuoteResult } from "@/app/engine/quoteResult"

export function ValidationPanel({ quote }: { quote: QuoteResult }) {
  const reasons = quote.rejectReasons ?? []
  const isRejected = quote.status === "REJECTED"

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={`text-sm font-semibold ${
            isRejected ? "text-rose-800" : "text-emerald-800"
          }`}
        >
          Status: {isRejected ? "Rejected" : "Eligible"}
        </div>
        <div className="text-xs text-slate-500">
          {isRejected ? "❌" : "✅"}
        </div>
      </div>

      {reasons.length === 0 ? (
        <div className="mt-2 text-sm text-slate-600">No issues found.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {reasons.map((r, idx) => (
            <li key={`${r.code}-${idx}`} className="text-sm text-slate-700">
              <div className="font-semibold text-slate-900">{r.code}</div>
              <div className="text-slate-700">{r.message}</div>
              {r.fieldPath ? (
                <div className="mt-0.5 text-xs text-slate-500">
                  Field: <span className="font-mono">{r.fieldPath}</span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
