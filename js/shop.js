// shop.js - Rank Tag Shop System

const RANK_TIERS = [
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

// Per-account storage: each user has their own owned/equipped ranks
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
    showToast(`Equipped "${RANK_TIERS.find(r => r.id === rankId)?.name}" tag!`, 'success');
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

    const rank = RANK_TIERS.find(r => r.id === rankId);
    if (!rank) return;

    const owned = getOwnedRanks();
    if (owned.includes(rankId)) {
        setEquippedRank(rankId);
        return;
    }

    if (userBalance < rank.price) {
        showToast(`Not enough Astraphobia! Need ${rank.price}`, 'error');
        return;
    }

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

    // Unequip bar at top for everyone when any tag is equipped
    if (equipped) {
        const eqRank = RANK_TIERS.find(r => r.id === equipped);
        html += `
            <div class="shop-unequip-bar">
                <span>Currently equipped:</span>
                <span class="rank-tag" style="background: ${eqRank?.color}20; color: ${eqRank?.color}; border: 1px solid ${eqRank?.color}60;">${eqRank?.name || equipped}</span>
                <button type="button" class="btn btn-outline shop-unequip-btn" onclick="unequipRank()">Unequip tag</button>
            </div>
        `;
    }

    RANK_TIERS.forEach(rank => {
        const isOwned = owned.includes(rank.id);
        const isEquipped = equipped === rank.id;

        const glowStyle = rank.glow ? `text-shadow: 0 0 8px ${rank.color}, 0 0 16px ${rank.color}40;` : '';

        let actionBtn = '';
        if (isEquipped) {
            actionBtn = '<button type="button" class="btn btn-outline" disabled>Equipped</button><button type="button" class="btn btn-outline shop-item-unequip" onclick="unequipRank()">Unequip</button>';
        } else if (isOwned) {
            actionBtn = `<button type="button" class="btn btn-primary" onclick="setEquippedRank('${rank.id}')">Equip</button>`;
        } else {
            actionBtn = `<button type="button" class="btn btn-play" onclick="buyRank('${rank.id}')">Buy</button>`;
        }

        html += `
            <div class="shop-item ${isEquipped ? 'equipped' : ''} ${isOwned ? 'owned' : ''}">
                <div class="shop-item-preview">
                    <span class="rank-tag" style="background: ${rank.color}20; color: ${rank.color}; border: 1px solid ${rank.color}60; ${glowStyle}">${rank.name}</span>
                </div>
                <div class="shop-item-info">
                    <div class="shop-item-name">${rank.name}</div>
                    <div class="shop-item-price">${rank.price} Astraphobia</div>
                </div>
                <div class="shop-item-action">
                    ${actionBtn}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Get the tag HTML for any user (can show both OWNER and equipped rank as two tags)
function getRankTagHTML(isOwner, equippedRank) {
    let html = '';
    if (isOwner) {
        html += '<span class="rank-tag rank-owner">OWNER</span>';
    }
    if (equippedRank) {
        const rank = RANK_TIERS.find(r => r.id === equippedRank);
        if (rank) {
            const glowStyle = rank.glow ? `text-shadow: 0 0 8px ${rank.color}, 0 0 16px ${rank.color}40;` : '';
            html += `<span class="rank-tag" style="background: ${rank.color}20; color: ${rank.color}; border: 1px solid ${rank.color}60; ${glowStyle}">${rank.name}</span>`;
        }
    }
    return html;
}

// Get current user's tag HTML
function getMyRankTagHTML() {
    const isOwnerUser = currentUser && currentUser.email === OWNER_EMAIL;
    return getRankTagHTML(isOwnerUser, getEquippedRank());
}
