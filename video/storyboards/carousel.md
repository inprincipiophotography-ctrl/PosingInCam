# Instagram carousel

Three concepts, each in 3:4 (1080 × 1440, the profile-grid size, organic posts) and 4:5 (1080 × 1350, ads).
- **Code:** `src/carousel/`. `kit.tsx` holds the slide frame and the blocks; `ConceptA.tsx` and `ConceptB.tsx` the slides; `data.ts` the five cards' words.
- **Render:** `node scripts/carousel.mjs [A|B]` → `renders/carousel/<concept>-<ratio>/NN.jpg` plus a contact sheet per set.
- **Captions:** `carousel/captions.md`.

What the research says works, and how it's used:
- **Slide 1 decides the swipe.** A is a bold promise (5 poses, the words to say) over the real cards. B is the pain.
- **Slide 2 hooks again**, because Instagram re-shows a carousel from slide 2 to people who didn't swipe.
- **One idea per slide**, short lines, big type.
- **Saves are the strongest signal**, so A gives real, savable value: five real poses with the words, settings and hack, copied word for word from the cards. "Save this" appears on the last slide.
- **A red rule runs off the right edge of every slide into the next**, pulling the eye on. The last slide ends it with a dot.
- **The CTA gives two ways in:** comment POSE (DM) or the link in bio. Plus the free first card and the founders.

**A: "5 poses that work on every couple"** (10 slides)
1. Hook and the fan of five cards.
2. "The pose isn't the hard part. The words are." with the card's "Say to the couple" box.
3–7. The First Look · Dance and Spin · Editorial 1/1 · Under the Veil · Vogue: the card, energy, camera, the hack, and the words as a quote.
8. "Now imagine them all in your camera" (DSC08438).
9. Three steps, Kim & Ivan, Sony · Canon · Nikon.
10. Free first card, comment POSE / link in bio, save this.

**B: "Your mind goes blank"** (7 slides)
1. The couple waiting (a still from the wedding take): "Your couple is waiting. Your mind goes blank."
2. The phone, struck through.
3. "What if the next pose was already in your camera?"
4. The Editorial card with its four parts called out.
5. Three steps, with three real cards on the camera.
6. The fan: every pose for the whole day, plus Kim & Ivan.
7. The close (as A10).

**C: "Never look unprepared in front of a couple again"** (12 slides; the one to post first). Problem solving for the whole day, not just posing, and the reassurance of looking professional.
1. "For wedding photographers", the headline, and the real thing, upright and whole: DSC08435 cropped tight from the full-size original (`public/carousel/hook-camera.jpg`): a hand on the camera, thumb on the dial, The First Look on the screen, its edges fading into the paper. The line "Poses · timeline · family groups · shot list. On your camera." sits under the headline. "Poses, timeline, family groups, shot list. All on the camera already in your hand."
2. "The wedding day, the old way:" Pinterest, a PDF, the planner, a notes app, each struck through. Then "All on your phone, in front of your couple. It looks like you don't know what's next."
3. "Now it's all on your camera screen. Faster, calmer, more professional.": the pose card next to the timeline, groups and shot-list cards.
4. Mid-shoot: "Glance down. Swipe. Shoot." over a frame from the real wedding take (the card on the camera, the couple waiting).
5. Poses, with the words to say (the card's four parts).
6. The timeline, one swipe away.
7. Family groups, in order.
8. The must-haves, covered (shot list).
9. Any image: "If it's an image, it's in your camera." Her Pinterest pins, a moodboard, Canva designs, screenshots. JPG · PNG · WEBP · HEIC, up to 30 at once (the site's "Any image" / "Her board").
10. Be ready for anything: "Better prepared than sorry." The couple freezes, the day runs late, "Did we get Grandma?", she shows you her Pinterest: each with the card that already has the answer.
11. Three steps, with three real cards on the camera.
12. The close.

The timeline, groups and shot-list cards are drawn by the site's own renderer (`scripts/render-cards.mjs`) with the /demo page's sample couple, Emma & James. The board pins are `assets/showcase/pin-0x.jpg`, In Principio's own photos.

**C as a Meta ad (`Cad`, v2: 8 cards, 4:5 only; `src/carousel/ConceptCAd.tsx`).** Runs as an ad from the In Principio Weddings page, not as a post on its profile, because its followers are couples. After feedback it leads with what's new rather than fear, puts Sony · Canon · Nikon on the first card and "we use it at every wedding we shoot" on the second, and sets the small type 25 % bigger (the `TextScale` context in `kit.tsx`) so it reads on a phone, where a 1080 px card is ~390 pt wide.
1. "New · for wedding photographers": "Your wedding day plan, now inside your camera.", Sony · Canon · Nikon chips, the camera with the thumb (DSC08435).
2. "We use it at every wedding we shoot.": the over-the-shoulder frame from our own wedding, Kim & Ivan, "The couple never sees a phone."
3. "Everything for the day, one swipe away.": the pose card with the timeline, groups and shot-list cards. "Faster, calmer, more professional."
4. Poses, with the words to say (the card's four parts).
5. "Your timeline and groups, in order.": "No PDF. No asking the planner who's next."
6. "Her Pinterest board, on your camera.": any image shows up in playback.
7. Three steps, zero phone. Sony · Canon · Nikon · no account.
8. "Your first card is free.", cards.notalucis.com big, Kim & Ivan, "Tap Learn more below".

The address is on every card's footer (the `ShowUrl` context). Ad copy, per-card headlines and settings: `carousel/ad-copy.md`. Download: `renders/carousel/Shoot-Cards-carousel-C-ad.zip`.
