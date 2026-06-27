# Build NYC Submission

## One-Sentence Pitch

Ratings Adjuster turns broad movie and video ratings into timestamp-level controls, so viewers can mute or skip only the moments they personally want to avoid.

## Who It Helps

- Parents who want a lighter viewing experience for their family
- Teachers who want to show useful videos without awkward moments
- Faith-conscious or preference-conscious viewers who want more control than a single rating label gives them

## What Works Today

- Chrome extension popup
- YouTube video detection
- Rating ceiling selection
- Category selection
- Local editor-approved timestamp database
- Mute or skip actions in the video player
- In-player filtering indicator
- Local pending timestamp suggestions

## Demo Flow

1. Load the repo as an unpacked Chrome extension.
2. Open `https://www.youtube.com/watch?v=0NbemFbr7Jw`.
3. Keep the default `G` rating with all categories enabled.
4. Seek to `0:29.5` to show profanity muting.
5. Seek to `0:18` or `0:34` to show skip behavior.
6. Open the popup and submit a new timestamp suggestion.

## Tech Used

- Chrome Extension Manifest V3
- JavaScript, HTML, and CSS
- Local JSON timestamp database
- Vercel-ready static landing page
- Supabase-ready schema for future community/editor workflow

## Live Links

- GitHub: `https://github.com/omzesha/BuiltInNYC-RatingsSelector`
- Demo site: add the Vercel URL after deployment
- Demo video: add the YouTube or Loom URL after recording

## Known Limits

- The MVP is YouTube-first.
- Timestamp data is local for the demo.
- Editor approval and account login are designed but not wired to a live backend yet.
