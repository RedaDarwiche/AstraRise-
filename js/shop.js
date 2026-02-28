// shop.js - Unified Tag System

// Shop-purchasable ranks
const SHOP_RANKS = [
    { id: 'noob', name: 'Noob', price: 50, color: '#888888', glow: false },
    { id: 'player', name: 'Player', price: 100, color: '#4cd137', glow: false },
    { id: 'grinder', name: 'Grinder', price: 300, color: '#00a8ff', glow: true },
    { id: 'hustler', name: 'Hustler', price: 450, color: '#e056fd', glow: true },
    { id: 'high_roller', name: 'High Roller', price: 600, color: '#e84393', glow: true },
    { id: 'shark', name: 'Shark', price: 900, color: '#0097e6', glow: true },
    { id: 'whale', name: 'Whale', price: 1300, color: '#ffa502', glow: true },
    { id: 'vip', name: 'V.I.P', price: 1600, color: '#ff6348', glow: true },
    { id: 'legend', name: 'Legend', price: 2000, color: '#ff4757', glow: true }
];

// Case-exclusive tags (only from case battles)
const CASE_EXCLUSIVE_TAGS = [
    { id: 'common', name: 'Common', price: 0, color: '#95a5a6', glow: false, caseOnly: true, value: 10 },
    { id: 'uncommon', name: 'Uncommon', price: 0, color: '#2ecc71', glow: false, caseOnly: true, value: 25 },
    { id: 'rare', name: 'Rare', price: 0, color: '#3498db', glow: true, caseOnly: true, value: 60 },
    { id: 'epic', name: 'Epic', price: 0, color: '#9b59b6', glow: true, caseOnly: true, value: 150 },
    { id: 'legendary', name: 'Legendary', price: 0, color: '#e67e22', glow: true, caseOnly: true, value: 400 },
    { id: 'mythic', name: 'Mythic', price: 0, color: '#f39c12', glow: true, caseOnly: true, value: 800 },
    { id: 'divine', name: 'Divine', price: 0, color: '#e74c3c', glow: true, caseOnly: true, value: 2000 },
    { id: 'astral', name: 'Astral', price: 0, color: '#8e44ad', glow: true, caseOnly: true, value: 5000 }
];

// ALL_TAGS used for lookups everywhere
const ALL_TAGS = [...SHOP_RANKS, ...CASE_EXCLUSIVE_TAGS];
const RANK_TIERS = SHOP_RANKS; // backwards compat

function getShopUserKey() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) return currentUser.id;
    return 'guest';
}

function getOwnedRanks() {
    const key = 'astrarise_owned_ranks_' + getShopUserKey();
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
}

function getEquippedRank() {
    const key = 'astrarise_equipped_rank_' + getShopUserKey();
    return localStorage.getItem(key) || null;
}

function setEquippedRank(rankId) {
    const key = 'astrarise_equipped_rank_' + getShopUserKey();
    localStorage.setItem(key, rankId);
    renderShop();
    const tag = ALL_TAGS.find(r => r.id === rankId);
    showToast(`Equipped "${tag?.name || rankId}" tag!`, 'success');
}

function unequipRank() {
    const key = 'astrarise_equipped_rank_' + getShopUserKey();
    localStorage.removeItem(key);
    renderShop();
    showToast('Tag unequipped', 'info');
}

function saveOwnedRanks(ranks) {
    const key = 'astrarise_owned_ranks_' + getShopUserKey();
    localStorage.setItem(key, JSON.stringify(ranks));
}

async function buyRank(rankId) {
    if (!currentUser) { showToast('Please login first', 'error'); return; }
    const rank = SHOP_RANKS.find(r => r.id === rankId);
    if (!rank) return;
    const owned = getOwnedRanks();
    if (owned.includes(rankId)) { setEquippedRank(rankId); return; }
    if (userBalance < rank.price) { showToast(`Not enough Astraphobia! Need ${rank.price}`, 'error'); return; }
    await updateBalance(userBalance - rank.price);
    owned.push(rankId);
    saveOwnedRanks(owned);
    setEquippedRank(rankId);
    showToast(`Purchased "${rank.name}" rank for ${rank.price} Astraphobia!`, 'success');
    renderShop();
}

