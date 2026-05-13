-- Policy to allow authenticated users to upload group avatars
create policy "Users can upload group avatars."
  on storage.objects for insert
  with check ( 
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'group-avatars'
  );

-- Policy to allow authenticated users to update group avatars
create policy "Users can update group avatars."
  on storage.objects for update
  using ( 
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'group-avatars'
  );

-- Policy to allow authenticated users to delete group avatars
create policy "Users can delete group avatars."
  on storage.objects for delete
  using ( 
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'group-avatars'
  );
