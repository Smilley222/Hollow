const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const FIXED_DT = 1 / 60;

const PLAYER_SPEED = 270;
const PLAYER_MAX_HP = 100;
const PLAYER_MAX_HUNGER = 100;
const HUNGER_DRAIN_RATE = 2.5;
const PLAYER_RADIUS = 15;
const PLAYER_ATTACK_RANGE = 84;
const PLAYER_ATTACK_KNOCKBACK = 150;
const PLAYER_ATTACK_DAMAGE = 28;
const PLAYER_ATTACK_COOLDOWN = 0.35;

const REVIVE_RANGE = 75;
const REVIVE_TIME = 2.75;
const REVIVE_HP = 35;
const REVIVE_HUNGER = 25;
const INVULN_TIME = 2.0;
const BLEEDOUT_TIME = 8.0;

const BASE_X = GAME_WIDTH / 2;
const BASE_Y = GAME_HEIGHT / 2;
const BASE_RADIUS = 30;
const BASE_ZONE_RADIUS = 420;
const BASE_MAX_HP = 500;
const BASE_DAMAGE_RANGE = 72;

const ENEMY_SPEED = 228;
const ENEMY_AGGRO_RANGE = 480;
const ENEMY_ATTACK_RANGE = 84;
const ENEMY_ATTACK_WINDUP = 0.3;
const ENEMY_ATTACK_COOLDOWN = 0.9;
const ENEMY_DAMAGE_PLAYER = 8;
const ENEMY_DAMAGE_BASE = 14;
const ENEMY_RADIUS = 12;
const ENEMY_HP = 100;

const FOOD_RADIUS = 10;
const FOOD_PICKUP_RANGE = 90;
const FOOD_HUNGER_RESTORE = 35;
const FOOD_SPAWN_INTERVAL = 8.0;

const WAVE_BASE_TIMER = 30.0;
const WAVE_MIN_TIMER = 5.0;
const WAVE_BASE_COUNT = 3;
const WAVE_MAX_COUNT = 20;

const isMobile =
  window.innerWidth <= 768 || window.matchMedia("(pointer: coarse)").matches;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hudWaveNumber = document.getElementById("wave-number");
const baseFill = document.getElementById("base-fill");
const p1Hunger = document.getElementById("p1-hunger");
const p2Hunger = document.getElementById("p2-hunger");
const p1Status = document.getElementById("p1-status");
const p2Status = document.getElementById("p2-status");
const bleedoutEl = document.getElementById("bleedout");
const bleedoutTimerEl = document.getElementById("bleedout-timer");
const debugEl = document.getElementById("debug");
const gameOverEl = document.getElementById("game-over");
const gameOverReasonEl = document.getElementById("game-over-reason");
const statWavesEl = document.getElementById("stat-waves");
const statKillsEl = document.getElementById("stat-kills");
const statTimeEl = document.getElementById("stat-time");
const restartButton = document.getElementById("restart");

const mobileUi = document.getElementById("mobile-ui");
const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystick-knob");
const attackButton = document.getElementById("attack");
const swapButton = document.getElementById("swap");

const inputState = {
  1: { up: false, down: false, left: false, right: false, attack: false },
  2: { up: false, down: false, left: false, right: false, attack: false },
};
const previousAttack = { 1: false, 2: false };
let inputSeq = 0;
const inputMessages = [];

const keys = new Set();
let activeMobilePid = 1;

let debugVisible = false;

let lastTime = performance.now();
let accumulator = 0;

const state = createInitialState();

if (isMobile) {
  mobileUi.classList.remove("hidden");
  swapButton.textContent = "SWAP P1";
  setupMobileControls();
}

setupKeyboard();
restartButton.addEventListener("click", () => {
  Object.assign(state, createInitialState());
  gameOverEl.classList.add("hidden");
});

requestAnimationFrame(gameLoop);

function createInitialState() {
  return {
    tick: 0,
    time: 0,
    kills: 0,
    base: { x: BASE_X, y: BASE_Y, hp: BASE_MAX_HP, radius: BASE_RADIUS },
    wave: {
      current: 0,
      nextSpawnTime: WAVE_BASE_TIMER,
      spawnCount: WAVE_BASE_COUNT,
    },
    bleedOut: { active: false, timeLeft: BLEEDOUT_TIME },
    players: [
      createPlayer(1, BASE_X - 60, BASE_Y),
      createPlayer(2, BASE_X + 60, BASE_Y),
    ],
    enemies: [],
    pickups: [],
    particles: [],
    foodTimer: FOOD_SPAWN_INTERVAL,
    screenShake: { time: 0, magnitude: 0 },
    waveFlash: 0,
    gameOver: false,
    gameOverReason: "",
  };
}

