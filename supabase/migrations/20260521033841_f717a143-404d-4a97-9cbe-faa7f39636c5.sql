-- Helper: case-insensitive email lookup, returns user_id + display_name only
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email TEXT)
RETURNS TABLE (user_id UUID, display_name TEXT, avatar_url TEXT, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url, p.email
  FROM public.profiles p
  WHERE lower(p.email) = lower(_email)
  LIMIT 1;
$$;

-- Friendships
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_req ON public.friendships(requester_id);
CREATE INDEX idx_friendships_add ON public.friendships(addressee_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own friendships" ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "send friend request" ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "respond to friendship" ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "remove own friendship" ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- are_friends helper (SECURITY DEFINER, avoids RLS recursion in dependent policies)
CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  );
$$;

-- Vault snapshots: one row per user with their collection cached
CREATE TABLE public.vault_snapshots (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value NUMERIC NOT NULL DEFAULT 0,
  card_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own or friend vault" ON public.vault_snapshots FOR SELECT
  USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));

CREATE POLICY "upsert own vault" ON public.vault_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own vault" ON public.vault_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow friends to view each other's GB party (for PvP team peek)
CREATE POLICY "Friends view party" ON public.gb_party FOR SELECT
  USING (public.are_friends(auth.uid(), user_id));

-- Allow friends to view each other's profile (for friend list display)
CREATE POLICY "Friends view profile" ON public.profiles FOR SELECT
  USING (public.are_friends(auth.uid(), user_id));

-- Realtime for live friend requests + vault updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_snapshots;
