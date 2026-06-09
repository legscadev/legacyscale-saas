-- Avatars Storage bucket + RLS policies.
--
-- Used by 1.16 (profile avatar upload). Public reads so <img src> works
-- without signed URLs; writes are scoped to a folder named with the
-- uploader's auth uid, so users can only manage their own avatar.
--
-- Path convention: avatars/<auth.uid>/<filename>

-- ───────── bucket ─────────

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ───────── policies ─────────

-- Anyone can view avatars (they render across the UI publicly).
create policy "avatars_select_public"
on storage.objects for select
using (bucket_id = 'avatars');

-- Authenticated users can upload only into their own <auth.uid> folder.
create policy "avatars_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Same scope for replacements.
create policy "avatars_update_own_folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Same scope for deletes.
create policy "avatars_delete_own_folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
