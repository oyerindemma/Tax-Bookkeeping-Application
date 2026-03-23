import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;

    console.log("DB TEST RESULT:", result);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("DB CONNECTION ERROR:", error);

    return NextResponse.json(
      {
        error: "Database connection failed",
        details: String(error),
      },
      { status: 500 }
    );
  }
}