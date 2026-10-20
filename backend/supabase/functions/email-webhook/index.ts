// Supabase Edge Function: email-webhook. All logic lives in ../_shared/handlers.js (tested locally with Node).
import { handleWebhook } from "../_shared/handlers.js";

Deno.serve((req: Request) => handleWebhook(req, Deno.env.toObject()));