function createPlayer(pid, x, y) {
  return {
    pid,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    hp: PLAYER_MAX_HP,
    hunger: PLAYER_MAX_HUNGER,
    downed: false,
    reviving: null,
    invuln: 0,
    attackCooldown: 0,
    attackFlash: 0,
    tookDamage: false,
  };
}

function createEnemy(x, y) {
  return {
    id: Math.random().toString(36).slice(2),
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    hp: ENEMY_HP,
    state: "wander",
    target: "none",
    attackWindup: 0,
    attackCooldown: 0,
    wanderAngle: Math.random() * Math.PI * 2,
  };
}

function createPickup(x, y) {
  return {
    id: Math.random().toString(36).slice(2),
    x,
    y,
    prevX: x,
    prevY: y,
    type: "food",
    pulse: Math.random() * Math.PI * 2,
  };
}

function setupKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "`") {
      debugVisible = !debugVisible;
      debugEl.classList.toggle("hidden", !debugVisible);
      return;
    }
    keys.add(event.code);
    updateKeyboardInput();
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
    updateKeyboardInput();
  });
}

function updateKeyboardInput() {
  inputState[1].up = keys.has("KeyW");
  inputState[1].down = keys.has("KeyS");
  inputState[1].left = keys.has("KeyA");
  inputState[1].right = keys.has("KeyD");
  inputState[1].attack = keys.has("KeyF");

  inputState[2].up = keys.has("ArrowUp");
  inputState[2].down = keys.has("ArrowDown");
  inputState[2].left = keys.has("ArrowLeft");
  inputState[2].right = keys.has("ArrowRight");
  inputState[2].attack = keys.has("ShiftRight");
}

function setupMobileControls() {
  const joystickState = { active: false, id: null, x: 0, y: 0 };

  const handleStart = (event) => {
    const touch = event.changedTouches[0];
    joystickState.active = true;
    joystickState.id = touch.identifier;
    const rect = joystick.getBoundingClientRect();
    joystickState.x = rect.left + rect.width / 2;
    joystickState.y = rect.top + rect.height / 2;
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleMove = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === joystickState.id) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleEnd = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === joystickState.id) {
        joystickState.active = false;
        joystickState.id = null;
        joystickKnob.style.transform = "translate(0, 0)";
        inputState[activeMobilePid].up = false;
        inputState[activeMobilePid].down = false;
        inputState[activeMobilePid].left = false;
        inputState[activeMobilePid].right = false;
        break;
      }
    }
  };

  const updateJoystick = (x, y) => {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.min(Math.hypot(dx, dy), rect.width / 2);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * dist;
    const knobY = Math.sin(angle) * dist;
    joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    const normalizedX = knobX / (rect.width / 2);
    const normalizedY = knobY / (rect.height / 2);

    inputState[activeMobilePid].left = normalizedX < -0.3;
    inputState[activeMobilePid].right = normalizedX > 0.3;
    inputState[activeMobilePid].up = normalizedY < -0.3;
    inputState[activeMobilePid].down = normalizedY > 0.3;
  };

  joystick.addEventListener("touchstart", handleStart);
  joystick.addEventListener("touchmove", handleMove);
  joystick.addEventListener("touchend", handleEnd);
  joystick.addEventListener("touchcancel", handleEnd);

  attackButton.addEventListener("touchstart", () => {
    inputState[activeMobilePid].attack = true;
  });
  attackButton.addEventListener("touchend", () => {
    inputState[activeMobilePid].attack = false;
  });
  attackButton.addEventListener("touchcancel", () => {
    inputState[activeMobilePid].attack = false;
  });

  swapButton.addEventListener("touchstart", () => {
    activeMobilePid = activeMobilePid === 1 ? 2 : 1;
    swapButton.classList.toggle("p2", activeMobilePid === 2);
    swapButton.textContent = activeMobilePid === 1 ? "SWAP P1" : "SWAP P2";
  });
}

