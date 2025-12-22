import { LineItem } from "@/app/engine/quoteResult"
import { money } from "@/app/engine/utils"

export function Ledger({
  items,
  total,
}: {
  items?: LineItem[]
  total?: number
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
      {items.map((li, idx) => (
        <div
          key={`${li.code}-${idx}`}
          className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 mb-4"
        >
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
          <div className="flex items-center gap-4">
            <div
              className={`text-sm font-semibold ${
                li.amount < 0 ? "text-emerald-700" : "text-slate-900"
              }`}
            >
              {money(li.amount)}
            </div>
          </div>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 -mx-5">
        <div className="text-sm font-semibold text-slate-700">TOTAL &nbsp;</div>
        <div className="text-lg font-semibold text-slate-900">
          {money(totalValue)}
        </div>
      </div>
    </div>
  )
}
