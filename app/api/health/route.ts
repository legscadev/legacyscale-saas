import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Test connection by checking auth status
    const { error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          message: "Supabase connection failed",
          error: error.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: "ok",
      supabase: "connected",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
