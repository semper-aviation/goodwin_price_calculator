import { NextResponse } from "next/server"

type FlightLegInput = {
  originIcao: string
  destinationIcao: string
  departDate: string
  departTime?: string
  originLat: number
  originLon: number
  destinationLat: number
  destinationLon: number
}

type FlightTimeRequest = {
  aircraftModels: { modelId: string; avgSpeedKnots: number }[]
  flightLegs: { flightLegs: FlightLegInput[] }
  addTaxiTime?: boolean
}

export async function POST(request: Request) {
  const baseUrl = process.env.FLIGHT_TIME_CALCULATOR_BASE_URL
  const apiKey = process.env.FLIGHT_TIME_CALCULATOR_KEY

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Missing flight time calculator credentials." },
      { status: 500 }
    )
  }

  const body = (await request.json()) as FlightTimeRequest

  try {
    const response = await fetch(`${baseUrl}/flight_time`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        flightLegs: body.flightLegs.flightLegs.map((leg) => ({
          originIcao: leg.originIcao,
          destinationIcao: leg.destinationIcao,
          departDate: leg.departDate,
          departTime: leg.departTime,
          originLat: leg.originLat,
          originLon: leg.originLon,
          destinationLat: leg.destinationLat,
          destinationLon: leg.destinationLon,
        })),
        aircraft: {
          models: body.aircraftModels.map((model) => model.modelId),
        },
      }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Flight time API failed: ${response.status}` },
        { status: response.status }
      )
    }

    const payload = await response.json()
    return NextResponse.json(payload)
  } catch (error) {
    console.error("Flight time API request failed:", error)
    return NextResponse.json(
      { error: "Flight time API request failed.", detail: String(error) },
      { status: 500 }
    )
  }
}
