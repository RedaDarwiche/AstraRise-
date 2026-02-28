// Case Battle System - Multiplayer via Socket.io + Bot fallback + Case Tiers
const CASE_TAGS = [
    { id: 'common_tag', name: 'Common', value: 10, color: '#888888', rarity: 40 },
    { id: 'uncommon_tag', name: 'Uncommon', value: 25, color: '#4cd137', rarity: 25 },
    { id: 'rare_tag', name: 'Rare', value: 60, color: '#00a8ff', rarity: 15 },
    { id: 'epic_tag', name: 'Epic', value: 150, color: '#e056fd', rarity: 10 },
    { id: 'legendary_tag', name: 'Legendary', value: 400, color: '#e84393', rarity: 5 },
    { id: 'mythic_tag', name: 'Mythic', value: 800, color: '#ffa502', rarity: 3 },
    { id: 'divine_tag', name: 'Divine', value: 2000, color: '#ff4757', rarity: 1.5 },
    { id: 'astral_tag', name: 'Astral', value: 5000, color: '#6c5ce7', rarity: 0.5 }
];

const CASE_TIERS = [
    { id: 'starter', name: '🟢 Starter Case', cost: 50, tags: ['common_tag', 'uncommon_tag', 'rare_tag'] },
    { id: 'mid', name: '🔵 Mid-Tier Case', cost: 200, tags: ['uncommon_tag', 'rare_tag', 'epic_tag', 'legendary_tag'] },
    { id: 'premium', name: '🟣 Premium Case', cost: 500, tags: ['rare_tag', 'epic_tag', 'legendary_tag', 'mythic_tag'] },
    { id: 'ultra', name: '🔴 Ultra Case', cost: 1500, tags: ['epic_tag', 'legendary_tag', 'mythic_tag', 'divine_tag'] },
    { id: 'astral', name: '⭐ Astral Case', cost: 5000, tags: ['legendary_tag', 'mythic_tag', 'divine_tag', 'astral_tag'] }
];

let caseSpinning = false;
let caseLobbyList = [];
let myActiveLobby = null;
let caseSocketInit = false;

function getRandomTagFromPool(tagIds) {
    const pool = CASE_TAGS.filter(t => tagIds.includes(t.id));
    if (pool.length === 0) return CASE_TAGS[0];
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

function renderCaseSelect() {
    const sel = document.getElementById('caseSelect');
    if (!sel) return;
    sel.innerHTML = CASE_TIERS.map(t =>
        `<option value="${t.id}">${t.name} — ${t.cost} Astraphobia</option>`
    ).join('');
}

function initCaseBattleSocket() {
    if (caseSocketInit || !socket) return;
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
                    <span class="case-lobby-cost">${tierInfo.cost} each</span>
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

        leftResult.innerHTML = `<div class="case-final-tag" style="color:${p1Tag.color};border-color:${p1Tag.color};">${p1Tag.name} (${p1Tag.value})</div>`;
        rightResult.innerHTML = `<div class="case-final-tag" style="color:${p2Tag.color};border-color:${p2Tag.color};">${p2Tag.name} (${p2Tag.value})</div>`;

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

    let html = '';
    for (let i = 0; i < 30; i++) {
        const t = getRandomTagFromPool(pool);
        html += `<div class="case-tag-item" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}60;">${t.name}<span class="case-tag-val">${t.value}</span></div>`;
    }
    html += `<div class="case-tag-item case-tag-final" style="background:${finalTag.color}20;color:${finalTag.color};border:2px solid ${finalTag.color};">${finalTag.name}<span class="case-tag-val">${finalTag.value}</span></div>`;
    for (let i = 0; i < 5; i++) {
        const t = getRandomTagFromPool(pool);
        html += `<div class="case-tag-item" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}60;">${t.name}<span class="case-tag-val">${t.value}</span></div>`;
    }

    reel.innerHTML = html;
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0px)';
    reel.offsetHeight;

    const itemHeight = 60;
    const targetY = -(30 * itemHeight);
    setTimeout(() => {
        reel.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.6, 0.15, 1)';
        reel.style.transform = `translateY(${targetY}px)`;
    }, 100);
}

async function addToInventory(tag) {
    if (!currentUser || !userProfile) return;

    const inventory = userProfile.inventory || [];
    inventory.push({
        id: tag.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
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
    } catch(e) {
        console.error('Inventory update error:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        renderCaseSelect();
        if (socket && socket.connected !== undefined) initCaseBattleSocket();
    }, 1500);
});
