import React from "react"
import Card from "./Card"

export default function ResultsPanel() {
  // const quote = useQuoteResult();
  const quote = null // placeholder
  if (!quote) {
    return (
      <Card title="Results">
        <div className="text-sm text-muted-foreground">
          Enter trip details and pricing to see results.
        </div>
      </Card>
    )
  }
  // if (quote.status === "REJECTED") {
  //   return <ValidationPanel quote={quote} />;
  // }
  return (
    <Card title="Results">
      {/* <QuoteSummary quote={quote} /> */}
      {/* <LegPlan legs={quote.legs} /> */}
      {/* <Ledger items={quote.lineItems} /> */}
      {/* <ValidationPanel quote={quote} /> */}
      <div className="h-40 flex items-center justify-center text-muted-foreground">
        Results content goes here
      </div>
    </Card>
  )
}