function gameLoop(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  accumulator += deltaTime;

  while (accumulator >= FIXED_DT) {
    updateGame(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  const alpha = accumulator / FIXED_DT;
  drawWorld(alpha);
  updateHud();

  requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
  if (state.gameOver) {
    return;
  }

  state.tick += 1;
  state.time += dt;

  state.players.forEach((player) => {
    player.prevX = player.x;
    player.prevY = player.y;
    player.tookDamage = false;
  });
  state.enemies.forEach((enemy) => {
    enemy.prevX = enemy.x;
    enemy.prevY = enemy.y;
  });
  state.pickups.forEach((pickup) => {
    pickup.prevX = pickup.x;
    pickup.prevY = pickup.y;
  });

  updateInputs();
  updatePlayers(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateWave(dt);
  updateBleedout(dt);
  updateParticles(dt);
}

function updateInputs() {
  [1, 2].forEach((pid) => {
    inputMessages.push(createInputMessage(pid, inputState[pid]));
  });
  if (inputMessages.length > 120) {
    inputMessages.splice(0, inputMessages.length - 120);
  }
}

function createInputMessage(pid, stateInput) {
  inputSeq += 1;
  return {
    seq: inputSeq,
    t: performance.now(),
    pid,
    up: stateInput.up,
    down: stateInput.down,
    left: stateInput.left,
    right: stateInput.right,
    attack: stateInput.attack,
  };
}

function updatePlayers(dt) {
  const [p1, p2] = state.players;
  const activePid = isMobile ? activeMobilePid : null;

  state.players.forEach((player) => {
    if (player.invuln > 0) {
      player.invuln = Math.max(0, player.invuln - dt);
    }
    if (player.attackCooldown > 0) {
      player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    }
    if (player.attackFlash > 0) {
      player.attackFlash = Math.max(0, player.attackFlash - dt);
    }

    if (!player.downed) {
      player.hunger = Math.max(0, player.hunger - HUNGER_DRAIN_RATE * dt);
      if (player.hunger <= 0) {
        player.hunger = 0;
        player.hp = 0;
      }
    }

    if (player.hp <= 0 || player.hunger <= 0) {
      player.downed = true;
      player.vx = 0;
      player.vy = 0;
      player.reviving = null;
      return;
    }

    const input = inputState[player.pid];
    let moveX = 0;
    let moveY = 0;

    if (isMobile) {
      if (player.pid === activePid) {
        moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      } else {
        const target = activePid === 1 ? p1 : p2;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 160) {
          moveX = dx / dist;
          moveY = dy / dist;
        }
      }
    } else {
      moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    }

    const magnitude = Math.hypot(moveX, moveY) || 1;
    player.vx = (moveX / magnitude) * PLAYER_SPEED;
    player.vy = (moveY / magnitude) * PLAYER_SPEED;

    player.x = clamp(player.x + player.vx * dt, PLAYER_RADIUS, GAME_WIDTH - PLAYER_RADIUS);
    player.y = clamp(player.y + player.vy * dt, PLAYER_RADIUS, GAME_HEIGHT - PLAYER_RADIUS);

    handlePlayerAttack(player, input);
  });

  handleRevive(dt, p1, p2);
  handleRevive(dt, p2, p1);
}

function handlePlayerAttack(player, input) {
  if (player.downed) {
    return;
  }
  const attackPressed = input.attack && !previousAttack[player.pid];
  previousAttack[player.pid] = input.attack;

  if (!attackPressed || player.attackCooldown > 0) {
    return;
  }

  player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
  player.attackFlash = 0.12;

  state.enemies.forEach((enemy) => {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= PLAYER_ATTACK_RANGE) {
      const normX = dx / (dist || 1);
      const normY = dy / (dist || 1);
      enemy.vx += normX * PLAYER_ATTACK_KNOCKBACK;
      enemy.vy += normY * PLAYER_ATTACK_KNOCKBACK;
      enemy.hp -= PLAYER_ATTACK_DAMAGE;
      enemy.attackWindup = 0;
      spawnParticles(enemy.x, enemy.y, "#ff4444", 3);
    }
  });
}

function handleRevive(dt, reviver, target) {
  if (reviver.downed || !target.downed) {
    reviver.reviving = null;
    return;
  }

  const input = inputState[reviver.pid];
  const dist = distance(reviver, target);

  if (!input.attack || dist > REVIVE_RANGE || reviver.tookDamage) {
    reviver.reviving = null;
    return;
  }

  if (!reviver.reviving) {
    reviver.reviving = { targetPid: target.pid, progress: 0 };
  }

  reviver.reviving.progress += dt;

  if (reviver.reviving.progress >= REVIVE_TIME) {
    target.downed = false;
    target.hp = REVIVE_HP;
    target.hunger = Math.min(PLAYER_MAX_HUNGER, target.hunger + REVIVE_HUNGER);
    target.invuln = INVULN_TIME;
    reviver.reviving = null;
  }
}

function updateEnemies(dt) {
  state.enemies.forEach((enemy) => {
    let target = null;
    const distToBase = Math.hypot(enemy.x - BASE_X, enemy.y - BASE_Y);
    if (distToBase <= BASE_ZONE_RADIUS) {
      enemy.target = "base";
    } else {
      const livingPlayers = state.players.filter((p) => !p.downed);
      if (livingPlayers.length) {
        const nearest = livingPlayers.reduce((closest, player) => {
          const dist = distance(enemy, player);
          if (!closest || dist < closest.dist) {
            return { player, dist };
          }
          return closest;
        }, null);
        if (nearest && nearest.dist <= ENEMY_AGGRO_RANGE) {
          enemy.target = nearest.player.pid;
        } else {
          enemy.target = "none";
        }
      } else {
        enemy.target = "none";
      }
    }

    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    }
    if (enemy.attackWindup > 0) {
      enemy.attackWindup = Math.max(0, enemy.attackWindup - dt);
      if (enemy.attackWindup === 0) {
        resolveEnemyAttack(enemy);
      }
    }

    if (enemy.attackWindup > 0) {
      enemy.vx = 0;
      enemy.vy = 0;
    } else if (enemy.target === "base") {
      target = state.base;
    } else if (enemy.target === 1 || enemy.target === 2) {
      target = state.players.find((p) => p.pid === enemy.target);
    }

    if (target && !target.downed) {
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist <= ENEMY_ATTACK_RANGE && enemy.attackCooldown <= 0) {
        enemy.attackWindup = ENEMY_ATTACK_WINDUP;
        enemy.vx = 0;
        enemy.vy = 0;
      } else {
        enemy.vx = (dx / dist) * ENEMY_SPEED;
        enemy.vy = (dy / dist) * ENEMY_SPEED;
      }
    } else if (enemy.target === "base") {
      const dx = BASE_X - enemy.x;
      const dy = BASE_Y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      enemy.vx = (dx / dist) * ENEMY_SPEED;
      enemy.vy = (dy / dist) * ENEMY_SPEED;
    } else {
      enemy.wanderAngle += (Math.random() - 0.5) * 0.3;
      enemy.vx = Math.cos(enemy.wanderAngle) * (ENEMY_SPEED * 0.3);
      enemy.vy = Math.sin(enemy.wanderAngle) * (ENEMY_SPEED * 0.3);
    }

    enemy.x = clamp(enemy.x + enemy.vx * dt, ENEMY_RADIUS, GAME_WIDTH - ENEMY_RADIUS);
    enemy.y = clamp(enemy.y + enemy.vy * dt, ENEMY_RADIUS, GAME_HEIGHT - ENEMY_RADIUS);
  });

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.hp <= 0) {
      state.kills += 1;
      spawnParticles(enemy.x, enemy.y, "#ff2222", 6);
      return false;
    }
    return true;
  });
}

