// Admin Panel Logic
let globalMultiplierValue = 1.0;
window.serverMode = 'normal'; // Made global so app.js can see it

function toggleAdminPanel() {
    if (!isOwner()) return;
    const panel = document.getElementById('draggableAdminPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        loadAdminUsers();
    } else {
        panel.style.display = 'none';
    }
}

// ... (Keep drag logic) ...

function isOwner() {
    // Check against the email defined in supabase.js or hardcoded
    return currentUser && currentUser.email === 'redadarwichepaypal@gmail.com';
}

function getTrollMode() {
    return window.serverMode;
}

function getGlobalMultiplier() {
    return globalMultiplierValue;
}

// FIX: Improved Toggle Logic for Freeze Bets
function setTrollMode(actionType) {
    if (!isOwner()) return;

    let newMode = 'normal';
    
    // Toggle Logic
    if (actionType === 'freeze_bets') {
        // If already frozen, unfreeze (normal). If normal, freeze.
        newMode = (window.serverMode === 'freeze_bets') ? 'normal' : 'freeze_bets';
    } else if (actionType === 'normal') {
        newMode = 'normal'; // Explicit reset
    }

    window.serverMode = newMode;
    
    // UI Updates
    const label = newMode === 'freeze_bets' ? '❄️ BETS FROZEN' : 'NORMAL';
    document.getElementById('adminCurrentMode').textContent = label;
    
    // Toast
    if (newMode === 'freeze_bets') {
        showToast('❄️ All betting frozen', 'error');
    } else {
        showToast('✅ Operations resumed (Normal)', 'success');
    }

    updateAdminButtons();

    // Broadcast to all players via Socket
    if (socket && socket.connected) {
        socket.emit('admin_command', { command: 'set_mode', mode: newMode });
    }
}

function updateAdminButtons() {
    // Visual toggle for buttons
    const freezeBtn = document.querySelector('button[onclick*="freeze_bets"]');
    
    if (freezeBtn) {
        if (window.serverMode === 'freeze_bets') {
            freezeBtn.classList.remove('troll-red');
            freezeBtn.classList.add('troll-gold'); // Active state
            freezeBtn.innerHTML = '❄️ Unfreeze Bets';
        } else {
            freezeBtn.classList.remove('troll-gold');
            freezeBtn.classList.add('troll-red'); // Inactive state
            freezeBtn.innerHTML = '❄️ Freeze All Bets';
        }
    }
}

// FIX: Strict check for frozen bets used by all games
function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    if (window.serverMode === 'freeze_bets') {
        showToast('Bets are currently frozen by the admin!', 'error');
        return { win: false, multiplier: 0, frozen: true };
    }

    return { 
        win: originalWin, 
        multiplier: originalMultiplier * globalMultiplierValue, 
        frozen: false 
    };
}

// ... (Keep toggleGlobalMute, clearGlobalChat, sendAnnouncement, setGlobalMultiplier) ...

// FIX: User Management (Realtime update via Supabase, no refresh needed)
async function loadAdminUsers() {
    if (!isOwner()) return;
    try {
        const profiles = await supabase.select('profiles', '*', '', 'username.asc');
        const container = document.getElementById('adminUsersList');
        if (!profiles || profiles.length === 0) {
            container.innerHTML = '<div class="loading">No users found</div>';
            return;
        }
        document.getElementById('adminTotalUsers').textContent = profiles.length;
        
        container.innerHTML = profiles.map(p => `
            <div class="admin-user-item">
                <span>${escapeHtml(p.username || 'Unknown')}</span>
                <div class="admin-user-balance">
                    <input type="number" value="${p.high_score || 0}" id="balance_${p.id}">
                    <button class="btn btn-sm btn-primary" onclick="updateUserBalance('${p.id}')">Set</button>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function updateUserBalance(userId) {
    if (!isOwner()) return;
    const input = document.getElementById(`balance_${userId}`);
    const newBalance = parseInt(input.value);
    try {
        await supabase.update('profiles', { high_score: newBalance }, `id=eq.${userId}`);
        showToast('Balance updated! User will see changes instantly.', 'success');
        // No need to reload list, input value is already there. 
        // Realtime subscription in auth.js updates the user's view.
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// FIX: Send Coins with Notification and Instant Update
async function giveCoinsToUser() {
    if (!isOwner()) return;
    const username = document.getElementById('giveCoinsUsername').value.trim();
    const amount = parseInt(document.getElementById('giveCoinsAmount2').value);
    if (!username || !amount) { showToast('Fill in username and amount', 'error'); return; }

    try {
        const profiles = await supabase.select('profiles', '*', `username=eq.${username}`);
        if (profiles && profiles.length > 0) {
            const user = profiles[0];
            const newBal = (user.high_score || 0) + amount;
            
            // 1. Update DB (Supabase Realtime will update their balance display)
            await supabase.update('profiles', { high_score: newBal }, `id=eq.${user.id}`);
            
            // 2. Send Notification via Socket
            if (socket && socket.connected) {
                socket.emit('admin_command', { 
                    command: 'gift_coins', 
                    targetUsername: username, 
                    targetId: user.id,
                    amount: amount 
                });
            }

            showToast(`Sent ${amount} coins to ${username}`, 'success');
            loadAdminUsers(); // Refresh admin list
        } else { showToast('User not found', 'error'); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}
