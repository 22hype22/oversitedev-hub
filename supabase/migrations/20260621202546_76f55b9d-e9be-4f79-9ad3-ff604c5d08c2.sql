-- 1) Extend platform role enum with 'support'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