function resolveEnemyAttack(enemy) {
  if (enemy.target === "base") {
    const dist = Math.hypot(enemy.x - BASE_X, enemy.y - BASE_Y);
    if (dist <= BASE_DAMAGE_RANGE) {
      state.base.hp = Math.max(0, state.base.hp - ENEMY_DAMAGE_BASE);
      state.screenShake.time = 0.2;
      state.screenShake.magnitude = 2;
      if (state.base.hp <= 0) {
        triggerGameOver("Base destroyed");
      }
    }
    enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;
    return;
  }

  const target = state.players.find((p) => p.pid === enemy.target);
  if (!target || target.downed) {
    return;
  }
  const dist = distance(enemy, target);
  if (dist <= ENEMY_ATTACK_RANGE) {
    if (target.invuln <= 0) {
      target.hp = Math.max(0, target.hp - ENEMY_DAMAGE_PLAYER);
      target.tookDamage = true;
    }
    enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;
  }
}

function updatePickups(dt) {
  state.foodTimer -= dt;
  if (state.foodTimer <= 0) {
    state.foodTimer = FOOD_SPAWN_INTERVAL;
    const pos = randomSpawnPosition(FOOD_RADIUS);
    state.pickups.push(createPickup(pos.x, pos.y));
  }

  state.pickups.forEach((pickup) => {
    pickup.pulse += dt * 2;
  });

  state.players.forEach((player) => {
    if (player.downed) {
      return;
    }
    state.pickups = state.pickups.filter((pickup) => {
      const dist = distance(player, pickup);
      if (dist <= FOOD_PICKUP_RANGE && player.hunger < PLAYER_MAX_HUNGER) {
        player.hunger = Math.min(
          PLAYER_MAX_HUNGER,
          player.hunger + FOOD_HUNGER_RESTORE
        );
        spawnParticles(pickup.x, pickup.y, "#ffcc00", 4);
        return false;
      }
      return true;
    });
  });
}

