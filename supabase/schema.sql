-- Supabase-ready schema for the Ratings Adjuster community/editor workflow.
-- The MVP uses data/curatedSegments.json locally; this schema is the intended backend shape.

create type public.content_rating as enum ('G', 'PG', 'PG-13', 'R', 'NC-17');
create type public.segment_action as enum ('mute', 'skip');
create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  provider text not null default 'youtube',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  start_seconds numeric(10, 3) not null check (start_seconds >= 0),
  end_seconds numeric(10, 3) not null check (end_seconds > start_seconds),
  rating public.content_rating not null,
  categories text[] not null,
  action public.segment_action not null,
  reason text,
  status public.review_status not null default 'approved',
  submitted_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  start_seconds numeric(10, 3) not null check (start_seconds >= 0),
  end_seconds numeric(10, 3) not null check (end_seconds > start_seconds),
  rating public.content_rating not null,
  categories text[] not null,
  action public.segment_action not null,
  note text,
  status public.review_status not null default 'pending',
  submitted_by uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.editor_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.community_submissions(id) on delete cascade,
  reviewer_id uuid,
  status public.review_status not null,
  review_note text,
  created_at timestamptz not null default now()
);

create index segments_video_id_idx on public.segments(video_id);
create index segments_status_idx on public.segments(status);
create index community_submissions_status_idx on public.community_submissions(status);
