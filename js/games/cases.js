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
    { id: 'hunter', name: '🏹 Hunter Case', cost: 1000, tags: ['rare_tag', 'epic_tag', 'legendary_tag', 'mythic_tag'] },
    { id: 'premium', name: '🟣 Premium Case', cost: 2500, tags: ['epic_tag', 'legendary_tag', 'mythic_tag', 'divine_tag'] },
    { id: 'ultra', name: '🔴 Ultra Case', cost: 5000, tags: ['legendary_tag', 'mythic_tag', 'divine_tag', 'astral_tag'] },
    { id: 'astral', name: '⭐ Astral Case', cost: 10000, tags: ['mythic_tag', 'divine_tag', 'astral_tag', 'celestial_tag'] },
    { id: 'phantom', name: '👻 Phantom Case', cost: 25000, tags: ['divine_tag', 'astral_tag', 'celestial_tag', 'transcendent_tag'] },
    { id: 'eclipse', name: '🌑 Eclipse Case', cost: 50000, tags: ['astral_tag', 'celestial_tag', 'transcendent_tag', 'eternal_tag'] },
    { id: 'inferno', name: '🔥 Inferno Case', cost: 100000, tags: ['celestial_tag', 'transcendent_tag', 'eternal_tag', 'godlike_tag'] },
    { id: 'tempest', name: '⚡ Tempest Case', cost: 250000, tags: ['transcendent_tag', 'eternal_tag', 'godlike_tag', 'omega_tag'] },
    { id: 'nebula', name: '💫 Nebula Case', cost: 500000, tags: ['eternal_tag', 'godlike_tag', 'omega_tag', 'infinity_tag'] },
    { id: 'sovereign', name: '🏆 Sovereign Case', cost: 1000000, tags: ['godlike_tag', 'omega_tag', 'infinity_tag', 'void_tag'] },
    { id: 'oblivion', name: '👑 Oblivion Case', cost: 10000000, tags: ['omega_tag', 'infinity_tag', 'void_tag', 'astra_supreme_tag'] },
    { id: 'singularity', name: '🌌 Singularity Case', cost: 100000000, tags: ['infinity_tag', 'void_tag', 'astra_supreme_tag'] },
    { id: 'genesis', name: '♾️ Genesis Case', cost: 1000000000, tags: ['void_tag', 'astra_supreme_tag'] }
];

let caseSpinning = false, caseLobbyList = [], myActiveLobby = null, caseSocketInit = false;

function getRandomTagFromPool(tagIds) {
    const pool = CASE_TAGS.filter(t => tagIds.includes(t.id));
    if (!pool.length) return { ...CASE_TAGS[0] };
    const total = pool.reduce((s, t) => s + t.rarity, 0);
    let r = Math.random() * total;
    for (const t of pool) { r -= t.rarity; if (r <= 0) return { ...t }; }
    return { ...pool[0] };
}

function getSelectedCaseTier() {
    const sel = document.getElementById('caseSelect');
    return sel ? (CASE_TIERS.find(t => t.id === sel.value) || CASE_TIERS[0]) : CASE_TIERS[0];
}

function formatCaseCost(c) { if(c>=1e9)return(c/1e9).toFixed(0)+'B';if(c>=1e6)return(c/1e6).toFixed(0)+'M';if(c>=1e3)return(c/1e3).toFixed(0)+'K';return c.toString(); }

function renderCaseSelect() {
    const sel = document.getElementById('caseSelect');
    if (!sel) return;
    sel.innerHTML = CASE_TIERS.map(t => `<option value="${t.id}">${t.name} — ${formatCaseCost(t.cost)} Astraphobia</option>`).join('');
}

function getMyRankForBattle() { return typeof getEquippedRank === 'function' ? getEquippedRank() : null; }

function renderPlayerNameWithTag(name, rankId) {
    let html = escapeHtml(name);
    if (rankId && typeof getRankTagHTML === 'function') html = getRankTagHTML(false, rankId) + ' ' + html;
    return html;
}

