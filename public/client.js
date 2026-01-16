const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const statusText = document.getElementById("statusText");
const playerNameInput = document.getElementById("playerName");
const serverAddressInput = document.getElementById("serverAddress");
const hostButton = document.getElementById("hostButton");
const joinButton = document.getElementById("joinButton");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const waveText = document.getElementById("waveText");
const nextWaveText = document.getElementById("nextWaveText");
const scrapText = document.getElementById("scrapText");
const hungerText = document.getElementById("hungerText");
const baseHpText = document.getElementById("baseHpText");
const statusHud = document.getElementById("statusHud");
const gameOverOverlay = document.getElementById("gameOver");

const attackButton = document.getElementById("attackButton");
const repairButton = document.getElementById("repairButton");
const expandButton = document.getElementById("expandButton");
const movementButtons = document.querySelectorAll("[data-dir]");

let socket;
let playerId = null;
let currentState = null;
const inputState = {
  up: 0,
  down: 0,
  left: 0,
  right: 0,
  attack: false,
  repair: false,
  expand: false
};

function setStatus(message) {
  statusText.textContent = message;
}

function connect(address) {
  socket = new WebSocket(address);
  setStatus("Connecting...");

  socket.addEventListener("open", () => {
    setStatus("Connected. Waiting for second player...");
    const name = playerNameInput.value.trim();
    if (name) {
      socket.send(JSON.stringify({ type: "name", payload: name }));
    }
    lobby.classList.add("hidden");
    game.classList.remove("hidden");
  });

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "welcome") {
      playerId = data.playerId;
    }
    if (data.type === "full") {
      setStatus("Server is full (2 players already connected).");
    }
    if (data.type === "state") {
      currentState = data.payload;
      updateHud();
      render();
    }
  });

  socket.addEventListener("close", () => {
    setStatus("Disconnected. Refresh to reconnect.");
  });
}

hostButton.addEventListener("click", () => {
  const address = `ws://${window.location.host}`;
  connect(address);
});

joinButton.addEventListener("click", () => {
  const address = serverAddressInput.value.trim();
  if (!address) {
    setStatus("Enter the server WebSocket address.");
    return;
  }
  connect(address);
});

function sendInput() {
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify({ type: "input", payload: inputState }));
  }
}

const keyMap = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right"
};

window.addEventListener("keydown", (event) => {
  const key = keyMap[event.key];
  if (key) {
    inputState[key] = 1;
  }
  if (event.key === " ") {
    inputState.attack = true;
  }
  if (event.key.toLowerCase() === "e") {
    inputState.repair = true;
  }
  if (event.key.toLowerCase() === "q") {
    inputState.expand = true;
  }
  sendInput();
});

window.addEventListener("keyup", (event) => {
  const key = keyMap[event.key];
  if (key) {
    inputState[key] = 0;
  }
  if (event.key === " ") {
    inputState.attack = false;
  }
  if (event.key.toLowerCase() === "e") {
    inputState.repair = false;
  }
  if (event.key.toLowerCase() === "q") {
    inputState.expand = false;
  }
  sendInput();
});

movementButtons.forEach((button) => {
  const dir = button.dataset.dir;
  button.addEventListener("touchstart", () => {
    inputState[dir] = 1;
    sendInput();
  });
  button.addEventListener("touchend", () => {
    inputState[dir] = 0;
    sendInput();
  });
});

attackButton.addEventListener("touchstart", () => {
  inputState.attack = true;
  sendInput();
});
attackButton.addEventListener("touchend", () => {
  inputState.attack = false;
  sendInput();
});

repairButton.addEventListener("touchstart", () => {
  inputState.repair = true;
  sendInput();
});
repairButton.addEventListener("touchend", () => {
  inputState.repair = false;
  sendInput();
});

expandButton.addEventListener("touchstart", () => {
  inputState.expand = true;
  sendInput();
});
expandButton.addEventListener("touchend", () => {
  inputState.expand = false;
  sendInput();
});

function updateHud() {
  if (!currentState) {
    return;
  }
  waveText.textContent = currentState.wave;
  nextWaveText.textContent = currentState.nextWaveIn.toFixed(1);
  scrapText.textContent = currentState.sharedScrap;

  const player = currentState.players[playerId];
  hungerText.textContent = player ? Math.round(player.hunger) : "--";
  baseHpText.textContent = Math.round(currentState.base.hp);
  statusHud.textContent = currentState.status;

  if (currentState.status === "gameover") {
    gameOverOverlay.classList.remove("hidden");
  } else {
    gameOverOverlay.classList.add("hidden");
  }
}

function render() {
  if (!currentState) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBase();
  drawItems();
  drawEnemies();
  drawPlayers();
}

function drawBase() {
  const { base } = currentState;
  ctx.save();
  ctx.fillStyle = "#1f1f1f";
  ctx.beginPath();
  ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ff7a59";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawItems() {
  currentState.items.forEach((item) => {
    if (item.respawnAt) {
      return;
    }
    ctx.save();
    ctx.fillStyle = item.type === "scrap" ? "#4fd1c5" : "#f6ad55";
    ctx.beginPath();
    ctx.arc(item.x, item.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawEnemies() {
  currentState.enemies.forEach((enemy) => {
    ctx.save();
    ctx.fillStyle = "#d9534f";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPlayers() {
  Object.values(currentState.players).forEach((player) => {
    ctx.save();
    ctx.fillStyle = player.id === playerId ? "#63b3ed" : "#68d391";
    ctx.beginPath();
    ctx.arc(player.x, player.y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f2f2f2";
    ctx.font = "14px sans-serif";
    ctx.fillText(player.name, player.x - 20, player.y - 22);
    ctx.restore();
  });
}

setInterval(() => {
  if (socket && socket.readyState === 1) {
    sendInput();
  }
}, 100);
