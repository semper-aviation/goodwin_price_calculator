import { NextResponse, type NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const username = process.env.BASIC_AUTH_USER
  const password = process.env.BASIC_AUTH_PASS

  if (!username || !password) {
    return NextResponse.next()
  }

  const auth = request.headers.get("authorization")
  if (auth) {
    const [scheme, encoded] = auth.split(" ")
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded)
      const [user, pass] = decoded.split(":")
      if (user === username && pass === password) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected"',
    },
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|goodwin_calc.png).*)"],
}
