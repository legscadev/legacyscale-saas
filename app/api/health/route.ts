import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Test Supabase connection
    const { error: supabaseError } = await supabase.auth.getSession()

    // Test Prisma connection
    const userCount = await prisma.user.count()
    const courseCount = await prisma.course.count()

    if (supabaseError) {
      return NextResponse.json(
        {
          status: "error",
          message: "Supabase connection failed",
          error: supabaseError.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: "ok",
      supabase: "connected",
      prisma: "connected",
      data: {
        users: userCount,
        courses: courseCount,
      },
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
