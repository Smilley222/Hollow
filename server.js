import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const PORT = process.env.PORT || 8080;
const TICK_RATE = 30;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
const PLAYER_SPEED = 180;
const ENEMY_SPEED = 60;
const ENEMY_DAMAGE = 4;
const PLAYER_ATTACK_RANGE = 45;
const PLAYER_ATTACK_DAMAGE = 30;
const PLAYER_ATTACK_COOLDOWN = 0.5;
const HUNGER_DRAIN = 3;
const HUNGER_MAX = 100;
const BASE_MAX_HP = 1000;
const BASE_EXPAND_COST = 40;
const BASE_REPAIR_COST = 10;
const BASE_REPAIR_AMOUNT = 80;
const ITEM_RESPAWN_TIME = 8;
const GAME_OVER_DELAY = 5;

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let nextPlayerId = 1;
let lastTimestamp = Date.now();

const state = createInitialState();

function createInitialState() {
  return {
    status: "waiting",
    time: 0,
    wave: 0,
    nextWaveIn: 6,
    players: {},
    enemies: [],
    items: [],
    base: {
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT / 2,
      radius: 110,
      hp: BASE_MAX_HP,
      maxHp: BASE_MAX_HP,
      expansions: 0
    },
    sharedScrap: 0,
    gameOverAt: null
  };
}

function resetGame() {
  const fresh = createInitialState();
  state.status = fresh.status;
  state.time = fresh.time;
  state.wave = fresh.wave;
  state.nextWaveIn = fresh.nextWaveIn;
  state.enemies = fresh.enemies;
  state.items = fresh.items;
  state.base = fresh.base;
  state.sharedScrap = fresh.sharedScrap;
  state.gameOverAt = null;
  Object.values(state.players).forEach((player) => {
    player.x = MAP_WIDTH / 2 + (player.id === 1 ? -60 : 60);
    player.y = MAP_HEIGHT / 2 + (player.id === 1 ? -80 : 80);
    player.hunger = HUNGER_MAX;
    player.attackCooldown = 0;
    player.alive = true;
  });
  spawnItems();
}

function spawnItems() {
  state.items = [];
  for (let i = 0; i < 8; i += 1) {
    state.items.push(createItem(i));
  }
}

function createItem(index) {
  const margin = 80;
  return {
    id: `item-${index}-${Date.now()}`,
    type: Math.random() > 0.45 ? "scrap" : "food",
    x: margin + Math.random() * (MAP_WIDTH - margin * 2),
    y: margin + Math.random() * (MAP_HEIGHT - margin * 2),
    respawnAt: null
  };
}

function spawnWave() {
  state.wave += 1;
  const baseCount = 4 + state.wave * 2;
  const expansionPressure = state.base.expansions * 2;
  const count = baseCount + expansionPressure;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.max(MAP_WIDTH, MAP_HEIGHT) / 2 + 120;
    state.enemies.push({
      id: `enemy-${state.wave}-${i}-${Date.now()}`,
      x: state.base.x + Math.cos(angle) * radius,
      y: state.base.y + Math.sin(angle) * radius,
      hp: 60 + state.wave * 6,
      speed: ENEMY_SPEED + state.wave * 1.5
    });
  }
}

