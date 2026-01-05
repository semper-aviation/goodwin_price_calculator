import { NextResponse } from "next/server"
import { parseIcalUrl } from "@/app/ical/IcalService.server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const icalUrl = searchParams.get("ical")
  if (!icalUrl) {
    return NextResponse.json(
      { error: "Missing iCal URL." },
      { status: 400 }
    )
  }

  try {
    const events = await parseIcalUrl(icalUrl)
    return NextResponse.json({ events })
  } catch (error) {
    console.error("Failed to parse iCal:", error)
    return NextResponse.json(
      { error: "Failed to parse iCal.", detail: String(error) },
      { status: 500 }
    )
  }
}
