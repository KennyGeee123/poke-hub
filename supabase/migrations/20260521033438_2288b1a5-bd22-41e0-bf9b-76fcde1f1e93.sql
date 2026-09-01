-- Table to persist leveled-up Pokémon used in the Game Boy RPG mode
CREATE TABLE public.gb_party (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  name TEXT NOT NULL,
  types TEXT[] NOT NULL DEFAULT '{}',
  level INTEGER NOT NULL DEFAULT 5,
  xp INTEGER NOT NULL DEFAULT 0,
  max_hp INTEGER NOT NULL DEFAULT 40,
  attacks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sprite_url TEXT,
  image_url TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  slot INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gb_party_user ON public.gb_party(user_id);

ALTER TABLE public.gb_party ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own party" ON public.gb_party FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own party" ON public.gb_party FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own party" ON public.gb_party FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own party" ON public.gb_party FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_gb_party_updated_at
  BEFORE UPDATE ON public.gb_party
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
