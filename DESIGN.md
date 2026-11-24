# Conspyramid — Game Design Doc

> Aliens built the pyramids. Now they're fighting over who builds the tallest one.

A silly, cartoony mobile PvP game. You're an alien commander. Send your troops to grab stone from the middle, fight the enemy's troops, and build the taller pyramid. Every so often, cast a sneaky special ability yourself.

## Pillars
- **Short battles:** every match is 2–3 minutes.
- **Command, don't micromanage:** troops do the work, and you decide who to send. Special abilities are your hands-on moments.
- **Pyramids can't tip over:** you remove blocks from the top and the outer edges only.
- **Horizontal (landscape) screen:** your pyramid on the left, theirs on the right, the quarry in the middle.
- **Silly and lo-fi:** cartoony, low-detail graphics, goofy aliens, conspiracy jokes.

## Game structure
| Mode | What it is | Feeds into |
|------|------------|------------|
| **Battle** | 1v1 real-time PvP, 2–3 min | Earns resources |
| **Home base** | Your own safe zone with one or more pyramids; a pyramid economy and tech tree | Unlocks troops and abilities for battle |

The home base and battle pyramids are **completely separate**. Home only makes you stronger through unlocks. Nobody can raid your home base.

---

## ⚔️ Battle

### Layout (landscape)
```
[ YOUR PYRAMID ] ---- ground lane ---- [ QUARRY ] ---- ground lane ---- [ ENEMY PYRAMID ]
       🛸                  sky: UFOs fly over everything                        🛸
```

### Currencies
| Currency | How you get it | Spent on |
|----------|----------------|----------|
| 🧱 **Stone** | Troops carry it back from the quarry, or steal it | Building your pyramid (and maybe deploying troops; see open questions) |
| 🔮 **Mana** | Fills up slowly over time | Deploying troops and casting special abilities |

### Troops
| Troop | Speed | Carries | Fights? | Role |
|-------|-------|---------|---------|------|
| 👽 **Martian** (regular green guy) | Medium | 1 stone | Yes, at the quarry | The all-rounder. Walks to the quarry, grabs stone, fights enemies there, walks back. |
| 🥷 **Sneaky** | Fast | 1 stone | No | Slips past enemy aliens without being attacked. Weak if caught by a UFO or ability. |
| 🦍 **Big Guy** | Very slow | Lots (around 5) | No | Brings back a pile of stone, but enemies can beat him up and **take his stone**. Needs escorts. |
| 🚀 **Battleship** (flying) | Medium | Nothing | Yes, only fights | Flies over the field and shoots enemy troops. Doesn't gather. |
| 🛸 **Saucer** (special UFO pilot) | Fast, flying | 1–2 stone | No | Flies around collecting stone. It's the ship that casts **special abilities**. |

### Rock-paper-scissors
- Martians beat Sneakies and Big Guys in a fight.
- Sneakies get past Martians.
- Battleships wreck Martians and can catch Sneakies.
- Big Guys are a juicy target, so protect them or lose a big haul.

### Special abilities (cast with mana, from your Saucer)
- 🛸 **Abduct:** beam up an enemy troop (and the stone it's carrying), or an exposed block from their pyramid.
- 💥 **Explode:** blow up a group of enemy troops, or exposed blocks on their pyramid.
- More later: shield, meteor, cow drop, wormhole.

### Pyramid rules
- Blocks can only be removed if they're **exposed**, meaning nothing is resting on them (the top and outer surface).
- **Win:** the tallest pyramid when time runs out (tie-breaker: most blocks).

### Spicy extras (to try later)
- **Overtime:** last 30 seconds, mana fills twice as fast.
- **Random events:** sandstorm, golden stone rain, a lost tourist.
- **Capstone race:** finishing a full peak gives a big bonus.

---

## 🏠 Home base (safe zone)
- Your own plot of desert or planet. Build **one or many pyramids** at your own pace.
- **Pyramid economy:** pyramids produce resources over time.
  - **Power Pyramid:** makes energy.
  - **Lab Pyramid:** researches tech.
  - **Hangar Pyramid:** builds UFOs and upgrades.
- **Tech tree:** unlock and upgrade troops and special abilities.
- **Loadout:** choose which troops and abilities to bring into each battle.
- **Cosmetics:** pyramid skins, alien outfits, base decorations.

## Theme and style
- Cartoony and lo-fi: simple shapes, bright colors, wobbly aliens.
- Arenas: Giza, Area 51, Atlantis, the Moon.
- Conspiracy jokes: tinfoil hats, "the truth is out there" loading screens.

## Open questions
- **What do troops cost: mana, stone, or both?** (Stone costs would make you choose between building and a bigger army.)
- **Is building automatic** when stone gets home, or do you choose where blocks go?
- **How do you deploy troops?** Tap a card to spawn at your pyramid?
- **Saucer:** do you get one at the start, or deploy them like other troops?
- Matchmaking (start with bot battles).

## Build plan
1. ~~Prototype v1: portrait, hands-on block placing vs bot~~ (done, felt boring)
2. **Prototype v2:** landscape, troops (Martian, Sneaky, Big Guy, Battleship, Saucer), stone + mana, Abduct + Explode, vs bot.
3. Real 1v1 multiplayer.
4. Home base and tech tree.
5. Polish, more abilities, cosmetics.
