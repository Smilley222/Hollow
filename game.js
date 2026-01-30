const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONSTANTS ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const FIXED_DT = 1/60;

// Configs
const PLAYER_SPEED = 270;
const PLAYER_MAX_HUNGER = 100;
const HUNGER_DRAIN_RATE = 2.5;
const PLAYER_ATTACK_DAMAGE = 28;
const PLAYER_ATTACK_COOLDOWN = 0.35;
const BASE_MAX_HP_INITIAL = 500;

const ITEM_TYPES = {
    FOOD: { color: '#ff8800', radius: 10, label: 'F' },
    MEDKIT: { color: '#ff4444', radius: 12, label: 'M' },
    OVERCHARGE: { color: '#00ffff', radius: 12, label: 'O' }
};

const DROP_RATES = {
    FOOD: 0.05,
    MEDKIT: 0.02,
    OVERCHARGE: 0.03
};

// --- STATE ---
let state = {
    tick: 0,
    currency: 0,
    shopOpen: false,
    upgrades: {
        damageMult: 1.0,
        cooldownMult: 1.0,
        speedMult: 1.0,
        maxHpAdd: 0
    },
    players: [
        { pid: 1, x: 350, y: 300, hp: 100, hunger: 100, downed: false, reviving: null, invuln: 0, attackCd: 0, color: '#44aaff' },
        { pid: 2, x: 450, y: 300, hp: 100, hunger: 100, downed: false, reviving: null, invuln: 0, attackCd: 0, color: '#44ff44' }
    ],
    enemies: [],
    pickups: [],
    base: { x: 400, y: 300, hp: 500, maxHp: 500, radius: 30, zone: 420 },
    wave: { current: 0, timer: 0, count: 0 },
    bleedOutTimer: 8.0,
    gameOver: false,
    particles: []
};

let inputs = {
    p1: { up: false, down: false, left: false, right: false, attack: false },
    p2: { up: false, down: false, left: false, right: false, attack: false }
};

// --- INIT ---
function init() {
    resize();
    window.addEventListener('resize', resize);
    setupInput();
    requestAnimationFrame(gameLoop);
}

function resize() {
    const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
    canvas.width = GAME_WIDTH * scale;
    canvas.height = GAME_HEIGHT * scale;
    ctx.scale(scale, scale);
}

function setupInput() {
    window.addEventListener('keydown', e => {
        if(e.code === 'KeyW') inputs.p1.up = true;
        if(e.code === 'KeyS') inputs.p1.down = true;
        if(e.code === 'KeyA') inputs.p1.left = true;
        if(e.code === 'KeyD') inputs.p1.right = true;
        if(e.code === 'KeyF') inputs.p1.attack = true;
        if(e.code === 'KeyB') toggleShop(); // Shop Toggle

        if(e.code === 'ArrowUp') inputs.p2.up = true;
        if(e.code === 'ArrowDown') inputs.p2.down = true;
        if(e.code === 'ArrowLeft') inputs.p2.left = true;
        if(e.code === 'ArrowRight') inputs.p2.right = true;
        if(e.code === 'ShiftRight') inputs.p2.attack = true;
        
        if(e.key === '`') document.getElementById('debug-overlay').classList.toggle('hidden');
        if(e.code === 'Escape') {
            state.shopOpen = false;
            document.getElementById('shop-ui').classList.add('hidden');
        }
    });
    window.addEventListener('keyup', e => {
        if(e.code === 'KeyW') inputs.p1.up = false;
        if(e.code === 'KeyS') inputs.p1.down = false;
        if(e.code === 'KeyA') inputs.p1.left = false;
        if(e.code === 'KeyD') inputs.p1.right = false;
        if(e.code === 'KeyF') inputs.p1.attack = false;

        if(e.code === 'ArrowUp') inputs.p2.up = false;
        if(e.code === 'ArrowDown') inputs.p2.down = false;
        if(e.code === 'ArrowLeft') inputs.p2.left = false;
        if(e.code === 'ArrowRight') inputs.p2.right = false;
        if(e.code === 'ShiftRight') inputs.p2.attack = false;
    });
}

