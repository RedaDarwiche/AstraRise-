// Case Battle System - Multiplayer via Socket.io + Bot fallback + Case Tiers
const CASE_TAGS = [
    { id: 'common_tag', name: 'Common', value: 10, color: '#888888', rarity: 40 },
    { id: 'uncommon_tag', name: 'Uncommon', value: 25, color: '#4cd137', rarity: 25 },
    { id: 'rare_tag', name: 'Rare', value: 60, color: '#00a8ff', rarity: 15 },
    { id: 'epic_tag', name: 'Epic', value: 150, color: '#e056fd', rarity: 10 },
    { id: 'legendary_tag', name: 'Legendary', value: 400, color: '#e84393', rarity: 5 },
    { id: 'mythic_tag', name: 'Mythic', value: 800, color: '#ffa502', rarity: 3 },
    { id: 'divine_tag', name: 'Divine', value: 2000, color: '#ff4757', rarity: 1.5 },
    { id: 'astral_tag', name: 'Astral', value: 5000, color: '#6c5ce7', rarity: 0.5 },
    { id: 'celestial_tag', name: 'Celestial', value: 12000, color: '#00cec9', rarity: 0.3 },
    { id: 'transcendent_tag', name: 'Transcendent', value: 30000, color: '#fd79a8', rarity: 0.15 },
    { id: 'eternal_tag', name: 'Eternal', value: 75000, color: '#e17055', rarity: 0.08 },
    { id: 'godlike_tag', name: 'Godlike', value: 200000, color: '#d63031', rarity: 0.04 },
    { id: 'omega_tag', name: 'Omega', value: 500000, color: '#fdcb6e', rarity: 0.02 },
    { id: 'infinity_tag', name: 'Infinity', value: 1500000, color: '#00b894', rarity: 0.01 },
    { id: 'void_tag', name: 'Void', value: 5000000, color: '#2d3436', rarity: 0.005 },
    { id: 'astra_supreme_tag', name: 'Astra Supreme', value: 20000000, color: '#ff0066', rarity: 0.002 }
];

const CASE_TIERS = [
    { id: 'basic', name: '⚪ Basic Case', cost: 100, tags: ['common_tag', 'uncommon_tag'] },
    { id: 'starter', name: '🟢 Starter Case', cost: 250, tags: ['common_tag', 'uncommon_tag', 'rare_tag'] },
    { id: 'mid', name: '🔵 Mid-Tier Case', cost: 500, tags: ['uncommon_tag', 'rare_tag', 'epic_tag', 'legendary_tag'] },
    { id: 'astraphobia1k', name: '🟡 Astraphobia 1K', cost: 1000, tags: ['rare_tag', 'epic_tag', 'legendary_tag', 'mythic_tag'] },
    { id: 'premium', name: '🟣 Premium Case', cost: 2500, tags: ['epic_tag', 'legendary_tag', 'mythic_tag', 'divine_tag'] },
    { id: 'ultra', name: '🔴 Ultra Case', cost: 5000, tags: ['legendary_tag', 'mythic_tag', 'divine_tag', 'astral_tag'] },
    { id: 'astral', name: '⭐ Astral Case', cost: 10000, tags: ['mythic_tag', 'divine_tag', 'astral_tag', 'celestial_tag'] },
    { id: 'astraphobia25k', name: '💎 Astraphobia 25K', cost: 25000, tags: ['divine_tag', 'astral_tag', 'celestial_tag', 'transcendent_tag'] },
    { id: 'astraphobia50k', name: '🌟 Astraphobia 50K', cost: 50000, tags: ['astral_tag', 'celestial_tag', 'transcendent_tag', 'eternal_tag'] },
    { id: 'astraphobia100k', name: '🔥 Astraphobia 100K', cost: 100000, tags: ['celestial_tag', 'transcendent_tag', 'eternal_tag', 'godlike_tag'] },
    { id: 'astraphobia250k', name: '⚡ Astraphobia 250K', cost: 250000, tags: ['transcendent_tag', 'eternal_tag', 'godlike_tag', 'omega_tag'] },
    { id: 'astraphobia500k', name: '💫 Astraphobia 500K', cost: 500000, tags: ['eternal_tag', 'godlike_tag', 'omega_tag', 'infinity_tag'] },
    { id: 'astraphobia1m', name: '🏆 Astraphobia 1M', cost: 1000000, tags: ['godlike_tag', 'omega_tag', 'infinity_tag', 'void_tag'] },
    { id: 'astraphobia10m', name: '👑 Astraphobia 10M', cost: 10000000, tags: ['omega_tag', 'infinity_tag', 'void_tag', 'astra_supreme_tag'] },
    { id: 'astraphobia100m', name: '🌌 Astraphobia 100M', cost: 100000000, tags: ['infinity_tag', 'void_tag', 'astra_supreme_tag'] },
    { id: 'astraphobia1b', name: '♾️ Astraphobia 1B', cost: 1000000000, tags: ['void_tag', 'astra_supreme_tag'] }
];

