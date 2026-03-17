# Spec: Social Hub

**Intent:** `view_social_feeds`, `open_post_modal`, `regenerate_post_copy`, `close_post_modal`  
**Route:** `social_hub.html`

## Preconditions

- Authenticated session.

## Flows

1. Wait for app ready.
2. **Feeds:** `#social-hub-view` contains heading "Social Hub"; `#ai-articles-container` and `#marketing-posts-container` exist (content may load async).
3. **Post modal:** Opening is usually triggered from an article/card action in the app (e.g. share). If a "Prepare post" or similar control is visible in the feed, open it. Otherwise assert containers render and skip modal-dependent steps.
4. **When modal open:** `#post-text` visible; `#generate-custom-btn` (Regenerate) clickable; `#modal-close-btn` closes modal (`#modal-backdrop` hidden).

## Success criteria

- Page title region shows Social Hub.
- Feed containers mount; modal workflow works when entry point exists.

## Primary selectors

`#social-hub-view`, `#ai-articles-container`, `#marketing-posts-container`, `#post-text`, `#generate-custom-btn`, `#modal-close-btn`, `#copy-text-btn`

## Semantic fallback

- "Regenerate" wand button in the post prep modal; X button to close.