// --- SHOP LOGIC ---
window.toggleShop = function() {
    // Check range (100 units from base)
    const p1Dist = Math.hypot(state.players[0].x - state.base.x, state.players[0].y - state.base.y);
    if (p1Dist < 100) {
        state.shopOpen = !state.shopOpen;
        const ui = document.getElementById('shop-ui');
        ui.classList.toggle('hidden');
        if (!ui.classList.contains('hidden')) {
            document.getElementById('shop-currency').innerText = state.currency;
        }
    }
};

window.buyUpgrade = function(type) {
    const costMap = { 'dmg': 100, 'rate': 150, 'hp': 80, 'speed': 120, 'healBase': 50, 'wall': 200 };
    const cost = costMap[type];
    
    if (state.currency >= cost) {
        state.currency -= cost;
        document.getElementById('shop-currency').innerText = state.currency;
        
        switch(type) {
            case 'dmg': state.upgrades.damageMult += 0.2; break;
            case 'rate': state.upgrades.cooldownMult *= 0.9; break;
            case 'hp': 
                state.upgrades.maxHpAdd += 25; 
                state.players.forEach(p => p.hp = Math.min(100 + state.upgrades.maxHpAdd, p.hp + 25)); 
                break;
            case 'speed': state.upgrades.speedMult += 0.1; break;
            case 'healBase': state.base.hp = Math.min(state.base.maxHp, state.base.hp + 100); break;
            case 'wall': state.base.maxHp += 100; state.base.hp += 100; break;
        }
    } else {
        const btn = event.target.closest('button');
        btn.style.borderColor = 'red';
        setTimeout(() => btn.style.borderColor = '', 200);
    }
};

// --- GAME LOOP ---
let accumulator = 0;
let lastTime = performance.now();

function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    accumulator += deltaTime;

    while (accumulator >= FIXED_DT) {
        if (!state.shopOpen) update(FIXED_DT); // Pause game when shop is open
        accumulator -= FIXED_DT;
    }

    render();
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (state.gameOver) return;
    state.tick++;
    updatePlayers(dt);
    updateEnemies(dt);
    updateWave(dt);
    updatePickups(dt);
    updateParticles(dt);
    checkCollisions();
    checkLossConditions(dt);
}

function updatePlayers(dt) {
    state.players.forEach((p, idx) => {
        const input = idx === 0 ? inputs.p1 : inputs.p2;
        const maxHp = 100 + state.upgrades.maxHpAdd;

        if (!p.downed) {
            p.hunger -= HUNGER_DRAIN_RATE * dt;
            if (p.hunger <= 0) { p.hunger = 0; p.downed = true; }

            let vx = 0, vy = 0;
            if (input.up) vy -= 1;
            if (input.down) vy += 1;
            if (input.left) vx -= 1;
            if (input.right) vx += 1;

            if (vx !== 0 || vy !== 0) {
                const mag = Math.sqrt(vx*vx + vy*vy);
                const speed = PLAYER_SPEED * state.upgrades.speedMult;
                p.x += (vx/mag) * speed * dt;
                p.y += (vy/mag) * speed * dt;
            }

            if (p.attackCd > 0) p.attackCd -= dt;
            
            // Revive & Attack
            const other = state.players[idx === 0 ? 1 : 0];
            const distToOther = Math.hypot(p.x - other.x, p.y - other.y);

            if (input.attack) {
                if (other.downed && distToOther < 75) {
                    p.reviving = { progress: (p.reviving?.progress || 0) + dt };
                    if (p.reviving.progress >= 2.75) {
                        other.downed = false;
                        other.hp = 35 + (state.upgrades.maxHpAdd * 0.35);
                        other.hunger = 25;
                        other.invuln = 2.0;
                        p.reviving = null;
                    }
                } else if (p.attackCd <= 0) {
                    performAttack(p);
                    p.attackCd = PLAYER_ATTACK_COOLDOWN * state.upgrades.cooldownMult;
                    p.reviving = null;
                }
            } else {
                p.reviving = null;
            }
        }
        if (p.invuln > 0) p.invuln -= dt;
        p.x = Math.max(15, Math.min(GAME_WIDTH - 15, p.x));
        p.y = Math.max(15, Math.min(GAME_HEIGHT - 15, p.y));
    });
}