let caseSpinning = false;
let caseLobbyList = [];
let myActiveLobby = null;
let caseSocketInit = false;

function getRandomTagFromPool(tagIds) {
    const pool = CASE_TAGS.filter(t => tagIds.includes(t.id));
    if (pool.length === 0) return { ...CASE_TAGS[0] };
    const totalWeight = pool.reduce((s, t) => s + t.rarity, 0);
    let rand = Math.random() * totalWeight;
    for (const tag of pool) {
        rand -= tag.rarity;
        if (rand <= 0) return { ...tag };
    }
    return { ...pool[0] };
}

function getSelectedCaseTier() {
    const sel = document.getElementById('caseSelect');
    if (!sel) return CASE_TIERS[0];
    return CASE_TIERS.find(t => t.id === sel.value) || CASE_TIERS[0];
}

function formatCaseCost(cost) {
    if (cost >= 1000000000) return (cost / 1000000000).toFixed(0) + 'B';
    if (cost >= 1000000) return (cost / 1000000).toFixed(0) + 'M';
    if (cost >= 1000) return (cost / 1000).toFixed(0) + 'K';
    return cost.toString();
}

function renderCaseSelect() {
    const sel = document.getElementById('caseSelect');
    if (!sel) return;
    sel.innerHTML = CASE_TIERS.map(t =>
        `<option value="${t.id}">${t.name} — ${formatCaseCost(t.cost)} Astraphobia</option>`
    ).join('');
}

function initCaseBattleSocket() {
    if (caseSocketInit || typeof socket === 'undefined' || !socket) return;
    caseSocketInit = true;

    socket.on('case_lobby_list', (lobbies) => {
        caseLobbyList = lobbies;
        renderCaseLobbies();
    });

    socket.on('case_lobby_created', (lobby) => {
        if (!caseLobbyList.find(l => l.id === lobby.id)) {
            caseLobbyList.push(lobby);
        }
        renderCaseLobbies();
        if (lobby.creatorId === currentUser?.id) {
            myActiveLobby = lobby.id;
            document.getElementById('caseStartBtn').textContent = 'Waiting for opponent...';
            document.getElementById('caseStartBtn').disabled = true;
            document.getElementById('caseBotBtn').disabled = false;
        }
    });

    socket.on('case_lobby_removed', (lobbyId) => {
        caseLobbyList = caseLobbyList.filter(l => l.id !== lobbyId);
        if (myActiveLobby === lobbyId) myActiveLobby = null;
        renderCaseLobbies();
    });

    socket.on('case_battle_start', (data) => {
        if (data.player1Id === currentUser?.id || data.player2Id === currentUser?.id) {
            runCaseBattleAnimation(data);
        }
        caseLobbyList = caseLobbyList.filter(l => l.id !== data.lobbyId);
        renderCaseLobbies();
    });

    socket.emit('case_get_lobbies');
}