function updateWave(dt) {
  state.wave.nextSpawnTime -= dt;
  if (state.wave.nextSpawnTime > 0) {
    return;
  }

  state.wave.current += 1;
  const spawnCount = getWaveCount(state.wave.current);
  state.wave.spawnCount = spawnCount;
  state.wave.nextSpawnTime = getWaveTimer(state.wave.current);
  state.waveFlash = 0.2;

  for (let i = 0; i < spawnCount; i += 1) {
    const pos = randomSpawnPosition(ENEMY_RADIUS);
    state.enemies.push(createEnemy(pos.x, pos.y));
  }

  hudWaveNumber.parentElement.classList.remove("wave");
  void hudWaveNumber.offsetWidth;
  hudWaveNumber.parentElement.classList.add("wave");
}

function updateBleedout(dt) {
  const downedCount = state.players.filter((p) => p.downed).length;
  if (downedCount === 2) {
    if (!state.bleedOut.active) {
      state.bleedOut.active = true;
      state.bleedOut.timeLeft = BLEEDOUT_TIME;
    } else {
      state.bleedOut.timeLeft = Math.max(0, state.bleedOut.timeLeft - dt);
      if (state.bleedOut.timeLeft <= 0) {
        triggerGameOver("Bleedout");
      }
    }
  } else {
    state.bleedOut.active = false;
    state.bleedOut.timeLeft = BLEEDOUT_TIME;
  }
}

function updateParticles(dt) {
  state.particles.forEach((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length >= 50) {
      return;
    }
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.3,
      color,
    });
  }
}

function drawWorld(alpha) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shake = state.screenShake;
  if (shake.time > 0) {
    shake.time = Math.max(0, shake.time - FIXED_DT);
    ctx.translate(
      (Math.random() - 0.5) * shake.magnitude,
      (Math.random() - 0.5) * shake.magnitude
    );
  }

  drawGrid();
  drawBaseZone();
  drawBase();
  drawPickups(alpha);
  drawEnemies(alpha);
  drawPlayers(alpha);
  drawParticles();
  drawWaveFlash();

  ctx.restore();
}

function drawGrid() {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= GAME_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= GAME_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
    ctx.stroke();
  }
}

