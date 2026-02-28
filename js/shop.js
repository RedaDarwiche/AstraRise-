// shop.js - Rank Tag Shop System (includes case battle tags)

const RANK_TIERS = [
    { id: 'noob', name: 'Noob', price: 50, color: '#888888', glow: false },
    { id: 'player', name: 'Player', price: 100, color: '#4cd137', glow: false },
    { id: 'grinder', name: 'Grinder', price: 300, color: '#00a8ff', glow: true },
    { id: 'hustler', name: 'Hustler', price: 450, color: '#e056fd', glow: true },
    { id: 'high_roller', name: 'High Roller', price: 600, color: '#e84393', glow: true },
    { id: 'shark', name: 'Shark', price: 900, color: '#0097e6', glow: true },
    { id: 'whale', name: 'Whale', price: 1300, color: '#ffa502', glow: true },
    { id: 'vip', name: 'V.I.P', price: 1600, color: '#ff6348', glow: true },
    { id: 'legend', name: 'Legend', price: 2000, color: '#ff4757', glow: true },
    // Case battle exclusive tags (cannot buy, only claim from inventory)
    { id: 'common_tag', name: 'Common', price: null, color: '#888888', glow: false, caseOnly: true },
    { id: 'uncommon_tag', name: 'Uncommon', price: null, color: '#4cd137', glow: false, caseOnly: true },
    { id: 'rare_tag', name: 'Rare', price: null, color: '#00a8ff', glow: true, caseOnly: true },
    { id: 'epic_tag', name: 'Epic', price: null, color: '#e056fd', glow: true, caseOnly: true },
    { id: 'legendary_tag', name: 'Legendary', price: null, color: '#e84393', glow: true, caseOnly: true },
    { id: 'mythic_tag', name: 'Mythic', price: null, color: '#ffa502', glow: true, caseOnly: true },
    { id: 'divine_tag', name: 'Divine', price: null, color: '#ff4757', glow: true, caseOnly: true },
    { id: 'astral_tag', name: 'Astral', price: null, color: '#6c5ce7', glow: true, caseOnly: true },
    { id: 'celestial_tag', name: 'Celestial', price: null, color: '#00cec9', glow: true, caseOnly: true },
    { id: 'transcendent_tag', name: 'Transcendent', price: null, color: '#fd79a8', glow: true, caseOnly: true },
    { id: 'eternal_tag', name: 'Eternal', price: null, color: '#e17055', glow: true, caseOnly: true },
    { id: 'godlike_tag', name: 'Godlike', price: null, color: '#d63031', glow: true, caseOnly: true },
    { id: 'omega_tag', name: 'Omega', price: null, color: '#fdcb6e', glow: true, caseOnly: true },
    { id: 'infinity_tag', name: 'Infinity', price: null, color: '#00b894', glow: true, caseOnly: true },
    { id: 'void_tag', name: 'Void', price: null, color: '#2d3436', glow: true, caseOnly: true },
    { id: 'astra_supreme_tag', name: 'Astra Supreme', price: null, color: '#ff0066', glow: true, caseOnly: true }
];

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
    const r = RANK_TIERS.find(r => r.id === rankId);
    showToast(`Equipped "${r?.name || rankId}" tag!`, 'success');
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
    if (!rank || rank.caseOnly) return;

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

    if (equipped) {
        const eqRank = RANK_TIERS.find(r => r.id === equipped);
        if (eqRank) {
            html += `
                <div class="shop-unequip-bar">
                    <span>Currently equipped:</span>
                    <span class="rank-tag" style="background: ${eqRank.color}20; color: ${eqRank.color}; border: 1px solid ${eqRank.color}60;">${eqRank.name}</span>
                    <button type="button" class="btn btn-outline shop-unequip-btn" onclick="unequipRank()">Unequip tag</button>
                </div>
            `;
        }
    }

    // Buyable ranks
    html += '<h3 style="color:var(--text-secondary);margin:16px 0 8px;">🛒 Purchasable Ranks</h3>';
    RANK_TIERS.filter(r => !r.caseOnly).forEach(rank => {
        const isOwned = owned.includes(rank.id);
        const isEquipped = equipped === rank.id;
        const glowStyle = rank.glow ? `text-shadow: 0 0 8px ${rank.color}, 0 0 16px ${rank.color}40;` : '';

        let actionBtn = '';
        if (isEquipped) {
            actionBtn = '<button type="button" class="btn btn-outline" disabled>Equipped</button><button type="button" class="btn btn-outline shop-item-unequip" onclick="unequipRank()">Unequip</button>';
        } else if (isOwned) {
            actionBtn = `<button type="button" class="btn btn-primary" onclick="setEquippedRank('${rank.id}')">Equip</button>`;
        } else {
            actionBtn = `<button type="button" class="btn btn-play" onclick="buyRank('${rank.id}')">Buy (${rank.price})</button>`;
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
                <div class="shop-item-action">${actionBtn}</div>
            </div>
        `;
    });

    // Case battle tags the user owns
    const ownedCaseTags = RANK_TIERS.filter(r => r.caseOnly && owned.includes(r.id));
    if (ownedCaseTags.length > 0) {
        html += '<h3 style="color:var(--text-secondary);margin:24px 0 8px;">🎰 Case Battle Tags (Won)</h3>';
        ownedCaseTags.forEach(rank => {
            const isEquipped = equipped === rank.id;
            const glowStyle = rank.glow ? `text-shadow: 0 0 8px ${rank.color}, 0 0 16px ${rank.color}40;` : '';

            let actionBtn = '';
            if (isEquipped) {
                actionBtn = '<button type="button" class="btn btn-outline" disabled>Equipped</button><button type="button" class="btn btn-outline shop-item-unequip" onclick="unequipRank()">Unequip</button>';
            } else {
                actionBtn = `<button type="button" class="btn btn-primary" onclick="setEquippedRank('${rank.id}')">Equip</button>`;
            }

            html += `
                <div class="shop-item ${isEquipped ? 'equipped' : ''} owned">
                    <div class="shop-item-preview">
                        <span class="rank-tag" style="background: ${rank.color}20; color: ${rank.color}; border: 1px solid ${rank.color}60; ${glowStyle}">${rank.name}</span>
                    </div>
                    <div class="shop-item-info">
                        <div class="shop-item-name">${rank.name}</div>
                        <div class="shop-item-price" style="color:var(--accent-secondary);">Case Battle Exclusive</div>
                    </div>
                    <div class="shop-item-action">${actionBtn}</div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

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

function getMyRankTagHTML() {
    const isOwnerUser = currentUser && currentUser.email === OWNER_EMAIL;
    return getRankTagHTML(isOwnerUser, getEquippedRank());
}
