-- Raise chat-media bucket limit to 50MB (if an older 25MB version was applied)

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'chat-media';