function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function update(dt) {
  if (state.status === "waiting") {
    if (Object.keys(state.players).length === 2) {
      state.status = "active";
      resetGame();
    }
    return;
  }

  if (state.status === "gameover") {
    if (Date.now() >= state.gameOverAt) {
      resetGame();
      state.status = "active";
    }
    return;
  }

  state.time += dt;
  state.nextWaveIn -= dt;
  if (state.nextWaveIn <= 0) {
    spawnWave();
    state.nextWaveIn = Math.max(5, 12 - state.wave * 0.2);
  }

  for (const item of state.items) {
    if (item.respawnAt && state.time >= item.respawnAt) {
      item.respawnAt = null;
      item.type = Math.random() > 0.45 ? "scrap" : "food";
      const margin = 80;
      item.x = margin + Math.random() * (MAP_WIDTH - margin * 2);
      item.y = margin + Math.random() * (MAP_HEIGHT - margin * 2);
    }
  }

  for (const player of Object.values(state.players)) {
    if (!player.alive) {
      continue;
    }

    const moveX = player.input.right - player.input.left;
    const moveY = player.input.down - player.input.up;
    const magnitude = Math.hypot(moveX, moveY) || 1;
    player.x += (moveX / magnitude) * PLAYER_SPEED * dt;
    player.y += (moveY / magnitude) * PLAYER_SPEED * dt;
    player.x = Math.max(30, Math.min(MAP_WIDTH - 30, player.x));
    player.y = Math.max(30, Math.min(MAP_HEIGHT - 30, player.y));

    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.hunger = Math.max(0, player.hunger - HUNGER_DRAIN * dt);
    if (player.hunger <= 0) {
      player.alive = false;
    }

    if (player.input.attack && player.attackCooldown === 0) {
      player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
      for (const enemy of state.enemies) {
        if (distance(player, enemy) <= PLAYER_ATTACK_RANGE) {
          enemy.hp -= PLAYER_ATTACK_DAMAGE;
        }
      }
    }

    if (player.input.repair) {
      const nearBase = distance(player, state.base) <= state.base.radius + 20;
      if (nearBase && state.sharedScrap >= BASE_REPAIR_COST && state.base.hp < state.base.maxHp) {
        state.sharedScrap -= BASE_REPAIR_COST;
        state.base.hp = Math.min(state.base.maxHp, state.base.hp + BASE_REPAIR_AMOUNT * dt);
      }
    }

    if (player.input.expand) {
      const nearBase = distance(player, state.base) <= state.base.radius + 20;
      if (nearBase && state.sharedScrap >= BASE_EXPAND_COST) {
        state.sharedScrap -= BASE_EXPAND_COST;
        state.base.expansions += 1;
        state.base.radius += 20;
        state.base.maxHp += 120;
        state.base.hp = Math.min(state.base.maxHp, state.base.hp + 100);
        player.input.expand = false;
      }
    }

    for (const item of state.items) {
      if (item.respawnAt) {
        continue;
      }
      if (distance(player, item) < 40) {
        if (item.type === "scrap") {
          state.sharedScrap += 15;
        } else {
          player.hunger = Math.min(HUNGER_MAX, player.hunger + 40);
        }
        item.respawnAt = state.time + ITEM_RESPAWN_TIME;
      }
    }
  }

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  for (const enemy of state.enemies) {
    const target = state.base;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;

    if (dist < state.base.radius) {
      state.base.hp -= ENEMY_DAMAGE * dt;
    }
  }

  if (state.base.hp <= 0 || Object.values(state.players).some((player) => !player.alive)) {
    state.status = "gameover";
    state.gameOverAt = Date.now() + GAME_OVER_DELAY * 1000;
  }
}

wss.on("connection", (socket) => {
  const id = nextPlayerId;
  if (Object.keys(state.players).length >= 2) {
    socket.send(JSON.stringify({ type: "full" }));
    socket.close();
    return;
  }

  const player = {
    id,
    name: `Player ${id}`,
    x: MAP_WIDTH / 2 + (id === 1 ? -60 : 60),
    y: MAP_HEIGHT / 2 + (id === 1 ? -80 : 80),
    hunger: HUNGER_MAX,
    attackCooldown: 0,
    alive: true,
    input: {
      up: 0,
      down: 0,
      left: 0,
      right: 0,
      attack: false,
      repair: false,
      expand: false
    }
  };

  state.players[id] = player;
  nextPlayerId += 1;

  socket.send(JSON.stringify({ type: "welcome", playerId: id }));

  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "input") {
        Object.assign(player.input, data.payload);
      }
      if (data.type === "name" && typeof data.payload === "string") {
        player.name = data.payload.slice(0, 20);
      }
    } catch (error) {
      console.error("Invalid message", error);
    }
  });

  socket.on("close", () => {
    delete state.players[id];
    state.status = "waiting";
    state.enemies = [];
    state.items = [];
    state.sharedScrap = 0;
    state.wave = 0;
    state.nextWaveIn = 6;
  });
});

spawnItems();

setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
  lastTimestamp = now;
  update(dt);

  broadcast({
    type: "state",
    payload: {
      status: state.status,
      time: state.time,
      wave: state.wave,
      nextWaveIn: state.nextWaveIn,
      base: state.base,
      enemies: state.enemies,
      items: state.items,
      players: state.players,
      sharedScrap: state.sharedScrap
    }
  });
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Concrete Hunger server running on http://localhost:${PORT}`);
});
