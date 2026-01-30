# HOLLOW — Master Design Document

**Version**: 0.1.1
**Updated**: 2026-01-30
**Status**: MVP Build Phase

## PROJECT IDENTITY

**Name**: HOLLOW
**Genre**: Co-op Survival / Wave Defense
**Platform**: Browser (Desktop + Mobile)
**Player Count**: 2 (Mandatory Co-op)
**Architecture**: Local-first, LAN-ready

## CORE PILLARS

1. **Two Players Always** — No solo mode. Co-op is mandatory.
1. **Shared Stakes** — One base, shared survival, coordinated rescue
1. **Escalating Pressure** — Waves ramp forever, hunger drains constantly
1. **Local-First Execution** — Single authoritative state, message-based input
1. **LAN-Ready Architecture** — Input/state schemas designed for network transport

## GAME LOOP

Setup → Spawn P1 + P2 at base → Wave timer starts
Survive → Fight enemies, gather food, manage hunger
Rescue → Revive downed teammates before bleed-out
Defend → Protect base from enemy attacks
Escalate → Waves get harder, spawn faster, more enemies
Fail → Both players down OR base destroyed → Restart

## CORE SYSTEMS

### PLAYERS

- Health: 100 HP (starts full)
- Hunger: 100% (drains 2.5% per second)
- Movement: WASD / Arrows, 270 units/s
- Attack: Short-range shove (84 units), knockback enemies
- Down State: 0 HP or 0 hunger → cannot move/attack
- Revive: Hold attack 2.75s within 75 units
  - Interrupt: Reviver takes damage or moves away
  - Restore: 35 HP + 25% hunger + 2s invulnerability
- Bleed-Out: Both down → 8s timer → game over

### BASE

- Health: 500 HP
- Zone: 420 unit visible ring (not a safe zone)
- Damage: Enemies deal 14 dmg on contact (72 unit range)
- Behavior: Enemies inside zone commit to attacking base

### ENEMIES

- AI: Wander → Aggro → Chase → Attack
- Aggro Range: 480 units to players
- Chase Speed: 228 units/s
- Attack: Range 84, Windup 0.3s, Cooldown 0.9s, Damage 8/14
- Knockback: Player attacks interrupt enemy attacks

### WAVES (v0.1.1)

- Spawn Timer: 30s → 5s (decreased by 1.2 per wave)
- Enemy Count: 3 → 20 (increased by 0.9 per wave)
- Formula: timer = max(5, 30 - wave * 1.2)
- Formula: count = min(20, 3 + floor(wave * 0.9))
- Ceiling: Wave 25 (5s timer, 20 enemies)

### FOOD PICKUPS

- Spawn: Every 8s at random positions
- Pickup: Auto-collect within 90 units
- Restore: +35% hunger
- Visual: Pulsing glow

## FAILURE CONDITIONS

1. Base health reaches 0 → Immediate game over
1. Both players down for 8s → Bleedout game over

## VISUAL STYLE

- Top-down 2D arena
- Geometric shapes with gradients
- Smooth animations (particles, screen shake, lerp)
- Grid background
- Color-coded: P1 blue, P2 green, enemies red, base orange, food orange

## TECHNICAL CONSTRAINTS

- Single repository, no external libraries
- Pure JavaScript/CSS, no build tools
- Fixed 60Hz timestep
- Host-authoritative state
- Message-based input (LAN-ready)

## DESIGN PHILOSOPHY

## **Co-op First**: No solo mode

**Tension Through Scarcity**: Hunger + waves = pressure
**Rescue Mechanics**: Revive system prevents instant loss
**Infinite Escalation**: Waves ramp until failure (v0.1.1: ceiling at wave 25)
**Local-First, Network-Ready**: Architecture prepared for LAN
