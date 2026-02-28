// Case Battle System - PvP via Socket.io + Bot mode
const CASE_TIERS = [
    {
        id: 'bronze', name: 'Bronze Case', cost: 50, color: '#cd7f32', icon: '🥉',
        pool: [
            { tagId: 'common', weight: 50 },
            { tagId: 'uncommon', weight: 30 },
            { tagId: 'rare', weight: 15 },
            { tagId: 'epic', weight: 5 }
        ]
    },
    {
        id: 'silver', name: 'Silver Case', cost: 200, color: '#c0c0c0', icon: '🥈',
        pool: [
            { tagId: 'uncommon', weight: 40 },
            { tagId: 'rare', weight: 30 },
            { tagId: 'epic', weight: 20 },
            { tagId: 'legendary', weight: 10 }
        ]
    },
    {
        id: 'gold', name: 'Gold Case', cost: 500, color: '#ffa502', icon: '🥇',
        pool: [
            { tagId: 'rare', weight: 30 },
            { tagId: 'epic', weight: 30 },
            { tagId: 'legendary', weight: 25 },
            { tagId: 'mythic', weight: 15 }
        ]
    },
    {
        id: 'diamond', name: 'Diamond Case', cost: 2000, color: '#00d2ff', icon: '💎',
        pool: [
            { tagId: 'epic', weight: 20 },
            { tagId: 'legendary', weight: 30 },
            { tagId: 'mythic', weight: 25 },
            { tagId: 'divine', weight: 20 },
            { tagId: 'astral', weight: 5 }
        ]
    },
    {
        id: 'cosmic', name: 'Cosmic Case', cost: 5000, color: '#8e44ad', icon: '🌌',
        pool: [
            { tagId: 'legendary', weight: 15 },
            { tagId: 'mythic', weight: 25 },
            { tagId: 'divine', weight: 35 },
            { tagId: 'astral', weight: 25 }
        ]
    }
];

let selectedCaseTier = 'bronze';
let caseMode = 'pvp';
let caseSpinning = false;
let myOpenBattleId = null;

function getTagById(id) {
    return CASE_EXCLUSIVE_TAGS.find(t => t.id === id) || { id, name: id, color: '#888', value: 0 };
}

function getTagFromSeed(seed, tierId) {
    const tier = CASE_TIERS.find(t => t.id === tierId);
    if (!tier) return getTagById('common');
    const pool = tier.pool;
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    let threshold = seed * totalWeight;
    for (const entry of pool) {
        threshold -= entry.weight;
        if (threshold <= 0) return getTagById(entry.tagId);
    }
    return getTagById(pool[pool.length - 1].tagId);
}

function getRandomTagForTier(tierId) {
    return getTagFromSeed(Math.random(), tierId);
}

function initCasePage() {
    renderCaseTiers();
    setCaseMode('pvp');
    if (socket && socket.connected) {
        socket.emit('case_request_lobbies');
    }
}

function renderCaseTiers() {
    const container = document.getElementById('caseTiersGrid');
    if (!container) return;
    container.innerHTML = CASE_TIERS.map(tier => `
        <div class="case-tier-card ${selectedCaseTier === tier.id ? 'selected' : ''}" onclick="selectCaseTier('${tier.id}')" style="border-color:${selectedCaseTier === tier.id ? tier.color : 'var(--border-color)'};">
            <div class="case-tier-icon">${tier.icon}</div>
            <div class="case-tier-name">${tier.name}</div>
            <div class="case-tier-cost">${tier.cost} Astraphobia</div>
        </div>
    `).join('');
}

function selectCaseTier(tierId) {
    selectedCaseTier = tierId;
    renderCaseTiers();
}

function setCaseMode(mode) {
    caseMode = mode;
    document.getElementById('caseModeBtn_pvp').className = 'case-mode-btn' + (mode === 'pvp' ? ' active' : '');
    document.getElementById('caseModeBtn_bot').className = 'case-mode-btn' + (mode === 'bot' ? ' active' : '');
    document.getElementById('casePvpSection').style.display = mode === 'pvp' ? 'block' : 'none';
    document.getElementById('caseBotSection').style.display = mode === 'bot' ? 'block' : 'none';
    document.getElementById('caseBattleArea').style.display = 'none';
}

