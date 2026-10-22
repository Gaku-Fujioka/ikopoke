begin;

-- This is a personal UI preference, never an authorization claim.
alter table public.profiles add column onboarding_version integer not null default 0
  check (onboarding_version >= 0);
grant select (onboarding_version), update (onboarding_version)
  on public.profiles to authenticated;
-- Existing profiles_*_own policies continue to enforce auth.uid() ownership.

commit;
