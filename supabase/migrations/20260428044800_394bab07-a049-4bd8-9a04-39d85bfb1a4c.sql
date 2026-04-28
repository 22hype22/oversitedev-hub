
-- Create public bucket for bot identity assets (icons + banners)
insert into storage.buckets (id, name, public)
values ('bot-assets', 'bot-assets', true)
on conflict (id) do nothing;

-- Public read
create policy "Bot assets are publicly readable"
on storage.objects for select
using (bucket_id = 'bot-assets');

-- Authenticated users can upload to their own folder (path starts with their user id)
create policy "Users can upload their own bot assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'bot-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own bot assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'bot-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own bot assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'bot-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);
