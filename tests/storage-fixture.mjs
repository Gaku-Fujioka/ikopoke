// Minimal Storage metadata boundary for PostgreSQL policy tests. This does not
// emulate the Storage API, file bytes, bucket MIME/size enforcement, or JWTs.
export async function createStorageFixture(db) {
  await db.exec(`do $$begin
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end$$;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,owner_id text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,delete on storage.objects to authenticated;`);
}
