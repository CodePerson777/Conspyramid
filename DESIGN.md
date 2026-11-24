# Conspyramid — Game Design Doc

> Aliens built the pyramids. Now they're fighting over who builds the tallest one.

A silly, cartoony mobile PvP game. Two aliens race to build the taller pyramid while abducting and blasting blocks off each other's.

## Pillars
- **Short battles:** every match is 2–3 minutes.
- **Hands-on:** you place every block yourself, and blocks are hard to get.
- **Pyramids can't tip over:** you remove blocks from the top and the outer edges only.
- **Silly and lo-fi:** cartoony, low-detail graphics, goofy aliens, conspiracy jokes.

## Game structure
| Mode | What it is | Feeds into |
|------|------------|------------|
| **Battle** | 1v1 real-time PvP, 2–3 min | Earns resources |
| **Home base** | Your own safe zone with one or more pyramids; a pyramid economy and tech tree | Unlocks stronger tech for battle |

The home base and battle pyramids are **completely separate**. Home only makes you stronger through tech. Nobody can raid your home base.

---

## ⚔️ Battle

### Flow
1. Both players start with an empty foundation.
2. Collect blocks. They are **scarce and hard to get** (see below).
3. **Place blocks yourself** on your pyramid. A block needs support underneath, like a real pyramid.
4. Use alien tech to **abduct or blast** exposed blocks off the opponent's pyramid.
5. When time runs out, the **tallest pyramid wins** (tie-breaker: most blocks).

### Exposed blocks
A block can only be targeted if it's on the **top layer** or on an **outer edge**. Inner blocks are protected until the outside is stripped away, so the outer layer works as armor.

### Getting blocks (needs to feel hard)
Ideas to test:
- Blocks appear at random spots in a shared middle zone. You have to grab them before your opponent does.
- A beam takes time to pull a block in, and the opponent can interrupt it.
- Rare "golden" blocks are worth more height or defense.
- Abducting a block from the opponent's pyramid gives you that block.

### Battle tech (unlocked at home)
- 🛸 **Abduction Beam:** steal an exposed block and add it to your stash.
- 💥 **Plasma Blast:** destroy a few exposed blocks. You don't get them.
- 🧲 **Magnet Pulse:** pull a whole row off one side.
- 🛡️ **Shield Dome:** protect your top layer for a few seconds.
- 🧱 **Reinforced Blocks:** take two hits to remove.
- 🏆 **Golden Capstone:** a big bonus if you finish a complete peak.

Battle tech runs on **energy**, which builds up during the match.

---

## 🏠 Home base (safe zone)
- Your own plot of desert or planet. Build **one or many pyramids** at your own pace.
- **Pyramid economy:** pyramids produce resources over time.
  - **Power Pyramid:** makes energy.
  - **Lab Pyramid:** researches tech.
  - **Hangar Pyramid:** builds UFOs and upgrades.
- **Tech tree:** spend resources to unlock and upgrade battle tech, faster beams, stronger blocks and new factions.
- **Cosmetics:** pyramid skins, alien outfits, base decorations.

### Resources
- **Stone:** basic building material at home.
- **Energy:** powers tech.
- **Crystals:** rare, won mainly in battles, used for unlocks.

---

## Alien factions (later)
- **Greys:** balanced, strong abduction beam.
- **Reptilians:** slow, sturdy blocks.
- **Blobs:** bouncy blocks that resist blasts.
- **Robots:** fast builders, fragile blocks.

## Theme and style
- Cartoony and lo-fi: simple shapes, bright colors, wobbly aliens.
- Arenas: Giza, Area 51, Atlantis, the Moon.
- Conspiracy jokes: tinfoil hats, "the truth is out there" loading screens.

## Open questions
- What platform and engine (phone browser? Godot? Unity?)
- How does matchmaking work? (Start with local or bot battles.)
- How exactly are blocks collected in battle? (Prototype and test.)
- How does the opponent's pyramid show on a phone screen (split screen? side by side?)

## Build plan
1. **Prototype:** a single-screen battle against a dumb bot, with placing blocks and abducting.
2. Add energy and 2–3 tech moves.
3. Real 1v1 multiplayer.
4. Home base and tech tree.
5. Polish, factions and cosmetics.
