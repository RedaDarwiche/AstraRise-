// Case Battle System - Spin Tags, Winner Takes All
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

let caseSpinning = false;

function getRandomTag() {
    const totalWeight = CASE_TAGS.reduce((s, t) => s + t.rarity, 0);
    let rand = Math.random() * totalWeight;
    for (const tag of CASE_TAGS) {
        rand -= tag.rarity;
        if (rand <= 0) return tag;
    }
    return CASE_TAGS[0];
}

function buildSpinReel(reelId, finalTag) {
    const reel = document.getElementById(reelId);
    if (!reel) return;
    
    let html = '';
    // 30 random items then the final one
    for (let i = 0; i < 30; i++) {
        const t = getRandomTag();
        html += `<div class="case-tag-item" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}60;">${t.name}<span class="case-tag-val">${t.value}</span></div>`;
    }
    // Final item (index 30)
    html += `<div class="case-tag-item case-tag-final" style="background:${finalTag.color}20;color:${finalTag.color};border:2px solid ${finalTag.color};">${finalTag.name}<span class="case-tag-val">${finalTag.value}</span></div>`;
    // 5 more after for visual
    for (let i = 0; i < 5; i++) {
        const t = getRandomTag();
        html += `<div class="case-tag-item" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}60;">${t.name}<span class="case-tag-val">${t.value}</span></div>`;
    }
    
    reel.innerHTML = html;
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0px)';
    
    // Force reflow
    reel.offsetHeight;
    
    // Animate to final item (index 30)
    const itemHeight = 60;
    const targetY = -(30 * itemHeight);
    
    setTimeout(() => {
        reel.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.6, 0.15, 1)';
        reel.style.transform = `translateY(${targetY}px)`;
    }, 100);
}

async function startCaseBattle() {
    if (caseSpinning) return;
    if (!currentUser) { showToast('Please login to play', 'error'); return; }
    
    const caseCost = parseInt(document.getElementById('caseBet').value);
    if (!caseCost || caseCost < 10) { showToast('Minimum case cost is 10', 'error'); return; }
    if (caseCost > userBalance) { showToast('Insufficient balance', 'error'); return; }
    
    caseSpinning = true;
    document.getElementById('caseStartBtn').disabled = true;
    document.getElementById('caseBattleResult').textContent = '';
    document.getElementById('caseResultLeft').innerHTML = '';
    document.getElementById('caseResultRight').innerHTML = '';
    
    await updateBalance(userBalance - caseCost);
    totalWagered += caseCost;
    playBetSound();
    
    // Both players spin
    const playerTag = getRandomTag();
    const botTag = getRandomTag();
    
    buildSpinReel('caseReelLeft', playerTag);
    buildSpinReel('caseReelRight', botTag);
    
    // Wait for spin to finish
    setTimeout(async () => {
        const resultEl = document.getElementById('caseBattleResult');
        const leftResult = document.getElementById('caseResultLeft');
        const rightResult = document.getElementById('caseResultRight');
        
        leftResult.innerHTML = `<div class="case-final-tag" style="color:${playerTag.color};border-color:${playerTag.color};">${playerTag.name} (${playerTag.value})</div>`;
        rightResult.innerHTML = `<div class="case-final-tag" style="color:${botTag.color};border-color:${botTag.color};">${botTag.name} (${botTag.value})</div>`;
        
        if (playerTag.value >= botTag.value) {
            // Player wins - gets both tags
            playCashoutSound();
            resultEl.innerHTML = `<span class="case-win">🎉 YOU WIN! You get both tags!</span>`;
            
            // Add both tags to inventory
            await addToInventory(playerTag);
            await addToInventory(botTag);
            
            totalWins++;
            showToast(`Won the case battle! Got ${playerTag.name} + ${botTag.name}!`, 'success');
        } else {
            // Bot wins - player gets nothing
            resultEl.innerHTML = `<span class="case-lose">💀 Bot wins! You lost everything.</span>`;
            showToast(`Lost the case battle to Bot's ${botTag.name}!`, 'error');
        }
        
        caseSpinning = false;
        document.getElementById('caseStartBtn').disabled = false;
    }, 4000);
}

async function addToInventory(tag) {
    if (!currentUser || !userProfile) return;
    
    const inventory = userProfile.inventory || [];
    inventory.push({
        id: tag.id + '_' + Date.now(),
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
