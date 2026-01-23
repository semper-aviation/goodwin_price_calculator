import type { QuoteResult } from "../engine/quoteResult"
import type { TripInput } from "../components/TripPlanner"
import type { KnobValues } from "../utils/pageUtils"

import t001 from "./001-aerocenter-esma-pc12-oneway-katl-kjfk.json"
import t002 from "./002-ppj-2rpa-hawker800xp-rt-kbos-kmco.json"
import t003 from "./003-fly-alliance-3gja-midsize-oneway-kteb-kpbi.json"
import t004 from "./004-fly-alliance-3gja-heavy-rt-kteb-ksna.json"
import t005 from "./005-skyway-b90a-cj3-rt-kord-kmia-2nights.json"
import t006 from "./006-ventura-apma-excel-rt-kfrg-kiah-3nights-daily-margin.json"
import t007 from "./007-privaira-1ksa-cl604-oneway-kfxe-kbos-matchscore-landing.json"
import t008 from "./008-aerocenter-esma-pc12-rt-kcmh-kbuf.json"
import t009 from "./009-gen4jets-gbba-cj1-oneway-katl-kmia.json"

export type TemplatePayload = {
  version: number
  name?: string
  trip?: TripInput
  knobs?: KnobValues
  quote?: QuoteResult | null
}

type TemplateItem = {
  id: string
  name: string
  data: TemplatePayload
}

const TEMPLATE_LABELS: Record<string, string> = {
  "aerocenter-esma-pc12-oneway-katl-kjfk": "AeroCenter-PC12",
  "ppj-2rpa-hawker800xp-rt-kbos-kmco": "PPJ-Hawker800xp",
  "fly-alliance-3gja-midsize-oneway-kteb-kpbi": "FlyAlliance-Midsize",
  "fly-alliance-3gja-heavy-rt-kteb-ksna": "FlyAlliance-HeavyJet",
  "skyway-b90a-cj3-rt-kord-kmia-2nights": "Skyway-CJ3",
  "ventura-apma-excel-rt-kfrg-kiah-3nights-daily-margin": "Ventura-Excel",
  "privaira-1ksa-cl604-oneway-kfxe-kbos-matchscore-landing": "Privaira-CL604",
  "aerocenter-esma-pc12-rt-kcmh-kbuf": "AeroCenter-PC12-RT",
  "gen4jets-gbba-cj1-oneway-katl-kmia": "Gen4Jets-CJ1",
}

function withMeta(id: string, data: TemplatePayload): TemplateItem {
  const name = TEMPLATE_LABELS[id] ?? data.name ?? id
  return { id, name, data }
}

export const TEMPLATES: TemplateItem[] = [
  withMeta("aerocenter-esma-pc12-oneway-katl-kjfk", t001 as TemplatePayload),
  withMeta("ppj-2rpa-hawker800xp-rt-kbos-kmco", t002 as TemplatePayload),
  withMeta("fly-alliance-3gja-midsize-oneway-kteb-kpbi", t003 as TemplatePayload),
  withMeta("fly-alliance-3gja-heavy-rt-kteb-ksna", t004 as TemplatePayload),
  withMeta("skyway-b90a-cj3-rt-kord-kmia-2nights", t005 as TemplatePayload),
  withMeta("ventura-apma-excel-rt-kfrg-kiah-3nights-daily-margin", t006 as TemplatePayload),
  withMeta("privaira-1ksa-cl604-oneway-kfxe-kbos-matchscore-landing", t007 as TemplatePayload),
  withMeta("aerocenter-esma-pc12-rt-kcmh-kbuf", t008 as TemplatePayload),
  withMeta("gen4jets-gbba-cj1-oneway-katl-kmia", t009 as TemplatePayload),
]
