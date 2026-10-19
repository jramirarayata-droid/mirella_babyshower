# Baby Shower Website & RSVP

The baby shower website, RSVP system and private admin dashboard for **Juan & Maria Santos · Baby Santos** (test details — change them in Admin → Website Settings).

This is a separate project. It has its own repository, its own Supabase project ("Mir and Ella Babyshower") and its own Cloudflare Worker (`mirella-babyshower`). It shares no database, storage or guest data with the wedding website.

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Framer Motion, Lucide icons
- **Backend:** Supabase (PostgreSQL with Row Level Security, RPC functions, Auth and Storage)
- **Hosting:** Cloudflare Workers (static assets), built by Workers Builds from `main`

```
Cloudflare Worker "mirella-babyshower" (static React build)
        │
        ├── Public website   (/  /#/rsvp  /#/registry  /#/predict  /#/names)
        ├── Big screen       (/#/show/reveal  /#/show/predictions  /#/show/names  /#/present)
        └── Admin            (/#/admin …)
                 │
                 ▼
     Supabase "Mir and Ella Babyshower": database (RLS), Auth, Storage
```

Every RSVP, invitation and setting is stored in Supabase. The browser stores only small conveniences, such as the guest's own name pass.

---

## What's included

**For guests**
- A home page in pastel baby looks: Clouds, Balloons, Boho Rainbow, Sweet Greenery, Little Blossom, Twinkle Little Star and Hello Sunshine.
- It shows the countdown, the arrival month, the venue, the program, a Bible verse, "Good to know" sections, the bump gallery and video, and What to Wear.
- RSVP by name or a personal invitation link, plus a virtual invitation with an envelope.
- **Gift wishlist:** guests tap "I'll bring this" so nothing is doubled. Only the parents-to-be see who is bringing what, and the database stops two guests from taking the last item.
- **Gender reveal:** a countdown, then the answer with balloons and confetti. The database does not send the answer before the reveal time, so it cannot be found early in the page.
- **Baby predictions:** guests guess the birthday, the weight, and boy or girl. The closest guesses are named after the birth.
- **Name ideas:** guests suggest names, shown as a word cloud.
- Guest photos with a live slideshow, the diaper raffle and bingo, and an offline mode.

**For the hosts (admin)**
- Dashboard, guests and invitations, responses, and "Wishes for the baby".
- Shower fun: Gift Registry, Gender Reveal (the answer stays masked on screen), Predictions, Name Ideas, and Raffle & Bingo.
- Website Settings: parents' and baby's names, the shower date, the due date, the venue, the program and the verse.
- Look & Feel: themes and website looks.
- Printables: invitations, gift envelope, What to Wear, thank-you cards, name cards, table names and leaflets.
- Seating: available but off by default.

**Big screen.** Open the website on a laptop connected to the TV. Choose Menu → Host mode, or sign in as admin. Then open the reveal, predictions, names or guest-photo screens.

---

## Setup

### 1. Supabase (the baby shower project only)

1. Open the **Mir and Ella Babyshower** project, then go to **SQL Editor**.
2. Run `supabase/schema.sql`.
3. Run every file in `supabase/migrations/` in number order, from `002_…` to `045_name_suggestions.sql`. The shower features are in `041`–`045`:
   - `041`: baby name and due date.
   - `042`: gift wishlist and guest pass.
   - `043`: gender reveal.
   - `044`: baby predictions.
   - `045`: name ideas.

   The scripts are safe to run again.
4. **For testing only:** run `supabase/seed.sql`. It adds 40 made-up invitations (codes start with `sample-`), a few test replies and a starter wishlist. The bottom of that file has the statements that remove them before launch.
5. **Authentication → Sign In / Providers:** keep the Email provider on and turn **Allow new users to sign up** off.

### 2. Admin account

The admin password is never stored in the code; Supabase Auth keeps it.

1. Go to **Authentication → Users → Add user**, enter the email and password, and tick **Auto Confirm User**.
2. Give that user admin rights. In the SQL Editor, run the following with your email:

   ```sql
   insert into public.admin_users (user_id, email)
   select id, email from auth.users where email = 'you@example.com';
   ```

3. Open `/#/admin/login` and sign in.

### 3. Cloudflare Worker

1. In Cloudflare, go to **Workers & Pages → mirella-babyshower → Settings → Build**. Connect this repository and set the production branch to `main`.
2. Under **Build → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase → Project Settings → API. The anon key is public by design; never use the service-role key here.
3. Branches other than `main` get preview URLs when non-production builds are on.

### 4. GitHub

- Under **Settings → Secrets and variables → Actions → Variables**, set `SITE_URL` to the site's address. The link check and speed check use it.
- Optional: set the `CF_DEPLOY_HOOK` secret (a Cloudflare deploy hook URL) so the daily rebuild refreshes the link preview.

Keep keys and passwords out of the code, commits and chat. `.env` is git-ignored; `.env.example` lists the names only.

---

## Local development

```bash
cp .env.example .env   # then fill in the two values
npm ci
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm run lint
```

If the environment variables are missing, the site shows a friendly "Almost ready" notice instead of crashing.

### Browser tests

The tests in `tests/e2e/` run against a built site with a **mocked** backend, so nothing live is touched. For example:

```bash
npm run build && npm run preview -- --port 4173 &
node tests/e2e/shower.mjs http://localhost:4173/ /tmp/shots
```

Other suites: `invitations`, `printables`, `looks`, `media`, `program`, `raffle`, `seating`, `drive`, `resilience` and `admin-polish`.

---

## Security model

- Guests (`anon`) have no direct table access except public website content. They act only through `security definer` RPC functions, such as `find_invitation`, `submit_rsvp`, `registry_claim`, `prediction_save` and `name_idea_add`. Each function checks its input on the server.
- Wishlist, predictions and name ideas use a **guest pass**: the guest types their name as it appears on their invitation and gets a private token. Guests never see who else is bringing what, and other guests see only a first name and initial.
- The gender-reveal answer can be read only by an admin until the reveal time. A host can reveal it early from the big screen.
- Admin access needs a signed-in user listed in `admin_users`. Every RLS policy checks this through `is_admin()`; the admin route guard in the app is only a convenience.
- Some internal names come from the original project, such as the `wedding_settings` table and the `groom`/`bride` side values (shown as Dad's side and Mom's side). Guests never see them.

---

## Project structure

```
src/
  pages/              public pages, admin pages, Registry/Predictions/NameIdeas/ShowerScreen
  components/
    wedding/          home page sections (hero, details, venue, program, gallery…)
    wedding/looks/    the baby looks' artwork (clouds, balloons, rainbow, stars)
    shower/           gender reveal, shower activity cards, name cloud, guest pass
    admin/            admin building blocks
    printables/       print editor pieces
  services/           Supabase calls (showerService.ts for the shower features)
  theme/              themes and looks
  utils/              formatting, printables, addressing…
supabase/
  schema.sql          base tables, RLS and functions
  migrations/         002–045, run in order
  seed.sql            test data (remove before launch)
tests/e2e/            browser tests with a mocked backend
```
