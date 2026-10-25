# Instagram carousel

Two concepts, each in 3:4 (1080 × 1440, the profile-grid size, organic posts) and 4:5 (1080 × 1350, ads).
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
