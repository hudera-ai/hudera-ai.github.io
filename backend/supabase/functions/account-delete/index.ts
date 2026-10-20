// Supabase Edge Function: account-delete. All logic lives in ../_shared/handlers.js (tested locally with Node).
import { handleAccountDelete } from "../_shared/handlers.js";

Deno.serve((req: Request) => handleAccountDelete(req, Deno.env.toObject()));
