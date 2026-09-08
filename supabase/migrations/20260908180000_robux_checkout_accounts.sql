-- Robux checkout: buyers link their Roblox account (same OAuth app as the
-- Discord verification), say whether it is a Roblox Select account, and then
-- pay through a group-store shirt (Select) or a developer product (standard).

-- The linked Roblox account lives on the profile. The id and link time are
-- written by the OAuth callback only; the kind is the buyer's own answer.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roblox_user_id bigint,
  ADD COLUMN IF NOT EXISTS roblox_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS roblox_account_kind text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_roblox_account_kind_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_roblox_account_kind_check
  CHECK (roblox_account_kind IS NULL OR roblox_account_kind IN ('standard', 'select'));

-- A user may edit their own profile, but not the linked id or link time.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND welcome_discount_available = (SELECT p.welcome_discount_available FROM public.profiles p WHERE p.user_id = auth.uid())
    AND is_banned = (SELECT p.is_banned FROM public.profiles p WHERE p.user_id = auth.uid())
    AND roblox_user_id IS NOT DISTINCT FROM (SELECT p.roblox_user_id FROM public.profiles p WHERE p.user_id = auth.uid())
    AND roblox_linked_at IS NOT DISTINCT FROM (SELECT p.roblox_linked_at FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- What the order is paid with on Roblox: the legacy per-order gamepass, a
-- group-store shirt slot, or a developer product in the Payment experience.
ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS robux_item_kind text,
  ADD COLUMN IF NOT EXISTS robux_item_id text,
  ADD COLUMN IF NOT EXISTS robux_shirt_slot integer;
ALTER TABLE public.bot_orders DROP CONSTRAINT IF EXISTS bot_orders_robux_item_kind_check;
ALTER TABLE public.bot_orders
  ADD CONSTRAINT bot_orders_robux_item_kind_check
  CHECK (robux_item_kind IS NULL OR robux_item_kind IN ('gamepass', 'shirt', 'devproduct'));

-- The six payment shirts are shared. Remember when each slot was last handed
-- out so the least recently used one goes next.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS robux_shirt_slots jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Website logins reuse the Discord verification sessions table. A site
-- session has a signed-in user and a page to return to instead of a guild
-- and a Discord member.
ALTER TABLE public.roblox_verify_sessions
  ADD COLUMN IF NOT EXISTS site_user_id uuid,
  ADD COLUMN IF NOT EXISTS return_to text;
ALTER TABLE public.roblox_verify_sessions ALTER COLUMN guild_id DROP NOT NULL;
ALTER TABLE public.roblox_verify_sessions ALTER COLUMN discord_user_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