// === PVP LOBBY ===
function createCaseBattle() {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    if (myOpenBattleId) { showToast('You already have an open battle', 'warning'); return; }
    const tier = CASE_TIERS.find(t => t.id === selectedCaseTier);
    if (!tier) return;
    if (userBalance < tier.cost) { showToast('Insufficient balance', 'error'); return; }

    updateBalance(userBalance - tier.cost);
    playBetSound();

    socket.emit('case_create', {
        username: userProfile.username,
        userId: currentUser.id,
        caseTier: tier.id,
        cost: tier.cost
    });

    document.getElementById('caseCreateBtn').style.display = 'none';
    document.getElementById('caseCancelBtn').style.display = 'inline-flex';
    document.getElementById('caseWaiting').style.display = 'flex';
}

function cancelCaseBattle() {
    if (!myOpenBattleId) return;
    const tier = CASE_TIERS.find(t => t.id === selectedCaseTier);
    if (tier) updateBalance(userBalance + tier.cost);

    socket.emit('case_cancel', { oduserId: currentUser.id });
    myOpenBattleId = null;

    document.getElementById('caseCreateBtn').style.display = 'inline-flex';
    document.getElementById('caseCancelBtn').style.display = 'none';
    document.getElementById('caseWaiting').style.display = 'none';
    showToast('Battle cancelled, cost refunded', 'info');
}

function joinCaseBattle(battleId, cost) {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    if (userBalance < cost) { showToast('Insufficient balance', 'error'); return; }

    updateBalance(userBalance - cost);
    playBetSound();

    socket.emit('case_join', {
        battleId: battleId,
        username: userProfile.username,
        userId: currentUser.id
    });
}

function renderLobby(battles) {
    const list = document.getElementById('caseLobbyList');
    if (!list) return;

    const myId = currentUser ? currentUser.id : null;
    const openBattles = battles.filter(b => b.creatorId !== myId);

    // Track my open battle
    const myBattle = battles.find(b => b.creatorId === myId);
    if (myBattle) {
        myOpenBattleId = myBattle.id;
        document.getElementById('caseCreateBtn').style.display = 'none';
        document.getElementById('caseCancelBtn').style.display = 'inline-flex';
        document.getElementById('caseWaiting').style.display = 'flex';
    } else {
        if (myOpenBattleId) {
            // Battle was taken or cancelled
            myOpenBattleId = null;
            document.getElementById('caseCreateBtn').style.display = 'inline-flex';
            document.getElementById('caseCancelBtn').style.display = 'none';
            document.getElementById('caseWaiting').style.display = 'none';
        }
    }

    if (openBattles.length === 0) {
        list.innerHTML = '<div class="loading">No open battles. Create one or play vs Bot!</div>';
        return;
    }

    list.innerHTML = openBattles.map(b => {
        const tier = CASE_TIERS.find(t => t.id === b.caseTier);
        return `<div class="case-lobby-row">
            <div class="case-lobby-info">
                <span class="case-lobby-creator">${escapeHtml(b.creator)}</span>
                <span class="case-lobby-tier" style="color:${tier?.color || '#fff'}">${tier?.icon || ''} ${tier?.name || b.caseTier}</span>
            </div>
            <div class="case-lobby-cost">${b.cost} Astraphobia</div>
            <button class="btn btn-primary btn-sm" onclick="joinCaseBattle('${b.id}',${b.cost})">Join Battle</button>
        </div>`;
    }).join('');
}

// === BOT MODE ===
function startBotBattle() {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    if (caseSpinning) return;
    const tier = CASE_TIERS.find(t => t.id === selectedCaseTier);
    if (!tier) return;
    if (userBalance < tier.cost) { showToast('Insufficient balance', 'error'); return; }

    updateBalance(userBalance - tier.cost);
    totalWagered += tier.cost;
    playBetSound();

    const tag1 = getRandomTagForTier(tier.id);
    const tag2 = getRandomTagForTier(tier.id);

    runBattleAnimation(userProfile.username, 'Bot', tag1, tag2, tier.id, true);
}

