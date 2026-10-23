# SaaS Launch Motion Skill

Build a coherent product story before writing animation code. The standard output is a 30-second, 1920 × 1080 film at 60 frames per second. Use the approved storyboard and actual product assets as the source of truth.

## 1. Story first
Follow the approved sequence: attention, problem, product solution, payoff. Give every scene one focal point. Remove any element that does not support that scene's job. Do not invent extra scenes, reorder the storyboard, or replace a specific product action with decorative UI.

## 2. Timing and readability
Keep important copy or UI states readable for approximately 1.5 seconds after their entrance. Use a one-second count-up or count-down when the number carries the story. Do not jump to the final value in one frame. Keep the final logo and CTA readable for at least 2.5 seconds.

## 3. Group related elements
Treat each screen or group like an After Effects parent/null. Move the parent to control composition and camera framing; animate the children only for local emphasis. Use a stable 1920 × 1080 canvas, and calculate positions from its center. Do not use changing browser edges as anchors.

## 4. Stagger and overlap
Offset related child entrances by 3–4 frames. Start the next group movement before the previous movement has completely settled. Use short overlaps between scenes so the motion flows continuously. Maintain subtle background or camera movement during readable holds; readable does not mean frozen.

## 5. Easing and interaction
Avoid linear motion. Use a softly eased entrance of roughly half a second with restrained overshoot, then a faster exit. Camera pans need gentle acceleration and deceleration. The cursor travels along an arc, hesitates when the story calls for it, and compresses a button slightly on click. Use small interaction cues, not bouncy effects on every object.

## 6. Agent-card behavior
Bring agent cards in one at a time. Each card must land before its checkmark appears. Add one small pulse when an agent begins working. Cascade status changes down the list instead of showing every checkmark on the same frame.

## 7. Fonts and vector UI
Load the exact brand fonts and wait for readiness before rendering frame zero. Abort with a useful error if a required font is unavailable. Use SVG UI exports and preserve sharp vectors when zooming. Never substitute a screenshot for a source SVG or silently accept Times New Roman as a fallback.

## 8. Framing and output
Render exactly 1,800 frames for 30 seconds at 60 fps. Define title-safe margins of 96 pixels horizontally and 54 pixels vertically for the master. Also plan the 9:16 and 1:1 reframes; keep the primary focal point within a centered protected region, and recompose crowded scenes for vertical rather than cropping blindly.