function renderShop() {
    const container = document.getElementById('shopItems');
    if (!container) return;
    const owned = getOwnedRanks();
    const equipped = getEquippedRank();
    let html = '';

    if (equipped) {
        const eqRank = ALL_TAGS.find(r => r.id === equipped);
        if (eqRank) {
            html += `<div class="shop-unequip-bar"><span>Currently equipped:</span><span class="rank-tag" style="background:${eqRank.color}20;color:${eqRank.color};border:1px solid ${eqRank.color}60;">${eqRank.name}</span><button type="button" class="btn btn-outline shop-unequip-btn" onclick="unequipRank()">Unequip tag</button></div>`;
        }
    }

    // Shop purchasable ranks
    html += '<h3 style="margin:16px 0 8px;color:var(--text-secondary);">🏷️ Purchasable Ranks</h3>';
    SHOP_RANKS.forEach(rank => {
        const isOwned = owned.includes(rank.id);
        const isEquipped = equipped === rank.id;
        const glowStyle = rank.glow ? `text-shadow:0 0 8px ${rank.color},0 0 16px ${rank.color}40;` : '';
        let actionBtn = '';
        if (isEquipped) {
            actionBtn = '<button type="button" class="btn btn-outline" disabled>Equipped</button><button type="button" class="btn btn-outline shop-item-unequip" onclick="unequipRank()">Unequip</button>';
        } else if (isOwned) {
            actionBtn = `<button type="button" class="btn btn-primary" onclick="setEquippedRank('${rank.id}')">Equip</button>`;
        } else {
            actionBtn = `<button type="button" class="btn btn-play" onclick="buyRank('${rank.id}')">Buy (${rank.price})</button>`;
        }
        html += `<div class="shop-item ${isEquipped ? 'equipped' : ''} ${isOwned ? 'owned' : ''}"><div class="shop-item-preview"><span class="rank-tag" style="background:${rank.color}20;color:${rank.color};border:1px solid ${rank.color}60;${glowStyle}">${rank.name}</span></div><div class="shop-item-info"><div class="shop-item-name">${rank.name}</div><div class="shop-item-price">${rank.price} Astraphobia</div></div><div class="shop-item-action">${actionBtn}</div></div>`;
    });

    // Case exclusive tags
    html += '<h3 style="margin:24px 0 8px;color:var(--text-secondary);">📦 Case Exclusive Tags</h3>';
    html += '<p style="color:var(--text-muted);font-size:0.85em;margin-bottom:12px;">Win these from Case Battles! Claim from Inventory to equip.</p>';
    CASE_EXCLUSIVE_TAGS.forEach(tag => {
        const isOwned = owned.includes(tag.id);
        const isEquipped = equipped === tag.id;
        const glowStyle = tag.glow ? `text-shadow:0 0 8px ${tag.color},0 0 16px ${tag.color}40;` : '';
        let actionBtn = '';
        if (isEquipped) {
            actionBtn = '<button type="button" class="btn btn-outline" disabled>Equipped</button><button type="button" class="btn btn-outline shop-item-unequip" onclick="unequipRank()">Unequip</button>';
        } else if (isOwned) {
            actionBtn = `<button type="button" class="btn btn-primary" onclick="setEquippedRank('${tag.id}')">Equip</button>`;
        } else {
            actionBtn = '<span style="color:var(--text-muted);font-size:0.85em;">Win from Cases</span>';
        }
        html += `<div class="shop-item ${isEquipped ? 'equipped' : ''} ${isOwned ? 'owned' : ''}"><div class="shop-item-preview"><span class="rank-tag" style="background:${tag.color}20;color:${tag.color};border:1px solid ${tag.color}60;${glowStyle}">${tag.name}</span></div><div class="shop-item-info"><div class="shop-item-name">${tag.name}</div><div class="shop-item-price">Sell value: ${tag.value}</div></div><div class="shop-item-action">${actionBtn}</div></div>`;
    });

    container.innerHTML = html;
}

function getRankTagHTML(isOwner, equippedRank) {
    let html = '';
    if (isOwner) html += '<span class="rank-tag rank-owner">OWNER</span>';
    if (equippedRank) {
        const rank = ALL_TAGS.find(r => r.id === equippedRank);
        if (rank) {
            const glowStyle = rank.glow ? `text-shadow:0 0 8px ${rank.color},0 0 16px ${rank.color}40;` : '';
            html += `<span class="rank-tag" style="background:${rank.color}20;color:${rank.color};border:1px solid ${rank.color}60;${glowStyle}">${rank.name}</span>`;
        }
    }
    return html;
}

function getMyRankTagHTML() {
    const isOwnerUser = currentUser && currentUser.email === OWNER_EMAIL;
    return getRankTagHTML(isOwnerUser, getEquippedRank());
}