// === BATTLE ANIMATION ===
function runBattleAnimation(p1Name, p2Name, tag1, tag2, tierId, iAmPlayer1) {
    caseSpinning = true;
    const area = document.getElementById('caseBattleArea');
    area.style.display = 'block';
    document.getElementById('casePvpSection').style.display = 'none';
    document.getElementById('caseBotSection').style.display = 'none';

    document.getElementById('caseP1Name').textContent = p1Name;
    document.getElementById('caseP2Name').textContent = p2Name;
    document.getElementById('caseBattleOutcome').textContent = '';
    document.getElementById('caseResultLeft').innerHTML = '';
    document.getElementById('caseResultRight').innerHTML = '';

    buildSpinReel('caseReelLeft', tag1, tierId);
    buildSpinReel('caseReelRight', tag2, tierId);

    setTimeout(async () => {
        document.getElementById('caseResultLeft').innerHTML = `<div class="case-final-tag" style="color:${tag1.color};border-color:${tag1.color};">${tag1.name} (${tag1.value})</div>`;
        document.getElementById('caseResultRight').innerHTML = `<div class="case-final-tag" style="color:${tag2.color};border-color:${tag2.color};">${tag2.name} (${tag2.value})</div>`;

        const outcomeEl = document.getElementById('caseBattleOutcome');
        const iWon = (iAmPlayer1 && tag1.value >= tag2.value) || (!iAmPlayer1 && tag2.value >= tag1.value);

        if (iWon) {
            playCashoutSound();
            outcomeEl.innerHTML = `<span class="case-win">🎉 YOU WIN! You get both tags!</span>`;
            await addToInventory(tag1);
            await addToInventory(tag2);
            totalWins++;
            showToast(`Won! Got ${tag1.name} + ${tag2.name}!`, 'success');
        } else {
            outcomeEl.innerHTML = `<span class="case-lose">💀 You lost! Opponent takes everything.</span>`;
            showToast(`Lost the case battle!`, 'error');
        }

        caseSpinning = false;
        setTimeout(() => {
            setCaseMode(caseMode);
        }, 4000);
    }, 3800);
}

function buildSpinReel(reelId, finalTag, tierId) {
    const reel = document.getElementById(reelId);
    if (!reel) return;
    let html = '';
    for (let i = 0; i < 28; i++) {
        const t = getRandomTagForTier(tierId);
        html += `<div class="case-tag-item" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}60;">${t.name}<span class="case-tag-val">${t.value}</span></div>`;
    }
    html += `<div class="case-tag-item case-tag-final" style="background:${finalTag.color}20;color:${finalTag.color};border:2px solid ${finalTag.color};">${finalTag.name}<span class="case-tag-val">${finalTag.value}</span></div>`;
    for (let i = 0; i < 4; i++) {
        const t = getRandomTagForTier(tierId);
        html += `<div class="case-tag-item" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}60;">${t.name}<span class="case-tag-val">${t.value}</span></div>`;
    }
    reel.innerHTML = html;
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0px)';
    reel.offsetHeight;
    const itemH = 58;
    setTimeout(() => {
        reel.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.6, 0.15, 1)';
        reel.style.transform = `translateY(${-(28 * itemH)}px)`;
    }, 100);
}

async function addToInventory(tag) {
    if (!currentUser || !userProfile) return;
    const inventory = userProfile.inventory || [];
    inventory.push({
        id: tag.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        tagId: tag.id,
        name: tag.name,
        value: tag.value,
        color: tag.color,
        wonAt: new Date().toISOString()
    });
    userProfile.inventory = inventory;
    try {
        await supabase.update('profiles', { inventory }, `id=eq.${currentUser.id}`);
    } catch (e) { console.error('Inventory save error:', e); }
}

// === SOCKET LISTENERS ===
function initCaseSockets() {
    if (!socket) return;

    socket.on('case_lobbies', (battles) => {
        renderLobby(battles);
    });

    socket.on('case_battle_go', (data) => {
        myOpenBattleId = null;
        document.getElementById('caseCreateBtn').style.display = 'inline-flex';
        document.getElementById('caseCancelBtn').style.display = 'none';
        document.getElementById('caseWaiting').style.display = 'none';

        const tag1 = getTagFromSeed(data.seed1, data.caseTier);
        const tag2 = getTagFromSeed(data.seed2, data.caseTier);
        const iAmP1 = currentUser && currentUser.id === data.player1.id;

        navigateTo('cases');
        runBattleAnimation(
            data.player1.username, data.player2.username,
            tag1, tag2, data.caseTier, iAmP1
        );
    });

    socket.on('case_error', (msg) => {
        showToast(msg, 'error');
    });

    socket.on('case_battle_cancelled', (data) => {
        if (data.battleId === myOpenBattleId) {
            const tier = CASE_TIERS.find(t => t.id === selectedCaseTier);
            if (tier) updateBalance(userBalance + tier.cost);
            myOpenBattleId = null;
            showToast('Your battle was cancelled', 'info');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCaseSockets, 1200);
});
