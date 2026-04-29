UPDATE public.bot_runtime_status
SET status = 'crashed',
    last_error = 'Test crash from Lovable',
    last_error_at = now()
WHERE id = 'eb678f25-ed9e-4194-bc0e-c2bdfa604156';