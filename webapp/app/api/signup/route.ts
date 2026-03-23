import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

type SignupBody = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
};

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SignupBody;
    const email = getTrimmedString(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = getTrimmedString(body.fullName);

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Missing full name, email, or password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        password,
        fullName,
        role: "USER",
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    return NextResponse.json(
      {
        error: "Signup failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