function initCaseBattleSocket() {
    if (caseSocketInit || typeof socket === 'undefined' || !socket) return;
    caseSocketInit = true;
    socket.on('case_lobby_list', (l) => { caseLobbyList = l; renderCaseLobbies(); });
    socket.on('case_lobby_created', (lobby) => {
        if (!caseLobbyList.find(l => l.id === lobby.id)) caseLobbyList.push(lobby);
        renderCaseLobbies();
        if (lobby.creatorId === currentUser?.id) {
            myActiveLobby = lobby.id;
            document.getElementById('caseStartBtn').textContent = 'Waiting...';
            document.getElementById('caseStartBtn').disabled = true;
            document.getElementById('caseBotBtn').disabled = false;
        }
    });
    socket.on('case_lobby_removed', (id) => { caseLobbyList = caseLobbyList.filter(l => l.id !== id); if (myActiveLobby === id) myActiveLobby = null; renderCaseLobbies(); });
    socket.on('case_battle_start', (data) => {
        if (data.player1Id === currentUser?.id || data.player2Id === currentUser?.id) runCaseBattleAnimation(data);
        caseLobbyList = caseLobbyList.filter(l => l.id !== data.lobbyId);
        renderCaseLobbies();
    });
    socket.emit('case_get_lobbies');
}

function renderCaseLobbies() {
    const c = document.getElementById('caseLobbies');
    if (!c) return;
    if (!caseLobbyList.length) { c.innerHTML = '<div class="loading" style="padding:12px;">No open battles. Create one!</div>'; return; }
    c.innerHTML = caseLobbyList.map(lobby => {
        const mine = currentUser && lobby.creatorId === currentUser.id;
        const tier = CASE_TIERS.find(t => t.id === lobby.caseId) || CASE_TIERS[0];
        return `<div class="case-lobby-row ${mine?'my-lobby':''}"><div class="case-lobby-info"><span class="case-lobby-user">${escapeHtml(lobby.creatorName)}</span><span class="case-lobby-case">${tier.name}</span><span class="case-lobby-cost">${formatCaseCost(tier.cost)} each</span></div>${mine?'<button class="btn btn-sm btn-danger" onclick="cancelMyLobby()">Cancel</button>':`<button class="btn btn-sm btn-primary" onclick="joinCaseLobby('${lobby.id}')">Join</button>`}</div>`;
    }).join('');
}

function createCaseBattle() {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    if (myActiveLobby) { showToast('Already have battle', 'warning'); return; }
    if (!canPlaceBet()) return;
    const tier = getSelectedCaseTier();
    if (userBalance < tier.cost) { showToast('Insufficient balance', 'error'); return; }
    socket.emit('case_create_lobby', { creatorId: currentUser.id, creatorName: userProfile?.username || 'Player', creatorRank: getMyRankForBattle(), caseId: tier.id, cost: tier.cost });
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
    if (!currentUser) { showToast('Login', 'error'); return; }
    if (!canPlaceBet()) return;
    const lobby = caseLobbyList.find(l => l.id === lobbyId);
    if (!lobby) { showToast('Gone', 'error'); return; }
    const tier = CASE_TIERS.find(t => t.id === lobby.caseId) || CASE_TIERS[0];
    if (userBalance < tier.cost) { showToast('Insufficient balance', 'error'); return; }
    socket.emit('case_join_lobby', { lobbyId, joinerId: currentUser.id, joinerName: userProfile?.username || 'Player', joinerRank: getMyRankForBattle() });
}

function playVsBot() {
    if (!currentUser) { showToast('Login', 'error'); return; }
    if (!myActiveLobby) { showToast('Create first', 'error'); return; }
    socket.emit('case_bot_join', { lobbyId: myActiveLobby });
}

