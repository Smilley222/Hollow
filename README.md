# HOLLOW

**Co-op survival wave defense. Two players. One base. Escalating pressure.**

## Quick Start

1. Open `index.html` in any modern browser
1. Desktop: P1 uses WASD + F, P2 uses Arrow Keys + RShift
1. Mobile: Use on-screen controls, tap swap to switch players
1. Survive waves, gather food, revive teammates, protect base

## Controls

**Desktop**

- P1: WASD (move) + F (attack)
- P2: Arrow Keys (move) + Right Shift (attack)

**Mobile**

- On-screen joystick + attack button
- Swap button toggles P1/P2 control
- Non-controlled player auto-follows

**Debug**

- Press ` to toggle debug overlay

## How to Play

**Objective**: Survive as long as possible.

**Mechanics**:

- Hunger drains 2.5%/s
- Food pickups restore 35% hunger
- Enemies spawn in waves (increasing count + speed)
- Attack to shove enemies (knockback + damage)
- Revive downed teammates (hold attack 2.75s)
- Both down = 8s bleedout timer

**Lose When**:

- Base health reaches 0, OR
- Both players down for 8 seconds

## Game Stats

- Player HP: 100
- Player Hunger: 100% → 0% (2.5%/s drain)
- Base HP: 500
- Enemy Damage: 8 (players) / 14 (base)
- Revive: 35 HP + 25% hunger + 2s invuln
- Waves: Ramp to 20 enemies, 5s spawn timer (v0.1.1)

## GitHub Pages Deployment

```bash
# Enable GitHub Pages:
# Settings → Pages → Source: main branch → Save
# Your game will be at: https://[username].github.io/hollow/
```

## Development

**Version**: v0.1.1
**Status**: Local Co-op MVP
**Next**: LAN Transport Layer

## Built with zero dependencies. Runs anywhere.
