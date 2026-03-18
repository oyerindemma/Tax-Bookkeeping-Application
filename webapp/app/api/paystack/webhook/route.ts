import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/src/lib/env";
import { handlePaystackEvent } from "@/src/lib/billing-webhooks";

export async function POST(req: Request) {
  const body = await req.text();

  const signature = req.headers.get("x-paystack-signature");

  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const hash = crypto
    .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");

  if (hash !== signature) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let event;

  try {
    event = JSON.parse(body);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  await handlePaystackEvent(event);

  return new NextResponse("OK", { status: 200 });
}