async function runCaseBattleAnimation(data) {
    caseSpinning = true;
    const isP1 = data.player1Id === currentUser?.id, isP2 = data.player2Id === currentUser?.id;
    if (!isP1 && !isP2) return;

    const tier = CASE_TIERS.find(t => t.id === data.caseId) || CASE_TIERS[0];
    await updateBalance(userBalance - tier.cost);
    totalWagered += tier.cost;
    playBetSound();

    document.getElementById('caseBattleResult').textContent = '';
    document.getElementById('caseResultLeft').innerHTML = '';
    document.getElementById('caseResultRight').innerHTML = '';

    const p1Tag = CASE_TAGS.find(t => t.id === data.player1TagId) || CASE_TAGS[0];
    const p2Tag = CASE_TAGS.find(t => t.id === data.player2TagId) || CASE_TAGS[0];

    document.getElementById('casePlayerLeftName').innerHTML = renderPlayerNameWithTag(data.player1Name, data.player1Rank);
    document.getElementById('casePlayerRightName').innerHTML = renderPlayerNameWithTag(data.player2Name, data.player2Rank);

    buildSpinReel('caseReelLeft', p1Tag, tier.tags);
    buildSpinReel('caseReelRight', p2Tag, tier.tags);
    document.getElementById('caseStartBtn').disabled = true;
    document.getElementById('caseBotBtn').disabled = true;

    setTimeout(async () => {
        document.getElementById('caseResultLeft').innerHTML = `<div class="case-final-tag" style="color:${p1Tag.color};border-color:${p1Tag.color};">${p1Tag.name} (${p1Tag.value.toLocaleString()})</div>`;
        document.getElementById('caseResultRight').innerHTML = `<div class="case-final-tag" style="color:${p2Tag.color};border-color:${p2Tag.color};">${p2Tag.name} (${p2Tag.value.toLocaleString()})</div>`;
        const iWin = (isP1 && p1Tag.value >= p2Tag.value) || (isP2 && p2Tag.value > p1Tag.value);
        const res = document.getElementById('caseBattleResult');
        if (iWin) { playCashoutSound(); res.innerHTML = '<span class="case-win">🎉 YOU WIN!</span>'; await addToInventory(p1Tag); await addToInventory(p2Tag); totalWins++; showToast(`Won ${p1Tag.name} + ${p2Tag.name}!`, 'success'); }
        else { res.innerHTML = '<span class="case-lose">💀 You lost!</span>'; showToast('Lost!', 'error'); }
        caseSpinning = false; myActiveLobby = null;
        document.getElementById('caseStartBtn').textContent = 'Create Battle';
        document.getElementById('caseStartBtn').disabled = false;
        document.getElementById('caseBotBtn').disabled = true;
    }, 4000);
}

// FIXED: Inner track wrapper so reel container stays in place
function buildSpinReel(reelId, finalTag, poolIds) {
    const reel = document.getElementById(reelId);
    if (!reel) return;
    const pool = poolIds || CASE_TAGS.map(t => t.id);
    const itemH = 60, fakeCount = 40;

    let itemsHtml = '';
    for (let i = 0; i < fakeCount; i++) {
        const t = getRandomTagFromPool(pool);
        itemsHtml += `<div class="case-reel-item" style="background:${t.color}12;color:${t.color};border-bottom:1px solid ${t.color}25;"><span class="case-reel-name">${t.name}</span><span class="case-reel-val">${t.value.toLocaleString()}</span></div>`;
    }
    itemsHtml += `<div class="case-reel-item case-reel-winner" style="background:${finalTag.color}25;color:${finalTag.color};border:2px solid ${finalTag.color};"><span class="case-reel-name">${finalTag.name}</span><span class="case-reel-val">${finalTag.value.toLocaleString()}</span></div>`;
    for (let i = 0; i < 5; i++) {
        const t = getRandomTagFromPool(pool);
        itemsHtml += `<div class="case-reel-item" style="background:${t.color}12;color:${t.color};border-bottom:1px solid ${t.color}25;"><span class="case-reel-name">${t.name}</span><span class="case-reel-val">${t.value.toLocaleString()}</span></div>`;
    }

    const trackId = reelId + '_track';
    reel.innerHTML = `<div class="case-reel-track" id="${trackId}">${itemsHtml}</div>`;

    const track = document.getElementById(trackId);
    track.style.transition = 'none';
    track.style.transform = 'translateY(0px)';
    void track.offsetHeight;

    const targetY = -(fakeCount * itemH);
    setTimeout(() => {
        track.style.transition = 'transform 3.5s cubic-bezier(0.12, 0.8, 0.14, 1)';
        track.style.transform = `translateY(${targetY}px)`;
    }, 50);
}

async function addToInventory(tag) {
    if (!currentUser || !userProfile) return;
    const inv = userProfile.inventory || [];
    inv.push({ id: tag.id+'_'+Date.now()+'_'+Math.random().toString(36).substr(2,4), tagId: tag.id, name: tag.name, value: tag.value, color: tag.color, wonAt: new Date().toISOString() });
    userProfile.inventory = inv;
    try { await supabase.update('profiles', { inventory: inv }, `id=eq.${currentUser.id}`); } catch(e){}
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { renderCaseSelect(); if (typeof socket !== 'undefined' && socket) initCaseBattleSocket(); }, 1500);
});
