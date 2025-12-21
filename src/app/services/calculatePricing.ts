import { QuoteRequestPayload } from "../engine/quoteRequest"

export function logQuoteRequest(payload: QuoteRequestPayload) {
  console.log("QuoteRequest payload", payload)
}