function performAttack(p) {
    state.enemies.forEach(e => {
        if (Math.hypot(p.x - e.x, p.y - e.y) < 84) {
            e.hp -= PLAYER_ATTACK_DAMAGE * state.upgrades.damageMult;
            const angle = Math.atan2(e.y - p.y, e.x - p.x);
            e.x += Math.cos(angle) * 15;
            e.y += Math.sin(angle) * 15;
            spawnParticles(e.x, e.y, '#ff4444', 3);
        }
    });
}

function updateEnemies(dt) {
    state.enemies = state.enemies.filter(e => {
        if (e.hp <= 0) {
            state.currency += 15;
            spawnParticles(e.x, e.y, '#ff0000', 8);
            
            // Loot Roll
            const r = Math.random();
            let type = null;
            if (r < DROP_RATES.MEDKIT) type = 'MEDKIT';
            else if (r < DROP_RATES.MEDKIT + DROP_RATES.OVERCHARGE) type = 'OVERCHARGE';
            else if (r < DROP_RATES.MEDKIT + DROP_RATES.OVERCHARGE + DROP_RATES.FOOD) type = 'FOOD';
            
            if (type) {
                state.pickups.push({ id: Date.now()+Math.random(), x: e.x, y: e.y, type, life: 15.0 });
            }
            return false;
        }
        return true;
    });

    state.enemies.forEach(e => {
        const distToBase = Math.hypot(e.x - state.base.x, e.y - state.base.y);
        let targetX = state.base.x, targetY = state.base.y;
        let isAttackingBase = distToBase < state.base.zone;

        if (!isAttackingBase) {
            let nearest = null, minDist = Infinity;
            state.players.forEach(p => {
                if (!p.downed) {
                    const d = Math.hypot(e.x - p.x, e.y - p.y);
                    if (d < 480 && d < minDist) { minDist = d; nearest = p; }
                }
            });
            if (nearest) { targetX = nearest.x; targetY = nearest.y; }
        }

        const dToTarget = Math.hypot(e.x - targetX, e.y - targetY);
        if (dToTarget > 40) {
            const angle = Math.atan2(targetY - e.y, targetX - e.x);
            e.x += Math.cos(angle) * 228 * dt;
            e.y += Math.sin(angle) * 228 * dt;
        } else {
            if (e.cooldown > 0) e.cooldown -= dt;
            else {
                e.windup += dt;
                if (e.windup >= 0.3) {
                    if (isAttackingBase) state.base.hp -= 14;
                    else state.players.forEach(p => {
                        if (!p.downed && Math.hypot(e.x - p.x, e.y - p.y) < 84) p.hp -= 8;
                    });
                    e.windup = 0;
                    e.cooldown = 0.9;
                }
            }
        }
    });
}

function updatePickups(dt) {
    state.pickups.forEach(p => p.life -= dt);
    state.pickups = state.pickups.filter(p => p.life > 0);
    state.pickups = state.pickups.filter(pickup => {
        let collected = false;
        state.players.forEach(p => {
            if (!p.downed && Math.hypot(p.x - pickup.x, p.y - pickup.y) < 30) {
                if (pickup.type === 'FOOD') p.hunger = Math.min(100, p.hunger + 35);
                if (pickup.type === 'MEDKIT') p.hp = Math.min(100 + state.upgrades.maxHpAdd, p.hp + 50);
                if (pickup.type === 'OVERCHARGE') {
                     // Simple visual feedback for now, complex effects can be added
                     p.color = '#ffffff'; 
                     setTimeout(() => p.color = p.pid===1?'#44aaff':'#44ff44', 5000);
                     // Could instant heal or boost speed here temporarily
                }
                collected = true;
            }
        });
        return !collected;
    });
}

