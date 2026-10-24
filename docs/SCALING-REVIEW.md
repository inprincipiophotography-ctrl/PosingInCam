# Pre-launch scaling review (Shoot Cards)

> Snimljeno 2026-10-24. Napraviti **prije početka oglašavanja**. Kockice za odrađivanje su u `LAUNCH-CHECKLIST.md` → *Prije oglašavanja (skaliranje)*.
> Stanje planova (Supabase Free, Vercel Hobby) vrijedi za taj datum; prije rada provjeriti je li se nešto promijenilo.

## Kontekst
Pitanje: ako oglašavanje upali i odjednom imamo ~5000 fotografa na stranici, od kojih se ~1000 prijavljuje, kupuje pretplatu, uploada i downloada, hoće li postojeća arhitektura (statični HTML + Python funkcije na Vercelu, Supabase Auth/DB/Storage, Stripe) to izdržati?

Pregledao sam cijeli backend (`api/*.py`, `webauth/*.py`, `converter/`, `supabase/*.sql`), tokove u `assets/app.js` i `assets/auth.js`, a stvarno stanje računa provjerio sam preko MCP-a (samo čitanje):
- **Supabase org "In Principio" → plan `free`** (projekt `In-Camera Posing`, eu-west-1). Na istoj Free organizaciji je i projekt "Wedding Manager Pro".
- **Vercel tim "In Principio's projects" → izgleda kao Hobby** (billing API vraća "Plan not found", a LAUNCH-CHECKLIST navodi da su custom eventi "na Pro planu").
- Benchmark konvertera na ovom računalu: **~0,15 s CPU-a po kartici**, kartica ima 230–620 KB (Nikon/Sony/Canon), ~190 MB RAM-a za batch od 5 kartica.

## Kratki odgovor
**Kod i arhitektura se skaliraju dobro. Ono što bi puklo su planovi i limiti na računima, i to već u prvim satima.** Statiku servira Vercelov CDN, funkcije se same skaliraju, JWT se provjerava lokalno (bez poziva na Supabase Auth po zahtjevu), a baza je sitna. Ali s današnjim postavkama scenarij ne bi radio:

| # | Što puca | Zašto | Kada |
|---|---|---|---|
| 1 | **Prijava (magic link)** | Ugrađeni Supabase SMTP šalje **samo na adrese članova tima** i najviše **~2 maila na sat**. Čak i s vlastitim SMTP-om zadani limit je 30/h. | Od prvog stranog korisnika (provjeriti je li custom SMTP već postavljen) |
| 2 | **Supabase Storage (Free: 1 GB)** | Svaki batch se trajno sprema u `cards/`, a ZIP-ovi >4 MB u `<uid>/zips/` se **nikad ne brišu**. ~2500–4000 kartica = 1 GB. | 1000 korisnika × ~20 kartica ≈ 8 GB → prvi dan |
| 3 | **Supabase egress (Free: 5 GB uncached)** | Povijest prikazuje **pune kartice kao thumbnailove**, s potpisanim URL-om koji se mijenja pri svakom `loadHistory()` (poziva se nakon svake konverzije), pa nema browser cachea. Ponovni downloadi ZIP-a isto troše egress. | Nekoliko sati vršnog prometa |
| 4 | **Vercel Hobby** | (a) **Hobby ne dopušta komercijalnu upotrebu**, a app naplaćuje pretplate. (b) ~4 h Active CPU / ~1M invokacija / 100 GB transfera mjesečno; kad se probije, **Hobby projekt se pauzira** do novog ciklusa (nema plaćanja viška). | Viralni mjesec: ~20k kartica ≈ 1,5 h CPU-a, uz sve page-load pozive i cold startove |
| 5 | **Supabase Free općenito** | Nema dnevnih backupa (a tu su podaci o plaćanjima), nema SLA-a, a pauziranje i ograničenja po quoti dijele se s drugim Free projektom u istoj organizaciji. | Odmah, kao rizik |