function renderCaseLobbies() {
    const container = document.getElementById('caseLobbies');
    if (!container) return;

    if (caseLobbyList.length === 0) {
        container.innerHTML = '<div class="loading" style="padding:12px;">No open battles. Create one!</div>';
        return;
    }

    let html = '';
    caseLobbyList.forEach(lobby => {
        const isMyLobby = currentUser && lobby.creatorId === currentUser.id;
        const tierInfo = CASE_TIERS.find(t => t.id === lobby.caseId) || CASE_TIERS[0];
        html += `
            <div class="case-lobby-row ${isMyLobby ? 'my-lobby' : ''}">
                <div class="case-lobby-info">
                    <span class="case-lobby-user">${escapeHtml(lobby.creatorName)}</span>
                    <span class="case-lobby-case">${tierInfo.name}</span>
                    <span class="case-lobby-cost">${formatCaseCost(tierInfo.cost)} each</span>
                </div>
                ${isMyLobby ? 
                    '<button class="btn btn-sm btn-danger" onclick="cancelMyLobby()">Cancel</button>' :
                    `<button class="btn btn-sm btn-primary" onclick="joinCaseLobby('${lobby.id}')">Join Battle</button>`
                }
            </div>
        `;
    });
    container.innerHTML = html;
}

function createCaseBattle() {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    if (myActiveLobby) { showToast('You already have an open battle', 'warning'); return; }

    const tier = getSelectedCaseTier();
    if (userBalance < tier.cost) { showToast('Insufficient balance for ' + tier.name, 'error'); return; }

    socket.emit('case_create_lobby', {
        creatorId: currentUser.id,
        creatorName: userProfile?.username || 'Player',
        caseId: tier.id,
        cost: tier.cost
    });
}

function cancelMyLobby() {
    if (!myActiveLobby) return;
    socket.emit('case_cancel_lobby', { lobbyId: myActiveLobby });
    myActiveLobby = null;
    document.getElementById('caseStartBtn').textContent = 'Create Battle';
    document.getElementById('caseStartBtn').disabled = false;
    document.getElementById('caseBotBtn').disabled = true;
}

async function joinCaseLobby(lobbyId) {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    const lobby = caseLobbyList.find(l => l.id === lobbyId);
    if (!lobby) { showToast('Lobby no longer exists', 'error'); return; }

    const tier = CASE_TIERS.find(t => t.id === lobby.caseId) || CASE_TIERS[0];
    if (userBalance < tier.cost) { showToast('Insufficient balance', 'error'); return; }

    socket.emit('case_join_lobby', {
        lobbyId: lobbyId,
        joinerId: currentUser.id,
        joinerName: userProfile?.username || 'Player'
    });
}

function playVsBot() {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    if (!myActiveLobby) { showToast('Create a battle first', 'error'); return; }

    socket.emit('case_bot_join', { lobbyId: myActiveLobby });
}