function updateWave(dt) {
    state.wave.timer -= dt;
    if (state.wave.timer <= 0) {
        state.wave.current++;
        state.wave.timer = Math.max(5.0, 30.0 - state.wave.current * 1.2);
        const count = Math.min(20, 3 + Math.floor(state.wave.current * 0.9));
        for (let i = 0; i < count; i++) {
            const side = Math.floor(Math.random() * 4);
            let x, y;
            if (side === 0) { x = Math.random()*800; y = -20; }
            else if (side === 1) { x = 820; y = Math.random()*600; }
            else if (side === 2) { x = Math.random()*800; y = 620; }
            else { x = -20; y = Math.random()*600; }
            state.enemies.push({ id: Date.now()+i, x, y, hp: 100, windup: 0, cooldown: 0 });
        }
    }
}

function updateParticles(dt) {
    state.particles.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; });
    state.particles = state.particles.filter(p => p.life > 0);
}

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        if (state.particles.length > 50) return;
        state.particles.push({ x, y, vx:(Math.random()-0.5)*200, vy:(Math.random()-0.5)*200, life:0.3, color });
    }
}

function checkCollisions() {
    state.players.forEach(p => { if(p.hp <= 0) { p.hp = 0; p.downed = true; }});
}

function checkLossConditions(dt) {
    if (state.players.every(p => p.downed)) {
        state.bleedOutTimer -= dt;
        document.getElementById('bleedout-timer').classList.remove('hidden');
        document.getElementById('bleedout-timer').innerText = `BLEEDOUT: ${state.bleedOutTimer.toFixed(1)}s`;
    } else {
        state.bleedOutTimer = 8.0;
        document.getElementById('bleedout-timer').classList.add('hidden');
    }
    if (state.base.hp <= 0 || state.bleedOutTimer <= 0) {
        state.gameOver = true;
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('death-reason').innerText = state.base.hp <= 0 ? "CORE CRITICAL" : "SQUAD LOST";
    }
}

function render() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for(let i=0; i<800; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,600); ctx.stroke(); }
    for(let i=0; i<600; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(800,i); ctx.stroke(); }

    // Shop Zone
    const p1Dist = Math.hypot(state.players[0].x - state.base.x, state.players[0].y - state.base.y);
    if (p1Dist < 100) {
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(state.base.x, state.base.y, 100, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.fillText("PRESS 'B' FOR SHOP", state.base.x - 60, state.base.y - 50);
    }

    // Base Zone
    ctx.beginPath(); ctx.arc(state.base.x, state.base.y, state.base.zone, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,170,0,0.15)'; ctx.stroke();

    // Base
    ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(state.base.x, state.base.y, state.base.radius, 0, Math.PI*2); ctx.fill();

    // Pickups
    state.pickups.forEach(p => {
        const conf = ITEM_TYPES[p.type];
        ctx.shadowBlur = 10; ctx.shadowColor = conf.color; ctx.fillStyle = conf.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, conf.radius, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'black'; ctx.font = '10px Arial'; ctx.fillText(conf.label, p.x-3, p.y+3);
    });

    // Enemies
    state.enemies.forEach(e => {
        ctx.fillStyle = '#ff4444'; ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, Math.PI*2); ctx.fill();
    });

    // Players
    state.players.forEach(p => {
        ctx.globalAlpha = p.downed ? 0.5 : 1.0;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
        if (p.reviving) {
            ctx.strokeStyle = 'white'; ctx.beginPath();
            ctx.arc(p.x, p.y, 25, 0, (p.reviving.progress / 2.75) * Math.PI*2); ctx.stroke();
        }
    });

    // Particles
    state.particles.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); });

    // HUD Updates
    document.getElementById('wave-display').innerText = `WAVE ${state.wave.current}`;
    document.getElementById('base-hp-fill').style.width = `${(state.base.hp / state.base.maxHp) * 100}%`;
    document.getElementById('biomass-display').innerText = state.currency;
    state.players.forEach((p, i) => {
        document.getElementById(i===0?'p1-hunger-fill':'p2-hunger-fill').style.width = `${p.hunger}%`;
        document.getElementById(i===0?'p1-status':'p2-status').innerText = p.downed ? `P${i+1} (DOWN)` : `P${i+1}`;
    });
}

init();
