import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { seedDefaultExpenseCategories } from "@/src/lib/expense-categories";
import { logRouteError } from "@/src/lib/logger";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, fullName } = body as {
      email?: string;
      password?: string;
      fullName?: string;
    };

    // 1) Validate input
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "email, password, and fullName are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2) Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // 3) Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const trimmedName = fullName.trim();

    // 4) Create user + default workspace
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          fullName: trimmedName,
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

      const workspace = await tx.workspace.create({
        data: {
          name: `${trimmedName}'s Workspace`,
          members: {
            create: {
              userId: createdUser.id,
              role: "OWNER",
            },
          },
          subscription: {
            create: {
              plan: "FREE",
              status: "free",
            },
          },
        },
      });

      await seedDefaultExpenseCategories(tx, workspace.id);

      return createdUser;
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    logRouteError("signup failed", error);
    return NextResponse.json(
      { error: "Server error creating user" },
      { status: 500 }
    );
  }
}