async function runCaseBattleAnimation(data) {
    caseSpinning = true;
    const isPlayer1 = data.player1Id === currentUser?.id;
    const isPlayer2 = data.player2Id === currentUser?.id;

    if (!isPlayer1 && !isPlayer2) return;

    const tier = CASE_TIERS.find(t => t.id === data.caseId) || CASE_TIERS[0];

    if (isPlayer1 || isPlayer2) {
        await updateBalance(userBalance - tier.cost);
        totalWagered += tier.cost;
    }

    playBetSound();

    document.getElementById('caseBattleResult').textContent = '';
    document.getElementById('caseResultLeft').innerHTML = '';
    document.getElementById('caseResultRight').innerHTML = '';

    const p1Tag = CASE_TAGS.find(t => t.id === data.player1TagId) || CASE_TAGS[0];
    const p2Tag = CASE_TAGS.find(t => t.id === data.player2TagId) || CASE_TAGS[0];

    document.getElementById('casePlayerLeftName').textContent = data.player1Name;
    document.getElementById('casePlayerRightName').textContent = data.player2Name;

    buildSpinReel('caseReelLeft', p1Tag, tier.tags);
    buildSpinReel('caseReelRight', p2Tag, tier.tags);

    document.getElementById('caseStartBtn').disabled = true;
    document.getElementById('caseBotBtn').disabled = true;

    setTimeout(async () => {
        const resultEl = document.getElementById('caseBattleResult');
        const leftResult = document.getElementById('caseResultLeft');
        const rightResult = document.getElementById('caseResultRight');

        leftResult.innerHTML = `<div class="case-final-tag" style="color:${p1Tag.color};border-color:${p1Tag.color};">${p1Tag.name} (${p1Tag.value.toLocaleString()})</div>`;
        rightResult.innerHTML = `<div class="case-final-tag" style="color:${p2Tag.color};border-color:${p2Tag.color};">${p2Tag.name} (${p2Tag.value.toLocaleString()})</div>`;

        const iWin = (isPlayer1 && p1Tag.value >= p2Tag.value) || (isPlayer2 && p2Tag.value > p1Tag.value);

        if (iWin) {
            playCashoutSound();
            resultEl.innerHTML = `<span class="case-win">🎉 YOU WIN! You get both tags!</span>`;
            await addToInventory(p1Tag);
            await addToInventory(p2Tag);
            totalWins++;
            showToast(`Won! Got ${p1Tag.name} + ${p2Tag.name}!`, 'success');
        } else {
            resultEl.innerHTML = `<span class="case-lose">💀 You lost! Opponent takes everything.</span>`;
            showToast('Lost the case battle!', 'error');
        }

        caseSpinning = false;
        myActiveLobby = null;
        document.getElementById('caseStartBtn').textContent = 'Create Battle';
        document.getElementById('caseStartBtn').disabled = false;
        document.getElementById('caseBotBtn').disabled = true;
    }, 4000);
}

function buildSpinReel(reelId, finalTag, poolIds) {
    const reel = document.getElementById(reelId);
    if (!reel) return;

    const pool = poolIds || CASE_TAGS.map(t => t.id);
    const itemHeight = 60;
    const totalFakeItems = 40;

    let html = '';
    for (let i = 0; i < totalFakeItems; i++) {
        const t = getRandomTagFromPool(pool);
        html += `<div class="case-reel-item" style="background:${t.color}15;color:${t.color};border-bottom:1px solid ${t.color}30;">
            <span class="case-reel-name">${t.name}</span>
            <span class="case-reel-val">${t.value.toLocaleString()}</span>
        </div>`;
    }
    // The winning item
    html += `<div class="case-reel-item case-reel-winner" style="background:${finalTag.color}25;color:${finalTag.color};border:2px solid ${finalTag.color};">
        <span class="case-reel-name">${finalTag.name}</span>
        <span class="case-reel-val">${finalTag.value.toLocaleString()}</span>
    </div>`;
    // Extra items after winner
    for (let i = 0; i < 5; i++) {
        const t = getRandomTagFromPool(pool);
        html += `<div class="case-reel-item" style="background:${t.color}15;color:${t.color};border-bottom:1px solid ${t.color}30;">
            <span class="case-reel-name">${t.name}</span>
            <span class="case-reel-val">${t.value.toLocaleString()}</span>
        </div>`;
    }

    reel.innerHTML = html;
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0px)';
    void reel.offsetHeight;

    const targetY = -(totalFakeItems * itemHeight);
    setTimeout(() => {
        reel.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.6, 0.15, 1)';
        reel.style.transform = `translateY(${targetY}px)`;
    }, 50);
}

async function addToInventory(tag) {
    if (!currentUser || !userProfile) return;

    const inventory = userProfile.inventory || [];
    inventory.push({
        id: tag.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        tagId: tag.id,
        name: tag.name,
        value: tag.value,
        color: tag.color,
        wonAt: new Date().toISOString()
    });

    userProfile.inventory = inventory;

    try {
        await supabase.update('profiles',
            { inventory: inventory },
            `id=eq.${currentUser.id}`
        );
    } catch (e) {
        console.error('Inventory update error:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        renderCaseSelect();
        if (typeof socket !== 'undefined' && socket) initCaseBattleSocket();
    }, 1500);
});
