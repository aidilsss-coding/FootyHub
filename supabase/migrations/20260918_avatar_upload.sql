-- Profile picture upload: a column to hold the public URL, plus a Storage
-- bucket + policies so users can upload their own avatar image.

alter table profiles add column if not exists avatar_url text;

-- Public bucket (avatars are meant to be visible to anyone viewing a
-- profile, chat, or game roster), 5MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Anyone can view avatars (bucket is public, but RLS still gates the API).
create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

-- A user may only upload/update/delete files inside a folder named after
-- their own auth uid, e.g. avatars/<user_id>/photo.jpg.
create policy "Users can upload their own avatar"
on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
on storage.objects for update
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
on storage.objects for delete
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
