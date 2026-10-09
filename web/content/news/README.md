# News posts

One Markdown file per post, named `YYYY-MM-DD-short-title.md` (the part after the date becomes the web address,
e.g. `/news/mmu-mou`). Newest posts are listed first. Front matter:

```
---
title: Post title
date: 2026-08-01            # sort order and default display date
dateLabel: August 2026      # optional: how the date is shown
tag: Partnership            # Partnership, Community, Launch, Announcement, Promotion …
place: Venue, City          # optional
summary: One or two sentences for lists and link previews.
images:                     # optional; first image is the cover. Put files in public/assets/img/news/
  - /assets/img/events/mmu-1.jpg | Alt text describing the photo
membersOnly: false          # optional: true shows the body to logged-in members only
---

Body in Markdown.
```
