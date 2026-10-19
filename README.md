# Mir & Ella — Wedding Website & RSVP

A production-ready wedding website, RSVP system and private admin dashboard for **Mir & Ella · December 19, 2026**.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4, Framer Motion, Lucide icons, Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security, RPC functions, Storage)
- **Hosting:** GitHub Pages (static) — deployed by GitHub Actions

```
GitHub Pages (static React build)
        │
        ├── Public website  (/  and  /#/rsvp)
        └── Admin website   (/#/admin …)
                 │
                 ▼
             Supabase ── Database (RLS) · Auth · Storage
```

GitHub Pages only serves the built HTML/JS/CSS. **Every RSVP, invitation and setting lives in Supabase.** Nothing is stored in GitHub files or in `localStorage`.

---

## Contents

1. [What's included](#1-whats-included)
2. [Installation](#2-installation)
3. [Environment variables](#3-environment-variables)
4. [Supabase setup](#4-supabase-setup)
5. [Admin account](#5-admin-account)
6. [Local development](#6-local-development)
7. [Deploy to GitHub Pages](#7-deploy-to-github-pages)
8. [Routing on GitHub Pages (why hash URLs)](#8-routing-on-github-pages-why-hash-urls)
9. [Security model](#9-security-model)
10. [Testing checklist](#10-testing-checklist)
11. [Production launch checklist](#11-production-launch-checklist)
12. [Project structure](#12-project-structure)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. What's included

**Public wedding page (`/`)** — hero image, couple names and date, introduction text, ceremony and reception cards with *View Location* buttons, admin-managed information sections (Dress Code, Ceremony, Reception, Unplugged Ceremony, Gifts…), a prominent RSVP button and footer. All text, links, the hero image and the sections come from Supabase.

**RSVP (`/#/rsvp`)** — Search → *Your Invitation Has Arrived* → *Open Invitation* (envelope animation; a simple fade for reduced-motion users) → RSVP form with conditional questions → *Are you sure?* modal → success page. Re-submitting updates the guest's single existing response.

**Admin (`/#/admin`)** — Supabase email/password login, dashboard with live counts, catering headcount, charts and guests' messages, invitation CRUD (including **included guests** per invitation), responses (filter, view, delete), additional-guest approvals, an **Outfit Gallery** manager, website settings (including hero image upload and section add/edit/delete/reorder/show-hide), CSV export, and an automatic activity log.

### Guests on an invitation — two kinds

| | Included guests | Guest requests |
|---|---|---|
| Added by | the couple, in *Admin → Invitations → Edit* | the invitee, on the RSVP form (price set in *RSVP Questions*, default ₱799 each) |
| Shown to the invitee | yes — on the invitation card and at the top of the RSVP form | only what they entered |
| Approval | confirmed automatically | *Pending* until you approve or decline in *Extra guests* |
| Limit | up to 20 per invitation | *Extra guests they may request* on the invitation |
| Stored as | `additional_guests.added_by = 'admin'` | `additional_guests.added_by = 'invitee'` |

If you include a name the invitee had already requested, that request becomes an included (approved) guest.

### Outfit gallery

*Admin → Outfit Gallery* manages the "Attire Inspiration" carousel shown under the wedding details (For Him / For Her). Upload photos (stored in the `wedding-assets` bucket under `outfits/`) or paste image links, add captions, reorder, hide/show or remove them, and edit the section title/description or hide the whole section. The six illustrations that ship with the site (`public/samples/outfits/`) are placeholders — hide or remove them once you've added real photos.

### More admin pages

| Page | What it does |
|---|---|
| **RSVP Questions** | Switch the standard questions on/off or reword them (*Where are you coming from?* can also be made optional). Add up to 30 of your own: single choice, multiple choice (with a limit), Yes/No, short or long answer, number (with min/max). Each can be required, asked of attending guests / guests who can't attend / everyone, and shown **only if** an earlier question was answered a certain way. Answers appear in the response details, the CSV export (one column per question) and as dashboard charts. The database checks every rule again, so the form can't be bypassed. |
| **Seating** | Floor plan of the venue: round or long tables (drag, resize, rotate; chairs placed automatically), the hall outline, and stage / dance floor / entrance / buffet / photo booth… marked **Inside** or **Outside** automatically (or by hand). Tap a chair to seat any guest who RSVP'd "attending", or seat a whole party at once. Seats free up automatically when a guest declines or is removed (a notice lists what changed). Print / Save as PDF includes a guest list per table. Tables are also chosen from a dropdown on each invitation (with seats left). |
| **More photo & video sections** | Admin → Photos & Video → *More sections*: add extra photo galleries (each with its own title, description, one of the 10 layouts and up to 30 photos) or extra videos (YouTube/Vimeo link or an uploaded MP4, cover image, caption). Show/hide, reorder or remove each; they appear on the home page after the main gallery and film. Up to 12 sections. Migration `022_media_sections.sql`. |
| **Export to Excel** | Seating or Invitations → *Export to Excel*: an .xlsx with every guest (invitees, included guests, approved extras), their side, RSVP, table and chair — optionally their entourage role. Choose everyone invited, attending only or seated only. Two sheets: by name, and grouped by table. Made in the browser, no data leaves your computer except the download. |
| **Undo / redo (Seating)** | Every change can be undone — moving and resizing tables and items, and now seat changes too: seating someone, swapping, taking someone off, removing a chair (the chair comes back), seating a party, freeing declined seats. Undo changes the real seat assignments, and checks first that those seats weren't changed by someone else meanwhile (if they were, nothing is overwritten and it says so). A message after each seat change has an *Undo* button; toolbar Undo / Redo; **Ctrl/⌘+Z** and **Ctrl/⌘+Shift+Z**. History lasts until the page is closed or refreshed. |
| **Remove a chair (Seating)** | Tap a chair → *Remove this chair*, or use the remove button beside a chair in the table's chair list. Whoever sits there is unassigned (they stay on the guest list); the chairs after it are renumbered one lower and the table gets one chair fewer. A table keeps at least one chair. |
| **Find My Seat** | Optional guest page (`#/seat`, switch in Seating: hidden / visible / from a date). Guests type their name and see their table highlighted on a read-only map — only their own chair and party, never other guests' names. Adds a "Find My Seat" menu button and a QR on Share & QR. **Pre-assign seats before guests RSVP** (switch in Seating, off by default, needs migration 020): you can seat guests who haven't answered yet; they see their seat in Find My Seat and, after RSVPing "attending", their table and chair with a *See it on the map* button. Seats are coloured green (confirmed), gold (waiting for RSVP) or red (declined); a decline keeps the seat in red until you free it (*Free declined seats* in Seating). Switching it off frees the declined guests' seats and goes back to the original rules. |
| **Virtual invitations** | In Invitations, *Copy invitation* copies a short message plus the guest's personal link (`#/i/<code>`), ready to paste into Messenger, Viber or a text. The guest sees a sealed envelope with their name and your design style's wax seal; tapping it opens the envelope and the invitation card (same layout as the printed card, without the QR), which they can turn over. The back shows the *Good to know* sections ticked in Printables (bold titles too). The RSVP page uses the same envelope and card when a guest finds their invitation, then *Continue to RSVP*. Below the card: RSVP (straight to their form), or Find My Seat once they're attending, plus links to the website, *Add to calendar* and the maps. Edit the message with *Invitation message* (placeholders {name}, {date}, {couple}, {link}). The *Opened* column shows when each guest first opened their invitation — the link, or the envelope on the RSVP page — and how often; opens while you're signed in as admin aren't counted, and the reset button clears a test open. |
| **Virtual invitation settings** | Admin → Invitations → *Virtual invitation settings*. *Message*: the text copied with each link. *What guests see*: the card back's *Good to know* (same as Printables, or its own picks with bold titles), and what stays private until a guest confirms they're attending — ceremony & reception (a short note shows instead), *Good to know*, maps & calendar. Guests who decline keep the private version. If something is private here but still public on the website, a *Recommended* note offers *Hide on website*. |
| **Privacy (website)** | Website Settings → *Privacy*: keep ceremony & reception and/or *Good to know* off the public website; a short "shared with our confirmed guests" note shows instead. Confirmed guests see the details on their virtual invitation. (The details stay in the database's public settings, so this hides them from the website, not from someone reading the data directly.) |
| **Link preview (Messenger)** | Invitation links use a small share page (`/i/?c=<code>`) with its own preview — "You're invited · names · date" and an invitation-style image made from your hero photo, names, date and design (Share & QR → *Link preview*; it's re-made automatically when those change and picked up by the next site build, at the latest the daily rebuild). If Messenger still shows a plain link, use Facebook's Sharing Debugger → *Scrape Again*. Older `#/i/<code>` links keep working. |
| **Raffle** | Admin → Raffle: the host spins a prize wheel (optional prize per spin); winners are saved and can be taken off the wheel. Names: all guests, Groom's side or Bride's side, optionally attending only; tick names off or add extra names. *Present* opens a full-screen wheel for a projector. Two ways to play: *First spin wins*, or *Last one standing* — each spin knocks a name out, the last few knocked out get consolation prizes (set how many, and a prize per place) and the last name left wins; quick spins until the finals (set when), optional auto-play, and the round is saved so a refresh doesn't lose it (*New round* starts over). Sounds: ticks while spinning, a soft tone for “out”, a chime for consolation prizes and a fanfare (with confetti) for the winner; mute and volume on the raffle and Present screens. The website page (`#/raffle`, hidden / visible / from a date) shows the wheel but can't spin it; names there (and in Present) are masked like *R\*\*\* G\*\*\*\*\** until the wedding day, or always / never as set — masking is done by the server.  **Present** (wheel and Bingo, admin and host mode) puts the browser in true full screen and keeps the screen awake (Esc leaves full screen, the ⛶ button brings it back, *Close* ends both). While the wheel is presented on a wide screen, names knocked out this round stack on the **left** (newest on top, older ones fading, a soft rose flash on arrival) and today's **winners** stack on the **right** (prize and place, a gold shimmer and sparkles on arrival, a crown for the last one standing); both hold still during a big reveal and animate in as it closes. Host mode reads them with `raffle_host_board` (migration `037_raffle_host_board.sql`).|
| **Host mode** | The 4-digit host code (Admin → Raffle → Host access) unlocks host mode on any device — Menu → *Host mode* — even while the raffle is hidden. A signed-in admin is always a host. The menu then shows *Raffle & Bingo*, *Present guest photos* and *Present our photos & videos*; guests never see a slideshow or present button. Presenting (`#/present/guests`, `#/present/ours`) opens full screen: each photo stays 5 seconds once loaded (slow drift, soft blurred crossfade, the photographer's name or caption, the monogram), films play to the end (uploaded MP4s, YouTube and Vimeo), new guest photos join the show **live** — within a second or two of a guest sharing them, and they play next (a database signal on the Realtime channel `guest-photos`; a regular check every 2 minutes is the safety net if the Wi-Fi drops the live connection, and hidden photos leave the show the same way), ← → / Space / swipe to control it, and the screen is kept awake. When Admin → Music is switched on, the website's song plays under both presentations from *Begin*, looping seamlessly (the chosen section is decoded once and each pass crossfades into the next on the audio clock — no dip or gap at the loop point); it fades down while a film plays its own sound and back up after, and the ♪ button or **M** turns it off and on (remembered on that device). Admin → Guest Photos and Admin → Photos & Video have a *Present* button too. Migrations `031_host_mode.sql`, `032_live_guest_photos.sql`. |
| **Bingo** | Admin → Raffle → *Bingo*: a 75-ball lotto drum (B 1–15 · I 16–30 · N 31–45 · G 46–60 · O 61–75). Each draw mixes the balls to a drumroll for about 3 seconds, then the ball rolls out and is announced (e.g. *N-42*); numbers never repeat (secure random from the balls still in the drum). A 75-number board lights up the calls, with the last few shown as balls. Host tools: undo last call, new game, auto-draw every 5–30 s, and *Check a card* (type the numbers on a winning line). *Present* opens it full screen (Space draws). The game is kept on the presenting device (browser storage), so a refresh doesn't lose it — use the same device for the whole game. |
| **Attire guide (Printables)** | Printables → *Attire guide*: insert cards in the invitation's card size and design — the motif colours and a note on the first card, then the outfit photos: a gentleman's and a lady's look slightly overlapping (paired by their order in Outfit Gallery), a look without a partner on its own; more looks continue onto further cards. Choose how many sets to print; landscape sheets with crop marks, one side. Small photos get a warning. |
| **Raffle note (RSVP page)** | Website Settings → *Raffle note on the RSVP page*: a highlighted card above the name search to encourage replies — a lead-in line, an amount shown big and gold (e.g. *Confirm your attendance for a chance to win* · **up to ₱25,000**) and optional small print, with a live preview; shown while RSVPs are open. Saved with the RSVP question settings (`rsvp_config.teaser`), no migration. |
| **RSVP confirmation** | Guests who reply *attending* see a highlighted *Where to go* card: ceremony and reception with times, *Open in Maps* buttons and *Add to calendar*. |
| **Quick search (Ctrl+K)** | From any admin page press **Ctrl+K** (⌘K on a Mac) or click *Search guests…* at the top of the sidebar. Type part of a name: invitees, included guests and guest requests show with their side, RSVP, table and whose invitation they're on; pages show too. ↑ ↓ and Enter open it — Invitations (or Extra guests) with the name already searched. |
| **Unsaved changes** | Pages with a Save button show *All changes saved* / *Unsaved changes* / *Saving…* beside it. With unsaved changes, leaving through the menu (or logging out) asks *Leave without saving?* — *Stay on this page* keeps your edits; closing or reloading the tab asks too. (The browser's Back button isn't covered.) |
| **Sidebar** | Groups: *Invite & print* (Invitations, Printables, Share & QR), *Guests* (Responses, Extra guests — was "Additional Guests" —, RSVP Questions, Seating, Raffle), *Website*. Delete / remove / reset buttons and their confirmations are red everywhere; every control shows a gold focus outline when reached with the Tab key. |
| **Printables layout** | One page in three steps. **Choose** the printable at the top (chips that wrap; a dropdown on phones). **Adjust** in the left column: folding sections — *Content*, *Monogram, names & date*, *Paper & design*, *Printing* (one open at a time, the last one remembered) — and the printable's own panel below (guests, tables, leaflets…). **Preview & print** on the right: a print bar with a summary (e.g. "4 invitations · 2 pages · A4 · 5 × 7 in"), Fronts / Backs / Both and the Print button, then the preview. On desktop the settings column and the print bar stay on screen while you scroll the preview; on tablets and phones everything stacks and the print bar sits at the bottom of the screen. Paper invitations: *Guests to print* shows "N of M selected", *No reply yet / Everyone*, Groom / Bride, search and Select not yet printed / Select all / Clear; each guest is one line with *Edit card* for the position and "addressed as". Before anyone is ticked the preview shows a sample card (never printed). Ticked guests stay ticked when you switch printables or leave and come back (until the page is reloaded). |
| **"Please don't wear" (attire guide)** | Printables → Attire guide → *Content* → *Please don't wear*: a highlighted box at the bottom of the attire card (the last card when spread over cards) — a ✕ and a heading such as *PLEASE REFRAIN FROM WEARING*, then the list (e.g. Slippers · Sando · Shorts · Above-the-knee skirts). Edit the heading and the list (one per line or comma-separated, up to 12); the photos shrink a little to make room. On by default, saved with the setup. |
| **Border on or off (Printables)** | Page setup → *Border*: **Show** or **Hide** the design's frame around each card — invitations, entourage, attire, thank-you cards, the money envelope, name cards, table names and the poster. The corner marks for cutting are printed either way. Saved with the setup. |
| **Front and back line up (Printables)** | Paper isn't always its exact size (A4 measured 21.0 × 29.8 cm instead of 29.7), and when a sheet is turned over the back can land a millimetre or so off. Two fixes, shared by every printable and saved with the setup: **Page setup → My paper** — type the size you measured; everything is centred on your real sheet. **Print → Lining up both sides** (paper invitations, entourage, attire, thank-you cards, name cards, table names, leaflets — whenever backs are printed): *Show the line-up test*, print it the way you'll print the cards, hold it up to a light and read where the front's cross falls on the back's rulers; type that into *Move back →* / *Move back ↓* (0.1 mm steps; add to what's there and test again until it reads 0). Only the backs move. Check the 5 cm bar first: if it isn't 5 cm, choose *Actual size / 100%* in the print dialog. |
| **Bold, italic & gold words (Printables)** | Printables → Paper invitations → *Content*: the ✎ button next to *Ceremony* or *Reception* changes that line for print only (the website keeps its own) — e.g. select the church name and press **Bold**. Select words, then *Bold* (Ctrl+B), *Italic* (Ctrl+I) or *Gold* (Ctrl+G, the design's accent colour); press the same button again to take it off, the eraser clears formatting; Enter starts a new line on the card. A *Prints as* preview shows the result; *Use the website's text* goes back. The same buttons are in the *Good to know* editor for the back. Stored with the Printables setup (`frontText`), no migration. |
| **Include an invitation in another** | Invitations → *Include in…* on a row (e.g. Arielito Pugay → Violeta Pugay's invitation): search and pick the invitation, read *What happens*, confirm. The invitee becomes an **included guest** there and their own invitation is removed — keeping their chair in Seating, their entourage place, guest photos and the "opened" count; their own included guests come along; an *attending* answer moves over if the other invitation hasn't answered (a *can't come* answer doesn't, as it would decline the whole invitation); their old link / QR opens the combined invitation. *Undo* in the message right after, or later: Edit the invitation → *Own invitation* next to the guest, which brings back their own invitation with the same link, position and allowed guests (any included guest can be given their own invitation this way, with a new link). Done in one database step (all or nothing). Migration `039_combine_invitations.sql`. |
| **Record a response for a guest** | In Add/Edit Invitation, choose *Attending* or *Not attending* for guests who can't RSVP online (e.g. elderly relatives), with an optional contact number. A confirmation explains what happens. These show as **Confirmed by couple**; if the guest later RSVPs online, their answers replace it. |
| **Admin sidebar** | Open by default. The ⟨panel⟩ button at its top (or the **[** key) collapses it to a strip of icons (labels as tooltips) and gives the pages the room; with *Opens on hover* it slides open over the page while you point at it and closes when you move away. The choice is remembered in the browser. Phones keep the slide-over menu. Wide pages (Invitations, Responses, Extra guests, Printables, Seating) use more of the screen. |
| **Tables (Invitations, Responses, Extra guests)** | The table gets its own height, from where it starts down to the bottom of the screen (at least 360 px), and scrolls inside it with the column headings kept at the top — so the sideways scrollbar is always on screen, not at the bottom of a long list. Re-measured when the window or the page above changes; phones keep the card view. |
| **Good to know for print only (Printables)** | Paper invitations → Content → *Good to know*: the pencil changes a Website Settings section's wording **for the printed cards only** (*Use the website's text* goes back), and *Add your own* adds print-only sections. Website Settings is not changed. |
| **Fits my envelope (Printables)** | Page setup → Card size → *Fits my envelope*: enter the envelope's inside size (default 5 × 7 in), how many cards go in together and each card's thickness; the cards print at the largest 5 : 7 size that slides in with the stack (4 mm of room plus the stack's thickness off the width and height — e.g. 12.2 × 17.1 cm for 3 cards of 0.35 mm). The preview and crop marks use that size; text fits as usual. |
| **Printables** | *Paper invitations*: tick pending guests and print personalised cards in your theme (5×7 or 4×6 in, on A4 · 210 × 297 mm, Letter · 8.5 × 11 in or Legal · 8.5 × 14 in — the picker shows each size in mm and inches — with crop marks). Each card has a personal QR that opens the guest's own invitation, and can show the guest's position (e.g. Maid of Honor) — taken from the Entourage when linked, typed on the invitation, or hidden. Printed invitations are remembered. *Money envelope*: a cut-and-fold **policy envelope** (about 9.2 × 18.5 cm, opening at the short top edge so bills fit flat). The front shows your names, date, ceremony and reception and — optionally — your GCash / InstaPay gift QR; the glue strip and bottom flap fold **inside** (they carry the GLUE marks), so the whole back is free for the message and "From" line; the closing flap carries your monogram seal. Everything printed (cards, envelope, welcome-sign poster) follows your Look & Feel **design style** (Classic, Maison Noir, Gilded Deco, Heritage); a *Design* picker in Printables lets you try another style on paper. Dark styles always print on light paper. A **3D preview** shows the folded envelope (open/close the flap) and lets you spin it or the invitation card around. Always print at 100% / Actual size. *On the front of the card* switches leave off the ceremony, reception, "please respond by" date or "together with" names; what's left moves to the middle so the card stays balanced. Your Printables setup (paper, design, card size, QR placement, "Good to know" picks and bold titles, print side and other options) is saved as you go and is the same on every device; *Reset to defaults* clears it. |
| **Coloured paper (Printables)** | Page setup → *Print on*: **As designed** (the card's background and filled shapes are printed, as now) or **Coloured paper** — for ivory, champagne, blush, kraft or motif-coloured card stock. On coloured paper nothing is printed for the background (the paper shows through), the monogram seal, ornaments and Heritage woven band become fine outlines, and attire photo frames are a thin line instead of white with a shadow — so only the words, lines, monogram, QR codes and photos use ink, and a slightly-off cut never shows a white edge. Pick the paper's colour (Ivory, Champagne, Blush, Kraft, your motif colours, or any other); it's only for the preview, where the sheets and 3D card show the print on that colour — it's never printed. The gold (and text, on darker paper like kraft) prints a shade deeper so it still stands out; a dark paper gets a warning, since home printers can't print white and QR codes need contrast. Applies to every printable and is saved with your setup. |
| **Name cards (Printables)** | Printables → *Name cards*: folded triangle stands for the tables — 2 per sheet (each half folds into a stand) or 4 smaller ones. Tick guests (each invitee and the guests they bring; attending, or everyone) and/or type more names (“Name \| table”). The name prints on both slanted faces (one upside down, so both read upright once folded), with the guest’s table from Seating and your names & date if you like; dashed fold lines, a glue tab under the base, a ✂ cut line. One side only. |
| **Table names (Printables)** | Printables → *Table names*: the seating plan’s table names (tick which) plus any typed names, copies of each, an optional small line above (e.g. *Table*). **Flat cards** (1, 2 or 4 per sheet, name auto-sized) printed **the same on both sides**: the back of each card goes to the mirrored spot so it lands behind its front, and a **line-up test** sheet (cross on the front, mm rulers on the back) measures the printer's shift — typed in once (*Move back → / ↓*) and saved. Or **folded stands** (big, 1 per sheet, or 2 per sheet), one side only. |
| **Leaflets (Printables)** | Printables → *Leaflets*: build your own leaflets from blocks — heading, text, hashtag, QR codes (website, RSVP, Find My Seat, *Share your photos*, gift QR, or any link) with captions, ceremony & reception, the *Program flow* and *Bible verse* from Website Settings, your own list (“3:00 PM — Ceremony” lines up the times), monogram, your names & date, ornament line — reorder or remove them, on the front and (optionally) the back, 1 / 2 / 4 per sheet; text and QR codes size themselves to fit (wide cards put the QR codes on the right). Start from *Share your photos*, *Guest info card*, *Program* or blank; make as many as you like (duplicate / delete); saved with your setup. Two-sided leaflets use the same line-up settings as table names. |
| **Addressed as (Printables)** | Each invitation in Printables → Paper invitations has an *Addressed as* line, set one by one: suggestions built from its names (*Mr. & Mrs. Juan dela Cruz*, *Juan & Maria dela Cruz*, *The Garcia Family*, …) only fill the box, titles (*Dr. & Mrs.*, *Engr. & Mrs.*, *Atty. & Mrs.*, *Hon. & Mrs.*, …) can be put in front, and nothing is saved until *Save*. When set, it replaces the name and the “together with” line after “Dear” on the printed card **and** on the guest’s online invitation (envelope and card); *Use the usual name* goes back. Two people with their own titles print one per line with the “&” on its own line between them (*Mr. Joey Montes* / *&* / *Mrs. Vivian Montes*); a shared title stays on one line (*Mr. & Mrs. Juan dela Cruz*, *… & Family*). Migration `034_invitation_addressed_as.sql`. |
| **Entourage card (Printables)** | The entourage from Admin → Entourage as a card in the invitation set — same size, design style, frame and crop marks. Paper invitations → *Entourage*: **None**, **Separate card** (one per invitation, on its own sheets after the invitations, monogram on the back) or **On the back** of every invitation (the RSVP QR then moves to the front, “Good to know” off the back). Pairs print in two columns close together (as couples), two one-person groups in a row share a line (e.g. Best Man · Maid of Honor), roles in small caps under the name; text shrinks to fit. The *Entourage* tab prints extra copies on their own. |
| **Attire guide & thank-you cards (Printables)** | *Attire guide* prints everything on **one card** by default — the motif on top, then a column per look with its label once at the top and his look above hers (*Spread over cards* keeps the bigger-photo layout). *Thank-you card*: your heading, message and sign-off (saved), in the invitation's design, with your monogram, names and date on the back; the same card for any number of copies, or one per guest using each invitation's *Addressed as* (“Dear Mr. Joey Montes & Mrs. Vivian Montes”). |
| **Photos & Video** | Couple gallery (grid or carousel, up to 30 photos, auto-resized) and prenup video (YouTube/Vimeo link, or an MP4/WebM upload up to 30 MB). |
| **Photo & video order** | Photos & Video → *Order on your website*: every photo and video section — the main gallery and film included — with up / down buttons; saved at once and used on the home page (migration `038_media_order_thumbs.sql`; until it's run the old order stays). |
| **Faster photos** | Uploaded photos are saved at up to 1800 px (WebP, quality 82 %) plus a small copy of about 800 px; the website's galleries load the small copy (with `srcset`, so big screens still get the sharp one) and the full photo only when a guest opens it. Opening Photos & Video makes the small copies for older photos by itself (*Optimise photos* retries), keeping the originals. Unsplash pictures (hero, samples) are fetched at the size the screen needs. Needs migration 038 for the small copies. |
| **Guest photos** | Guests type their name on `#/photos` and share photos from their phone (resized in the browser); they show as a swipeable masonry strip on the home page and `#/photos`. Admin → Guest Photos sets the title, style, instant or approve-first, and limits (photos per guest and a wedding-wide total). A guest can delete their own photos, and those no longer count toward their limit; photos an admin hides still count, and the wedding-wide total counts everything. Migrations `027_guest_photos_and_music.sql`, `033_guest_removed_photos_free_quota.sql`. |
| **Program flow** | Website Settings → *Program flow*: the order of the day, one moment per row (time — optional, e.g. “2:00 PM” or “After the ceremony” — a name and an optional note), reorder / remove, up to 30; *Start with a typical program* fills a usual Filipino wedding day using your ceremony and reception times. *Show the program on the website* switches it on or off (off = saved and printable, guests don’t see it — the database doesn’t even send it to them). On the website it’s an *Order of the Day* timeline right after the ceremony & reception cards; guests who opened the site once still see it at the venue without signal. Stored in its own table, `program_items` (migration 040). In Printables → Leaflets, the *Program flow* block prints it (the *Program* leaflet starts with it). |
| **Bible verse** | Website Settings → *Bible verse*: the verse (blank line = new paragraph) and its reference, with a live preview and its own show/hide switch. Highlighted on the home page in a framed card right after the introduction. In Printables → Leaflets, the *Bible verse* block prints it (the back of the *Program* leaflet starts with it). Stored on the settings row (`verse_*`, migration 040). |
| **Entourage** | Principal sponsors, bridesmaids, etc., in pairs or lists, with presets. Names can be typed or picked from your guest list (“Pick from guest list”), which links them to their invitation. |
| **Outfit Gallery** | Also holds the motif colour swatches. Each photo can have a **label** — who the look is for, e.g. *Principal Sponsors*, *Parents & Relatives*, *Guests* (quick picks, or type your own) — shown as a small gold tag above the caption on the website and on the printed attire card. The couple's own illustrations live in `public/attire/` (cropped one person per 3:4 portrait, 900 × 1200, same background, scale and feet line). **Layout on the website**: *His & hers side by side* (each look for him next to the look for her in the same position, in one frame under **one label**, with *For him* / *For her* captions; tapping opens the pair large) or *For Him / For Her tabs*. In side-by-side mode Admin → Outfit Gallery shows a **Pairs** list with one label per pair (saved to both photos, so tabs and printing agree); new photos take the label of the look they pair with. The printed one-card attire guide fits up to four looks in a row. Migrations `035_outfit_labels_new_attire.sql`, `036_outfit_pairs_layout.sql`. |
| **Share & QR** | Website link, share buttons, QR code (PNG/SVG), a printable QR card, and a **welcome sign poster** (A2 portrait by default, also A1 / A3) with the website, RSVP and Find My Seat QR codes together in one layout — save as PDF for a sintra board. Link previews (Facebook/Messenger/Viber) use the couple names, date and hero photo; the site rebuilds daily to refresh them. |
| **Look & Feel** | 10 templates, heading/body fonts, colours (with a readability check), hero layout, live phone/desktop preview. |
| **Find My Seat without signal** | Once a guest has looked up their seat on their phone with a connection, Find My Seat still opens at the venue without signal and shows that seat ("No signal right now — this is your seat saved on this phone"). Online, the seat is always looked up fresh, so changes still reach guests. A small helper (`public/sw.js`) keeps only the site's own files and fonts on the phone; the guest's own seat and the public wedding details are kept in the phone's storage. No admin data or other guests' data is ever kept. The page tells guests to look their seat up once before leaving home. |
| **Friendly error page** | If a page ever breaks, guests see your names, the date, both venues (with map links), *Try again*, *Go to the home page* and *Find my seat* instead of a blank screen; admin pages keep the menu and say nothing saved was lost. After an update the site still reloads itself once if an old page file is missing. |
| **Save to Google Drive** | Admin → *Guest Photos* and Admin → *Photos & Video* each have a **Save to Google Drive** button. It signs in with Google in your browser (permission: only files this site creates — `drive.file`), makes a folder "<couple names> — Guest Photos" or "— Our Photos" (reused next time), and copies every shown guest photo / every couple photo (sample photos excluded) at full size, named after who shared it or after the gallery section. A progress bar shows how far it is; *Cancel* stops it; running it again only adds photos not yet in the folder. Keep the page open while it runs (closing the tab asks first). Everything happens in the browser — no Google token is stored on any server. **Setup once:** Google Cloud Console → *APIs & Services* → enable the Google Drive API, create an *OAuth client ID* (Web application) with this site's address under *Authorised JavaScript origins*, and paste the Client ID in the Save to Google Drive window (saved in the admin settings; `VITE_GOOGLE_CLIENT_ID` also works). While the Google app is in *Testing*, add your Google account as a test user. Guests never see any of this. |
| **Website looks** | Six extra design styles in Look & Feel, each with four colour choices: **Eucalyptus & Gold** (painted watercolour greenery and fine gold frames round your photo), **Watercolour Garden** (painted garden roses at the foot of an arched photo), **Save the Date** (full-screen photo, "Save the Date" in script and a round days/hours/minutes countdown), **Sunlit Arch** (a warm sun-circle behind your names, arched cards), **Love Story** (a round photo with drifting rose petals, rounded blush cards) and **Damask** (a fine gold damask pattern with an ivory name medallion). They change the website only — guest pages keep every button and form, the admin stays in its usual design, and Printables keep the Classic print design for these looks (pick another in Printables → *Design*). The artwork is drawn for this site (no stock images) and adds about 30–120 KB depending on the look. Nothing changes for guests until you press *Save & publish*. |
| **Website Settings** | Also: RSVP deadline (closed automatically; reopen for 7/14 days; show or hide it to guests), RSVP button text, and the gift QR (upload, show/hide, invited-guests-only or everyone). |

The RSVP form asks for a Philippine mobile number (stored as `+639…`) — required for guests who attend, optional for guests who decline.

---

## 2. Installation

Requirements: **Node.js 20.19+** (Node 22 recommended) and npm.

```bash
npm install
```

---

## 3. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → **Project Settings → API** → *Project URL* (e.g. `https://abcd1234.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Same page → the **anon / public** key (newer projects call it the **publishable** key, `sb_publishable_…`). Either works. |

> ⚠️ **Never** use the `service_role` / **secret** key anywhere in this project — not in `.env.local`, not in GitHub secrets, not in code. Anything prefixed `VITE_` is bundled into the public JavaScript. The anon key is designed to be public; the database is protected by Row Level Security.

`.env`, `.env.local` and `.env.*.local` are already in `.gitignore`.

---

## 4. Supabase setup

1. **Open Supabase** and create (or open) your project.
2. **Open SQL Editor** → *New query*.
3. **Run `supabase/schema.sql`** — paste the whole file and click *Run*. It creates:
   - tables: `wedding_settings`, `invitations`, `rsvp_responses`, `additional_guests`, `admin_activity_logs`, `admin_users`
   - constraints, indexes, foreign keys with `ON DELETE CASCADE`
   - Row Level Security on every table + policies
   - the secure RPC functions `find_invitation`, `find_invitation_by_code`, `submit_rsvp`, `is_admin`
   - activity-log triggers
   - the public Storage bucket **`wedding-assets`** and its policies
   - the default `wedding_settings` row (names, date, church, reception, map links, the 5 default sections)

   The script is safe to run again on the same project.
   **Then run every file in `supabase/migrations/` in order**: `002_outfits_messages_included_guests.sql` (outfit gallery, message to the couple, admin-included guests) `003_deadline_mobile_entourage_motif_gift.sql` (RSVP deadline, required mobile number, entourage, motif colours, private gift QR) `004_gallery_video.sql` (couple photo gallery, prenup video), `005_theme.sql` (Look & Feel templates), `006_rsvp_question_builder.sql` (custom RSVP questions) `007_rsvp_wording.sql` (RSVP button text, show/hide deadline, mobile optional for declines) `008_seating.sql` (seating plan, table list, Find My Seat) `009_admin_rsvp_printables.sql` (responses recorded by the couple, printed-invitation tracking) `010_event_times.sql` (optional ceremony / reception times), `011_entourage_links_positions.sql` (entourage ↔ guest links, positions on printed invitations) `012_included_guest_lookup.sql` (included guests who search their own name are told whose invitation they're on) `013_invitation_side.sql` (Groom's side / Bride's side on each invitation) `014_gallery_layouts.sql` (ten photo gallery layouts) `015_admin_preferences.sql` (the Printables setup is remembered across visits and devices) `016_virtual_invitation.sql` (virtual invitation links and who opened them) `017_card_back_and_rsvp_envelope.sql` (on-screen card backs follow the Printables selection; the RSVP page's envelope counts as opened) `018_privacy_preview_raffle.sql` (privacy options, the Messenger preview image, the raffle wheel) `019_raffle_last_standing.sql` (raffle places and the last-one-standing round) and `020_seat_preassign.sql` (optional pre-assigned seats: guests see a seat before they RSVP, coloured by their answer; declines keep the seat until freed).
4. **Run `supabase/seed.sql` if testing** — adds sample invitations: *Juan Dela Cruz* (Table 5, 1 guest), *Maria Santos* (VIP, 2 guests), *Pedro Reyes* (Family Table, 0 guests), *Ana Villanueva* (A1, 3 guests) and an **inactive** *Carlos Mendoza* (must not be found by search).
5. **Create the admin user** — see [section 5](#5-admin-account).
6. **Configure Storage (hero image uploads)** — already done by `schema.sql` (bucket `wedding-assets`, public read, admin-only upload). Check it exists under **Storage**. If your project didn't allow the SQL to create the bucket, create it manually: *Storage → New bucket → name `wedding-assets` → Public bucket ON*, then run `schema.sql` again so the policies are added.
7. **Recommended Auth settings** — *Authentication → Sign In / Providers*:
   - **Email** provider enabled.
   - **Allow new users to sign up: OFF.** (Only you should have an account. Even if it were on, strangers still couldn't access admin data because admin rights come from `admin_users`, not from simply having an account.)

---

## 5. Admin account

The admin password is **never** in the source code. It is stored (hashed) by Supabase Auth.

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**.
2. Enter your email and your chosen password (for example the password you planned to use), and tick **Auto Confirm User**.
3. Grant that user admin rights — SQL Editor, replace the email and run:

   ```sql
   insert into public.admin_users (user_id, email)
   select id, email from auth.users where email = 'you@example.com';
   ```

4. Visit `/#/admin/login` and sign in.

To add a second admin (e.g. Ella), repeat steps 1–3 with their email. To remove admin access:

```sql
delete from public.admin_users where email = 'someone@example.com';
```

To change a password: *Authentication → Users → (user) → Send password recovery* or *Reset password*.

---

## 6. Local development

```bash
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
npm run lint      # ESLint
```

Public site: `http://localhost:5173/` · RSVP: `http://localhost:5173/#/rsvp` · Admin: `http://localhost:5173/#/admin`

If the environment variables are missing the site shows a friendly "Almost ready" notice instead of crashing.

---

## 7. Deploy to GitHub Pages

The workflow `.github/workflows/deploy.yml` builds and deploys on every push to `main`.

> **This wedding's site:** the live website is the Cloudflare Worker (`https://home.mirandella.workers.dev`), which builds from `main` by itself. The GitHub Pages copy is only a backup and is skipped automatically while GitHub Pages is off — e.g. now that the repository is **private** (Pages for private repositories needs a paid GitHub plan); the run still passes. The same workflow's daily 02:00 (PH) Cloudflare rebuild, which keeps the Messenger/Viber link preview in sync, runs either way.

1. **Add the secrets** — GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. **Enable Pages from Actions** — **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Push to `main`** (or run the workflow manually from the *Actions* tab). The workflow checks out the repo, installs Node 22, installs dependencies, lints, builds with your secrets, and deploys `dist/`.
4. Your site will be at `https://<user>.github.io/<repo>/` (or your custom domain).

The Vite `base` is `./` (relative), so the same build works for both a project page (`/repo/`) and a custom domain — no path to configure.

> Tip: run `npm install` locally once and commit the generated `package-lock.json`; the workflow will then use `npm ci` for reproducible builds.

---

## 8. Routing on GitHub Pages (why hash URLs)

GitHub Pages is static hosting: it has no server-side rewrite rules. With normal browser routing, refreshing `/rsvp` or `/admin/invitations` asks GitHub for a file that doesn't exist and returns **404**. The common "404.html redirect" trick works but is fragile (flash of the 404 page, query strings mangled, breaks with some link previews).

This project uses **`HashRouter`**, so URLs look like:

```
https://<user>.github.io/<repo>/#/rsvp
https://<user>.github.io/<repo>/#/admin/invitations
```

Everything after `#` is handled in the browser, so **refreshes, bookmarks and shared links always work** with zero server config. This is the most reliable option for GitHub Pages. When sending the RSVP link to guests, use `…/#/rsvp` (or just the home page — the RSVP button is on it).

**Future invitation links** are already supported by the code: `…/#/rsvp?invite=<invitation_code>` opens that guest's invitation directly via the `find_invitation_by_code` RPC. Admins can copy a personal link from the *Edit Invitation* dialog. Guests never *need* a code — name search remains the main flow.

---

## 9. Security model

```
Public guest → searches name → find_invitation() RPC → only the matching active invitation → submit_rsvp() RPC
Admin        → Supabase Auth login → is_admin() (admin_users) → RLS policies → full management
```

- The public role (`anon`) has **no table access** except reading `wedding_settings` (public website content). `SELECT * FROM invitations` from a browser returns *permission denied*.
- `find_invitation(search_name)` is `SECURITY DEFINER`, normalises input (trim, collapse spaces, lowercase), searches **active** invitations only, requires an exact name match, and returns only `invitation_id, invitee_name, table_number, max_additional_guests, has_existing_response`. It cannot list guests.
- `submit_rsvp(...)` is the only way a guest can write. It re-validates every field server-side (same limits as the form), enforces `max_additional_guests`, upserts the single response (`unique(invitation_id)`), and reconciles additional guests (kept names keep their status, removed names are deleted, new names are inserted as `pending`).
- Admin access requires a logged-in user **listed in `admin_users`**, checked in every RLS policy via `is_admin()` — frontend route guards are only a convenience.
- Admin changes are logged automatically by database triggers into `admin_activity_logs` (invitation created/updated/deleted, RSVP deleted, guest status changed, settings changed).
- Raw database errors are never shown to users; friendly messages are displayed instead.

---

## 10. Testing checklist

Run the seed first. Use a phone (or browser dev-tools device mode) for the mobile checks.

**Public website**
- [ ] Home page loads; hero image shows (change it in Settings and refresh)
- [ ] Church and reception *View Location* buttons open the correct Google Maps links
- [ ] RSVP button (hero nav and bottom section) opens `/#/rsvp`
- [ ] Mobile layout: no sideways scrolling, text readable, buttons easy to tap
- [ ] Desktop: the *Details* link and the *Scroll* arrow in the hero glide down to the wedding details
- [ ] The *Attire Inspiration* carousel shows under the wedding details; *For Him / For Her* switch; swipe on phones, arrows on desktop; tapping a photo enlarges it

**Invitation search**
- [ ] `Juan Dela Cruz` is found (shows *Your Invitation Has Arrived*, name, *Table 5*)
- [ ] `  juan    DELA cruz ` is also found (case/spaces normalised)
- [ ] `Juan` or a misspelling → friendly "couldn't find" message, no other names revealed
- [ ] `Carlos Mendoza` (inactive) is **not** found

**RSVP**
- [ ] Open Invitation plays the envelope animation (and a simple fade with *Reduce motion* enabled in OS settings)
- [ ] *Declining* hides all other questions and saves
- [ ] *Attending*: "own vehicle = No" shows transportation-assistance options; "Yes" shows vehicle types
- [ ] "Coming from" counter shows `x / 120`; accessibility counter `x / 255`
- [ ] Selecting a 5th dish is blocked with "You can select up to 4 dishes."
- [ ] Dietary "Yes" requires the "Please specify" field
- [ ] `Pedro Reyes` (0 allowed) never sees the additional-guest question
- [ ] `Juan Dela Cruz` (1 allowed) gets one guest field and no "+" button
- [ ] `Ana Villanueva` (3 allowed) can add up to 3 guests; empty/duplicate names are rejected
- [ ] Give an invitation included guests in admin → search that name → the names appear on the invitation card and at the top of the form
- [ ] The last question for attending guests is the optional message to the couple (500 characters) → it shows on the dashboard and in the response
- [ ] *Confirm My Response* opens *Are you sure?*; *Cancel* saves nothing; *Confirm Response* shows "Saving your RSVP..." then the success page
- [ ] Searching the same name again shows "We already have your RSVP"; submitting again **updates** (Responses page still shows one row, with a new *Updated* time)

**Admin**
- [ ] `/#/admin` while logged out redirects to `/#/admin/login`
- [ ] Wrong password → friendly error; correct → dashboard
- [ ] A user who exists in Auth but not in `admin_users` is refused
- [ ] Dashboard numbers match the data; charts render on desktop and phone
- [ ] Add / edit / delete invitation (delete warns and removes its RSVP + guests)
- [ ] Changing a table number or allowed guests is reflected on the RSVP page immediately
- [ ] Delete a response → invitation shows *Pending* again
- [ ] Change an additional guest to Approved → *Expected Attendees* increases
- [ ] Edit settings/sections, reorder, hide, upload a hero image, save → home page reflects it
- [ ] *Export RSVP Data* downloads a CSV that opens in Excel/Google Sheets
- [ ] Logout returns to the login page

**Security** — open the browser console on the public site (logged out) and run:

```js
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
const sb = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY')
console.log(await sb.from('invitations').select('*'))          // expect an error (permission denied)
console.log(await sb.from('rsvp_responses').select('*'))       // expect an error
console.log(await sb.from('additional_guests').select('*'))    // expect an error
console.log(await sb.from('admin_activity_logs').select('*'))  // expect an error
console.log(await sb.from('invitations').insert({ invitee_name: 'Hacker' }))       // expect an error
console.log(await sb.from('wedding_settings').update({ couple_names: 'x' }).neq('id', '00000000-0000-0000-0000-000000000000')) // expect an error
console.log(await sb.rpc('find_invitation', { search_name: 'Juan' }))  // expect data: [] (no partial matches)
```

Also check **Supabase → Advisors → Security Advisor** shows no RLS warnings for these tables.

---

## 11. Production launch checklist

1. **Remove seed data** (SQL Editor):
   ```sql
   delete from public.invitations where invitation_code like 'sample-%';
   ```
   (Their RSVPs and additional guests are removed automatically.) Confirm with `select count(*) from public.invitations;`.
2. **Add real invitations** — *Admin → Invitations → Add Invitation*. Use each guest's full name exactly as they'll type it; set table and allowed additional guests. Two *active* invitations cannot share the same name — add a detail, e.g. "Maria Santos (Tita)".
3. **Set wedding information** — *Admin → Website Settings*: names, date, texts, church/reception names and map links, information sections.
4. **Upload the final hero image** — *Website Settings → Hero image → Upload image* → *Save changes*. (Landscape, ≥ 2000 px wide, under 10 MB.)
5. **Test an RSVP** end-to-end on a phone with a real invitation, then delete that test response in *Responses*.
6. **Test admin login/logout**, and that sign-ups are disabled in Supabase Auth.
7. **Verify RLS** with the console snippet in [section 10](#10-testing-checklist) and the Supabase Security Advisor.
8. Confirm the GitHub secrets are set and the latest *Actions* run is green; open the live URL in a private window.
9. Share `https://<user>.github.io/<repo>/` (or your domain) with guests.

---

## 12. Project structure

```
├── .github/workflows/deploy.yml    GitHub Pages build & deploy
├── supabase/
│   ├── schema.sql                  tables, RLS, policies, RPCs, triggers, storage, defaults
│   └── seed.sql                    sample invitations (testing only)
├── public/favicon.svg
├── index.html
├── src/
│   ├── App.tsx                     routes (HashRouter), lazy-loaded admin
│   ├── main.tsx, index.css         entry + Tailwind theme (ivory / charcoal / champagne)
│   ├── components/
│   │   ├── wedding/                Hero, Introduction, Venues, InfoSections, RSVPCallout, Footer…
│   │   ├── rsvp/                   SearchForm, InvitationFound, EnvelopeAnimation, RSVPForm, SuccessState
│   │   ├── admin/                  AuthProvider, ProtectedRoute, StatCard, BarChartCard, modals…
│   │   └── ui/                     Button, Modal, ConfirmDialog, fields, Choice cards, Toasts, ResponsiveTable…
│   ├── pages/                      Home, RSVP, AdminLogin, AdminDashboard, AdminInvitations,
│   │                               AdminResponses, AdminGuests, AdminSettings, NotFound
│   ├── layouts/AdminLayout.tsx     sidebar / mobile menu, loads admin data once
│   ├── lib/supabase.ts             Supabase client (anon key only)
│   ├── services/                   invitationService, rsvpService, adminService, settingsService, analyticsService
│   ├── hooks/                      useAuth, useInvitation, useWeddingSettings, useAdminData, useToast
│   ├── types/                      database.ts (row types), wedding.ts, rsvp.ts
│   └── utils/                      validation.ts, formatting.ts, csvExport.ts, errors.ts
├── vite.config.ts, tsconfig*.json, eslint.config.js
├── package.json
├── .env.example
└── .gitignore
```

To regenerate `src/types/database.ts` after changing the schema:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
```

(then re-add the `Tables` / `TablesInsert` / `TablesUpdate` helper exports at the bottom if the generator's version differs).

---

## 13. Troubleshooting

| Symptom | Fix |
|---|---|
| "Almost ready" page | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing — add to `.env.local` (local) or GitHub secrets (deploy), then rebuild. |
| Home shows "Something went wrong" | `schema.sql` wasn't run, or the URL/key is wrong. Check the browser console (dev mode logs the technical error). |
| Login says "does not have administrator access" | Run the `insert into public.admin_users …` statement for that email. |
| "An active invitation with this name already exists" | Names must be unique among active invitations so search is unambiguous. Add a detail to one name. |
| Hero upload fails | Check the `wedding-assets` bucket exists and is public, and re-run `schema.sql` to (re)create the storage policies. |
| Blank page on GitHub Pages | Make sure *Settings → Pages → Source* is **GitHub Actions** and the workflow succeeded. |
