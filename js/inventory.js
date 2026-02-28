// Inventory System - Fixed: actions always visible, no hover disappear bug
function loadInventoryPage() {
    const container = document.getElementById('inventoryItems');
    if (!container) return;

    if (!currentUser || !userProfile) {
        container.innerHTML = '<div class="loading">Please login to view inventory</div>';
        return;
    }

    const inventory = userProfile.inventory || [];

    if (inventory.length === 0) {
        container.innerHTML = '<div class="loading">No items yet. Win tags from Case Battles!</div>';
        return;
    }

    const ownedRanks = typeof getOwnedRanks === 'function' ? getOwnedRanks() : [];

    let html = '';
    inventory.forEach((item, index) => {
        const alreadyOwned = ownedRanks.includes(item.tagId);

        html += `
            <div class="inventory-item">
                <div class="inventory-tag" style="background:${item.color}20;color:${item.color};border:1px solid ${item.color}60;">
                    ${escapeHtml(item.name)}
                </div>
                <div class="inventory-value">${item.value.toLocaleString()} Astraphobia</div>
                <div class="inventory-actions-always">
                    ${alreadyOwned ?
                        `<span class="inventory-owned-label">Already owned</span>
                         <button class="btn btn-sm btn-cashout" onclick="sellInventoryItem(${index})">Sell (${item.value.toLocaleString()})</button>` :
                        `<button class="btn btn-sm btn-primary" onclick="claimInventoryItem(${index})">Claim Tag</button>
                         <button class="btn btn-sm btn-cashout" onclick="sellInventoryItem(${index})">Sell (${item.value.toLocaleString()})</button>`
                    }
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function sellInventoryItem(index) {
    if (!currentUser || !userProfile) return;

    const inventory = userProfile.inventory || [];
    if (index < 0 || index >= inventory.length) return;

    const item = inventory[index];
    const sellValue = item.value;

    inventory.splice(index, 1);
    userProfile.inventory = inventory;

    await updateBalance(userBalance + sellValue);

    try {
        await supabase.update('profiles',
            { inventory: inventory },
            `id=eq.${currentUser.id}`
        );
    } catch(e) {
        console.error('Sell item error:', e);
    }

    showToast(`Sold ${item.name} for ${sellValue.toLocaleString()} Astraphobia!`, 'success');
    playCashoutSound();
    loadInventoryPage();
}

async function claimInventoryItem(index) {
    if (!currentUser || !userProfile) return;

    const inventory = userProfile.inventory || [];
    if (index < 0 || index >= inventory.length) return;

    const item = inventory[index];

    // Add to owned ranks in shop system
    if (typeof getOwnedRanks === 'function' && typeof saveOwnedRanks === 'function') {
        const owned = getOwnedRanks();
        if (!owned.includes(item.tagId)) {
            owned.push(item.tagId);
            saveOwnedRanks(owned);
            showToast(`Claimed ${item.name} tag! Go to Shop to equip it.`, 'success');
        } else {
            showToast(`You already own ${item.name}. Selling instead.`, 'info');
            await updateBalance(userBalance + item.value);
        }
    }

    inventory.splice(index, 1);
    userProfile.inventory = inventory;

    try {
        await supabase.update('profiles',
            { inventory: inventory },
            `id=eq.${currentUser.id}`
        );
    } catch(e) {
        console.error('Claim item error:', e);
    }

    loadInventoryPage();
}
