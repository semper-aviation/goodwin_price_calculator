"use client"

import { Suspense } from "react"
import { IcalPage } from "@/app/ical/IcalPage"

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <IcalPage />
    </Suspense>
  )
}
