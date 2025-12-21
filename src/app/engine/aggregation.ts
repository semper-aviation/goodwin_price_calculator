// engine/aggregation.ts
import { LineItem, QuoteResult } from "./quoteResult"
import { roundMoney, sum } from "./utils"

export function summarizeTotals(lineItems: LineItem[]): QuoteResult["totals"] {
  const baseOccupied = sum(
    lineItems.filter((l) => l.code === "BASE_OCCUPIED").map((l) => l.amount)
  )
  const baseRepo = sum(
    lineItems.filter((l) => l.code === "BASE_REPO").map((l) => l.amount)
  )
  const fees = sum(
    lineItems.filter((l) => l.code.startsWith("FEE_")).map((l) => l.amount)
  )
  const discounts = sum(
    lineItems.filter((l) => l.amount < 0).map((l) => l.amount)
  )
  const total = sum(lineItems.map((l) => l.amount))

  return {
    baseOccupied: roundMoney(baseOccupied),
    baseRepo: roundMoney(baseRepo),
    fees: roundMoney(fees),
    discounts: roundMoney(discounts),
    total: roundMoney(total),
  }
}

export function sumTwoQuotes(
  a: QuoteResult,
  b: QuoteResult,
  meta?: { note?: string }
): QuoteResult {
  const aItems = a.lineItems ?? []
  const bItems = b.lineItems ?? []

  const mergedItems: LineItem[] = [
    ...aItems.map((li) => ({
      ...li,
      meta: { ...(li.meta ?? {}), leg: "OUTBOUND" },
    })),
    ...bItems.map((li) => ({
      ...li,
      meta: { ...(li.meta ?? {}), leg: "RETURN" },
    })),
  ]

  const totals = summarizeTotals(mergedItems)

  const legs = [...(a.legs ?? []), ...(b.legs ?? [])]

  const occupiedHours =
    (a.times?.occupiedHours ?? 0) + (b.times?.occupiedHours ?? 0)
  const repoHours = (a.times?.repoHours ?? 0) + (b.times?.repoHours ?? 0)
  const totalHours = occupiedHours + repoHours

  return {
    status: "OK",
    legs,
    lineItems: mergedItems,
    totals,
    times: {
      occupiedHours,
      repoHours,
      totalHours,
    },
    rejectReasons: meta?.note
      ? [{ code: "INFO_SPLIT", message: meta.note }]
      : undefined,
  }
}
