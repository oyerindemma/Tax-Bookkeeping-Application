import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, fullName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        password, // (we’ll hash later)
        fullName,
      },
    });

    return NextResponse.json({
      success: true,
      user,
    });

  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    return NextResponse.json(
      {
        error: "Signup failed",
        details: String(error),
      },
      { status: 500 }
    );
  }
}