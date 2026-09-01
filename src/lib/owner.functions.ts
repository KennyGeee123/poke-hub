import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmailServer } from "./owner.server";

export const getIsOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.auth.getUser();
    return { isOwner: isOwnerEmailServer(data.user?.email) };
  });
