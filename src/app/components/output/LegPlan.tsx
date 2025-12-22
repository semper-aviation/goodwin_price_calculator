import { NormalizedLeg } from "@/app/engine/quoteResult"
import { badgeClasses, hours } from "@/app/engine/utils"

export function LegPlan({ legs }: { legs?: NormalizedLeg[] }) {
  if (!legs || legs.length === 0) {
    return <div className="p-4 text-sm text-slate-500">No legs returned.</div>
  }

  const repoIndexes = legs
    .map((leg, index) => (leg.kind === "REPO" ? index : -1))
    .filter((index) => index >= 0)
  const repoOutIndex = repoIndexes[0]
  const repoBackIndex =
    repoIndexes.length > 0 ? repoIndexes[repoIndexes.length - 1] : -1

  return (
    <div className="mb-2 space-y-4">
      {legs.map((l, idx) => {
        const actual =
          typeof l.meta?.["actualHours"] === "number"
            ? (l.meta["actualHours"] as number)
            : undefined
        const adjusted =
          typeof l.meta?.["adjustedHours"] === "number"
            ? (l.meta["adjustedHours"] as number)
            : undefined
        const chosenBase = l.meta?.["chosenBaseIcao"]
        const distanceNm =
          typeof l.meta?.["distanceNm"] === "number"
            ? (l.meta["distanceNm"] as number)
            : undefined

        let label = l.kind === "OCCUPIED" ? "Occupied" : "Repo"
        if (l.kind === "REPO" && repoIndexes.length > 1) {
          label =
            idx === repoOutIndex
              ? "Repo Out"
              : idx === repoBackIndex
              ? "Repo Back"
              : "Repo"
        }

        const detailParts: string[] = []
        if (chosenBase) detailParts.push(`VHB chosen: ${chosenBase}`)
        if (typeof distanceNm === "number") {
          detailParts.push(`Distance ${distanceNm.toFixed(0)}nm`)
        }
        if (actual != null && adjusted != null && actual !== adjusted) {
          detailParts.push(
            `Actual ${hours(actual)} • Adjusted ${hours(adjusted)}`
          )
        }

        return (
          <div
            key={`${l.kind}-${l.from.icao}-${l.to.icao}-${idx}`}
            className="border-t border-slate-100 first:border-t-0 mb-4"
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 120px",
              columnGap: "1rem",
            }}
          >
            <div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClasses(
                  l.kind
                )}`}
              >
                {label}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {l.from.icao} → {l.to.icao}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {detailParts.length > 0
                  ? detailParts.join(" • ")
                  : "Flight time details unavailable"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">
                {hours(adjusted ?? actual)}
              </div>
              {adjusted != null && actual != null && adjusted !== actual ? (
                <div className="mt-1 text-xs text-slate-500">
                  Actual {hours(actual)}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
