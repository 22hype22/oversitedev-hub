-- Create verification_tokens table
CREATE TABLE public.verification_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bot_id UUID NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    user_id TEXT,
    guild_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed BOOLEAN NOT NULL DEFAULT false,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX idx_verification_tokens_bot_id ON public.verification_tokens(bot_id);
CREATE INDEX idx_verification_tokens_token ON public.verification_tokens(token);
CREATE INDEX idx_verification_tokens_bot_guild ON public.verification_tokens(bot_id, guild_id);
CREATE INDEX idx_verification_tokens_expires ON public.verification_tokens(expires_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.verification_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_tokens TO authenticated;
GRANT ALL ON public.verification_tokens TO service_role;

-- Enable Row Level Security
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

-- Anon policies: bots can read/write tokens for bots that exist in bot_orders
CREATE POLICY "Anon bots can read verification_tokens"
ON public.verification_tokens
FOR SELECT
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can insert verification_tokens"
ON public.verification_tokens
FOR INSERT
TO anon
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can update verification_tokens"
ON public.verification_tokens
FOR UPDATE
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

-- Authenticated policies: bot owners and team members
CREATE POLICY "Bot owners can read their verification_tokens"
ON public.verification_tokens
FOR SELECT
TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Bot owners can insert their verification_tokens"
ON public.verification_tokens
FOR INSERT
TO authenticated
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Bot owners can update their verification_tokens"
ON public.verification_tokens
FOR UPDATE
TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Bot owners can delete their verification_tokens"
ON public.verification_tokens
FOR DELETE
TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

-- Team member policies
CREATE POLICY "Team members can read verification_tokens"
ON public.verification_tokens
FOR SELECT
TO authenticated
USING (public.has_bot_team_access(auth.uid(), bot_id));

CREATE POLICY "Team members can insert verification_tokens"
ON public.verification_tokens
FOR INSERT
TO authenticated
WITH CHECK (public.has_bot_team_access(auth.uid(), bot_id));

CREATE POLICY "Team members can update verification_tokens"
ON public.verification_tokens
FOR UPDATE
TO authenticated
USING (public.has_bot_team_access(auth.uid(), bot_id))
WITH CHECK (public.has_bot_team_access(auth.uid(), bot_id));

CREATE POLICY "Team members can delete verification_tokens"
ON public.verification_tokens
FOR DELETE
TO authenticated
USING (public.has_bot_team_access(auth.uid(), bot_id));

-- Service role bypass
CREATE POLICY "Service role full access on verification_tokens"
ON public.verification_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);