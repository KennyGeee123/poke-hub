import { createFileRoute } from "@tanstack/react-router";
import { securityHeaders, VIRUS_BUSTER_SHIELDS } from "@/lib/virus-buster";

export const Route = createFileRoute("/api/public/virus-buster")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { ok: true, product: "Virus Buster", shields: [...VIRUS_BUSTER_SHIELDS] },
          { headers: securityHeaders() },
        ),
    },
  },
});
