import { handlePaystackWebhookRequest } from "@/src/lib/billing-webhooks";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handlePaystackWebhookRequest(req, "/api/billing/webhook");
}