Ono što **neće** biti problem: statička stranica (~2 MB po posjetitelju preko CDN-a, 5000 posjetitelja ≈ 10 GB), baza (stotine KB, nekoliko jednostavnih upita po konverziji), Auth MAU (50k), Stripe (rate limit 100 req/s, webhook idempotentan preko `stripe_events`), te istovremenost na Vercelu (Fluid compute se automatski skalira).

### Procjena opterećenja za scenarij
- **Page load**: svaki posjetitelj zove `GET /api/convert` (samo da dozna `paywall/stripe` zastavice, a to podiže tešku funkciju s Pillowom), `GET /api/prices` (cold instance zove Stripe 3×) i `/api/me` + `/api/history` ako je prijavljen. 5000 posjetitelja ≈ 15–20k invokacija, bez ikakvog CDN cachea.
- **Konverzija**: ~10 sekvencijalnih HTTP poziva prema Supabaseu (profil, projekt, brojanje, N uploadova, RPC, insert), svaki s **novim TLS handshakeom** (`requests.get/post` bez `Session`). To je ~1 s latencije više po zahtjevu i nepotreban CPU.
- **CPU**: 1000 × 20 kartica × ~0,25 s (Vercel vCPU) ≈ 1,4 h. Na Pro planu to je sitniš (~0,13 $/h).
- **Request body 4,5 MB**: frontend ionako odbije >4 MB, pa realno stane ~5–10 dizajna u jedan zahtjev. Nije problem kapaciteta, nego UX-a za Pro korisnike s 30+ kartica.

### Manji problemi u kodu (pokazali bi se tek pod opterećenjem ili zlouporabom)
- **Anonimna konverzija** (1 kartica bez prijave) ima samo per-instance rate limit u memoriji (`api/convert.py:88-118`). Distribuirani bot može spaliti CPU quotu, a na Hobbyju to znači pauziran site.
- **Spajanje ZIP-a projekta** skida kartice **sekvencijalno** (`api/history.py:_download_project`), a Supabase Free ima limit od **50 MB po datoteci**, pa ZIP veći od ~120 kartica neće proći kroz `zip_link`.
- **Race u naplati**: `decide()` čita profil prije konverzije, a `consume()` troši tek poslije. Dva paralelna zahtjeva istog korisnika mogu potrošiti iste kredite (`spend_credits` samo radi `greatest(0, …)`). Mala šteta, ali vrijedi znati.
- Advisor: nedostaje indeks na `projects.user_id`. RLS upozorenja nisu bitna jer server koristi service role, a klijent tablice ne čita direktno.
- `assets/showcase/` ima ~100 MB nereferenciranih DSC*.jpg / .mov datoteka koje su javno deployane (nisu u `.vercelignore`) i mogu se hotlinkati.

## Preporučeni plan

### Faza 0: računi i postavke (bez koda, OBAVEZNO prije oglasa)
1. **Supabase → Auth → SMTP**: postaviti vlastiti SMTP (npr. Resend, Postmark ili Amazon SES; besplatni Resend ima samo 100/dan, pa treba plaćeni plan), pa u **Auth → Rate Limits** podići "emails per hour" (npr. 1000+). Provjeriti SPF/DKIM za domenu pošiljatelja.
2. **Supabase org → Pro** ($25/mj; 100 GB storage, 250 GB egress, dnevni backupi, nema pauziranja, upload limit do 500 GB). Uključiti spend cap ili alerte. Razmisliti o premještanju projekta u zasebnu organizaciju da ne dijeli plan s Wedding Managerom.
3. **Vercel → Pro** ($20/mj): komercijalna upotreba, veće kvote, plaćanje viška umjesto pauziranja. Postaviti **Spend Management** alert.
4. **Vercel Firewall**: rate-limit pravilo na `/api/convert` i `/api/history` po IP-u (npr. 30/min), uz Attack Challenge Mode spreman za slučaj napada.
5. Završiti stavke iz `LAUNCH-CHECKLIST.md` (Stripe live, rotacija ključeva).

