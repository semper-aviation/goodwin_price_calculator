// engine/types.ts
import { QuoteResult } from "./quoteResult"

export type Err = { ok: false; error: QuoteResult }
export type Ok<T> = { ok: true; value: T }
export type Result<T> = Ok<T> | Err

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}
export function err(error: QuoteResult): Err {
  return { ok: false, error }
}