function drawBaseZone() {
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,170,0,0.15)";
  ctx.lineWidth = 3;
  ctx.arc(BASE_X, BASE_Y, BASE_ZONE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBase() {
  const gradient = ctx.createRadialGradient(
    BASE_X,
    BASE_Y,
    8,
    BASE_X,
    BASE_Y,
    BASE_RADIUS + 10
  );
  gradient.addColorStop(0, "#ffdd44");
  gradient.addColorStop(1, "#ffaa00");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(BASE_X, BASE_Y, BASE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

function drawPickups(alpha) {
  state.pickups.forEach((pickup) => {
    const x = lerp(pickup.prevX, pickup.x, alpha);
    const y = lerp(pickup.prevY, pickup.y, alpha);
    const pulse = 0.9 + Math.sin(pickup.pulse) * 0.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#ff8800";
    ctx.beginPath();
    ctx.arc(0, 0, FOOD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,204,0,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });
}

function drawEnemies(alpha) {
  state.enemies.forEach((enemy) => {
    const x = lerp(enemy.prevX, enemy.x, alpha);
    const y = lerp(enemy.prevY, enemy.y, alpha);
    const gradient = ctx.createRadialGradient(x, y, 4, x, y, ENEMY_RADIUS + 6);
    gradient.addColorStop(0, "#ff4444");
    gradient.addColorStop(1, "#cc2222");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, ENEMY_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    drawHpBar(x, y - 18, enemy.hp / ENEMY_HP, "#ff4444");
  });
}

function drawPlayers(alpha) {
  state.players.forEach((player) => {
    const x = lerp(player.prevX, player.x, alpha);
    const y = lerp(player.prevY, player.y, alpha);
    const colors =
      player.pid === 1
        ? ["#44aaff", "#2288dd"]
        : ["#44ff44", "#22dd22"];
    const gradient = ctx.createRadialGradient(x, y, 4, x, y, PLAYER_RADIUS + 6);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);

    const flicker = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0;
    ctx.fillStyle = player.downed ? "#777" : gradient;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    if (player.downed) {
      ctx.strokeStyle = "#aaa";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (flicker) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (player.attackFlash > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_ATTACK_RANGE, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (player.reviving) {
      const progress = player.reviving.progress / REVIVE_TIME;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS + 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }

    drawHpBar(x, y - 26, player.hp / PLAYER_MAX_HP, "#ffffff");
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life / 0.3);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawWaveFlash() {
  if (state.waveFlash <= 0) {
    return;
  }
  state.waveFlash = Math.max(0, state.waveFlash - FIXED_DT);
  ctx.save();
  ctx.globalAlpha = state.waveFlash / 0.2;
  ctx.strokeStyle = "rgba(255,68,68,0.8)";
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.restore();
}

function drawHpBar(x, y, ratio, color) {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - 16, y, 32, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - 16, y, 32 * clamp(ratio, 0, 1), 4);
}

function updateHud() {
  hudWaveNumber.textContent = state.wave.current.toString();
  baseFill.style.width = `${(state.base.hp / BASE_MAX_HP) * 100}%`;

  p1Hunger.style.width = `${(state.players[0].hunger / PLAYER_MAX_HUNGER) * 100}%`;
  p2Hunger.style.width = `${(state.players[1].hunger / PLAYER_MAX_HUNGER) * 100}%`;
  p1Status.textContent = state.players[0].downed ? "(DOWN)" : "";
  p2Status.textContent = state.players[1].downed ? "(DOWN)" : "";

  if (state.bleedOut.active) {
    bleedoutEl.classList.remove("hidden");
    bleedoutTimerEl.textContent = state.bleedOut.timeLeft.toFixed(1);
    bleedoutEl.style.color = state.bleedOut.timeLeft < 3 ? "#ff2222" : "#ff4444";
  } else {
    bleedoutEl.classList.add("hidden");
  }

  if (debugVisible) {
    debugEl.textContent = `FPS: ${Math.round(1 / FIXED_DT)}\n`;
    debugEl.textContent += `Enemies: ${state.enemies.length}\n`;
    debugEl.textContent += `P1 Hunger: ${state.players[0].hunger.toFixed(1)}\n`;
    debugEl.textContent += `P2 Hunger: ${state.players[1].hunger.toFixed(1)}\n`;
    debugEl.textContent += `Base HP: ${state.base.hp.toFixed(0)}\n`;
    debugEl.textContent += `Next Wave: ${state.wave.nextSpawnTime.toFixed(1)}s\n`;
  }

  if (state.gameOver) {
    gameOverEl.classList.remove("hidden");
  }
}

function triggerGameOver(reason) {
  state.gameOver = true;
  state.gameOverReason = reason;
  gameOverReasonEl.textContent = reason;
  statWavesEl.textContent = state.wave.current;
  statKillsEl.textContent = state.kills;
  statTimeEl.textContent = state.time.toFixed(1);
}

function getWaveTimer(waveNumber) {
  return Math.max(WAVE_MIN_TIMER, WAVE_BASE_TIMER - waveNumber * 1.2);
}

function getWaveCount(waveNumber) {
  return Math.min(WAVE_MAX_COUNT, WAVE_BASE_COUNT + Math.floor(waveNumber * 0.9));
}

function randomSpawnPosition(radius) {
  const edge = Math.floor(Math.random() * 4);
  const margin = radius + 10;
  switch (edge) {
    case 0:
      return { x: margin, y: Math.random() * GAME_HEIGHT };
    case 1:
      return { x: GAME_WIDTH - margin, y: Math.random() * GAME_HEIGHT };
    case 2:
      return { x: Math.random() * GAME_WIDTH, y: margin };
    default:
      return { x: Math.random() * GAME_WIDTH, y: GAME_HEIGHT - margin };
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