### Faza 1: male izmjene koda za skaliranje
1. **CDN cache za javne GET-ove**: `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` na `GET /api/convert` (`api/convert.py:136-138`) i `GET /api/prices` (`api/prices.py`). Time nestaje većina page-load invokacija i Stripe poziva.
2. **Mali thumbnailovi za povijest**: u `webauth/storage.py:upload_cards` uz svaku karticu spremiti i ~400 px JPEG (`thumbs/<name>`). Za to iskoristiti postojeći `encoder._make_thumbnail(card, qtables, box)` ili napraviti Pillow `thumbnail` iz gotovog JPEG-a u `api/convert.py`. Zastavicu `thumbs: true` dodati u `extra`, a `api/history.py` neka potpisuje thumbove (stari batchevi padaju natrag na punu karticu). Egress povijesti pada ~20×.
3. **Ponovno korištenje konekcija**: jedan modulski `requests.Session()` u `webauth/auth.py`, koji koriste i `storage.py` i `billing.py` (zamijeniti `requests.get/post/patch/delete` s `_http.get/...`).
4. **Čišćenje privremenih ZIP-ova**: u `storage.zip_link` promijeniti putanju u `zips/<YYYYMMDD>/<uid>-<key>.zip` i dodati `api/cleanup.py`, Vercel Cron (dnevno, zaštićen s `CRON_SECRET`) koji preko Storage API-ja (`POST /object/list/cards` s prefixom `zips/`, pa `DELETE /object/cards`) briše mape starije od 1 dana. Registrirati ga u `vercel.json` (`crons` + `functions`).
5. **Paralelno skidanje** u `api/history.py:_download` i `_download_project`: `ThreadPoolExecutor(max_workers=6)`, isti uzorak kao `storage.upload_cards`.
6. **Migracija** `supabase/projects.sql`: `create index if not exists projects_user_idx on public.projects (user_id);`
7. (Opcionalno) **Atomarna naplata**: `spend_credits` neka vraća `boolean` (`update … where credits >= p_n returning true`), a `consume()` neka to provjeri. Prava zaštita zahtijevala bi rezervaciju prije konverzije, pa ovo ostaviti za kasnije.

### Faza 2: kad rast potvrdi potrebu
- Direktni upload dizajna u Supabase Storage preko signed upload URL-ova, da se zaobiđe limit od 4,5 MB za Pro korisnike s velikim batchevima.
- Politika zadržavanja povijesti (npr. 12 mjeseci za Pro, 30 dana za Free).
- Maknuti nereferencirane velike datoteke iz `assets/showcase/` (ili ih dodati u `.vercelignore`).

## Ključne datoteke
`api/convert.py`, `api/prices.py`, `api/history.py`, `webauth/storage.py`, `webauth/auth.py`, `webauth/billing.py`, `vercel.json`, `supabase/projects.sql`, `assets/app.js` (samo ako treba prilagoditi prikaz thumbova), novi `api/cleanup.py`.

## Verifikacija
1. Lokalno: `python -m converter.selftest` i `pytest qa/` (test_billing, test_delivery, test_encoder, test_security) moraju proći. Dodati test da `upload_cards` sprema thumb i da `history` vraća thumb URL.
2. Preview deploy na Vercelu: `curl -I https://<preview>/api/prices` dvaput → drugi odgovor ima `x-vercel-cache: HIT`.
3. Mali load test s Python skriptom (`concurrent.futures`, 200 paralelnih GET-ova na `/`, `/api/convert`, `/api/prices`, plus ~20 POST konverzija s test računom) prema previewu. Provjeriti latenciju, da nema 5xx, i pogledati Vercel runtime logove (`get_runtime_logs`).
4. Supabase: `get_advisors` (performance) nakon migracije bez `unindexed_foreign_keys`. U Storage pregledu provjeriti da `zips/` nestaje nakon crona.
5. Auth: magic link poslan na 3–4 adrese izvan tima stiže unutar minute (potvrda custom SMTP-a i rate limita).
