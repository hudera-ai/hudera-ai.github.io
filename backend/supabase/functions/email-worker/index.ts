// Supabase Edge Function: email-worker. All logic lives in ../_shared/handlers.js (tested locally with Node).
import { handleWorker } from "../_shared/handlers.js";

Deno.serve((req: Request) => handleWorker(req, Deno.env.toObject()));
