import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "@/app/api/utils/getToken"

const API_BASE_URL = process.env.API_BASE_URL

interface BackendResponse<T = any> {
  isApiHandled?: boolean
  isRequestSuccess?: boolean
  statusCode?: number
  message?: string
  data?: T
  result?: T
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { isRequestSuccess: true, data: [] },
        { status: 200 }
      )
    }

    const token = await getToken(req)

    const headers: Record<string, string> = {
      Accept: "application/json",
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const url = `${API_BASE_URL}/IRackRowFeature/GetRackRowByRackSideId?Id=${encodeURIComponent(
      id
    )}`

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store", // ✅ prevent caching issues
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        "[GetRackRowByRackSideId] Backend error:",
        response.status,
        errorText
      )

      return NextResponse.json(
        {
          isRequestSuccess: false,
          message: errorText || `Backend returned ${response.status}`,
          statusCode: response.status,
        },
        { status: response.status }
      )
    }

    const contentType = response.headers.get("content-type") || ""

    if (!contentType.includes("application/json")) {
      const text = await response.text()
      console.error(
        "[GetRackRowByRackSideId] Expected JSON but received:",
        text
      )

      return NextResponse.json(
        {
          isRequestSuccess: false,
          message: "Invalid response format from backend",
          statusCode: 502,
        },
        { status: 502 }
      )
    }

    const json: BackendResponse = await response.json()

    // Normalize backend response safely
    const data =
      Array.isArray(json)
        ? json
        : json?.data ?? json?.result ?? []

    return NextResponse.json(
      {
        isRequestSuccess: true,
        data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("GetRackRowByRackSideId SSR Error:", error)

    return NextResponse.json(
      {
        isRequestSuccess: false,
        message: "Internal Server Error",
        statusCode: 500,
      },
      { status: 500 }
    )
  }
}