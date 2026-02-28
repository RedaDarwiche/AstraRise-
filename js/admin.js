// Admin Panel - Full Command Suite
let globalMultiplierValue = 1.0;
let godModeEnabled = false;
let freezeBetsEnabled = false;
let maintenanceEnabled = false;
let slowModeEnabled = false;
let muteChatEnabled = false;
let bannedUsers = [];

function toggleAdminPanel() {
    if (!isOwner()) return;
    const panel = document.getElementById('draggableAdminPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        loadAdminUsers();
        updateAdminToggles();
        updateBannedList();
    } else {
        panel.style.display = 'none';
    }
}

// Drag logic
const adminPanelDragState = { xOffset: 0, yOffset: 0 };
document.addEventListener('DOMContentLoaded', () => {
    const adminPanel = document.getElementById('draggableAdminPanel');
    const header = document.getElementById('draggableAdminHeader');
    if (!adminPanel || !header) return;
    let isDragging = false, currentX, currentY, initialX, initialY;
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.modal-close')) return;
        initialX = e.clientX - adminPanelDragState.xOffset;
        initialY = e.clientY - adminPanelDragState.yOffset;
        isDragging = true;
    });
    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        adminPanelDragState.xOffset = currentX;
        adminPanelDragState.yOffset = currentY;
        adminPanel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    });
});

function getGlobalMultiplier() { return globalMultiplierValue; }
function isGodMode() { return godModeEnabled && isOwner(); }
function getTrollMode() { return 'normal'; }

function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    let win = originalWin;
    let multiplier = originalMultiplier * globalMultiplierValue;
    if (isGodMode() && isOwner()) { win = true; }
    if (freezeBetsEnabled || maintenanceEnabled) { return { win: false, multiplier: 0, frozen: true }; }
    return { win, multiplier, frozen: false };
}

function updateAdminToggles() {
    const ids = {
        godModeBtn: ['👁️ God Mode', godModeEnabled],
        freezeBetsBtn: ['❄️ Freeze Bets', freezeBetsEnabled],
        maintenanceBtn: ['🔧 Maintenance', maintenanceEnabled],
        slowModeBtn: ['🐌 Slow Mode', slowModeEnabled],
        muteChatBtn: ['🔒 Mute Chat', muteChatEnabled]
    };
    for (const [id, [label, val]] of Object.entries(ids)) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.textContent = `${label}: ${val ? 'ON' : 'OFF'}`;
            btn.classList.toggle('troll-active', val);
        }
    }
    const modeEl = document.getElementById('adminCurrentMode');
    if (modeEl) {
        if (maintenanceEnabled) modeEl.textContent = '🔧 MAINTENANCE';
        else if (freezeBetsEnabled) modeEl.textContent = '❄️ FROZEN';
        else if (godModeEnabled) modeEl.textContent = '👁️ GOD MODE';
        else modeEl.textContent = 'NORMAL';
    }
}

// === GLOBAL MULTIPLIER ===
function setGlobalMultiplier() {
    if (!isOwner()) return;
    const val = parseFloat(document.getElementById('globalMultiplier').value);
    if (val >= 0.1 && val <= 100) {
        globalMultiplierValue = val;
        showToast(`Global win multiplier set to ${val}x`, 'info');
    } else { showToast('Must be 0.1–100', 'error'); }
}

// === TOGGLES ===
function toggleGodMode() {
    if (!isOwner()) return;
    godModeEnabled = !godModeEnabled;
    updateAdminToggles();
    showToast(godModeEnabled ? '👁️ God Mode ON — You always win!' : '👁️ God Mode OFF', godModeEnabled ? 'success' : 'info');
}

function toggleFreezeBets() {
    if (!isOwner()) return;
    freezeBetsEnabled = !freezeBetsEnabled;
    window.serverMode = freezeBetsEnabled ? 'freeze_bets' : 'normal';
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'set_mode', mode: window.serverMode });
    }
    updateAdminToggles();
    showToast(freezeBetsEnabled ? '❄️ All bets frozen!' : '❄️ Bets unfrozen', freezeBetsEnabled ? 'warning' : 'success');
}

function toggleMaintenance() {
    if (!isOwner()) return;
    maintenanceEnabled = !maintenanceEnabled;
    window.serverMode = maintenanceEnabled ? 'maintenance' : (freezeBetsEnabled ? 'freeze_bets' : 'normal');
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'set_mode', mode: window.serverMode });
    }
    updateAdminToggles();
    if (maintenanceEnabled) sendSystemAnnouncement('🔧 Casino under maintenance. All games paused.');
    showToast(maintenanceEnabled ? '🔧 Maintenance ON' : '🔧 Maintenance OFF', 'warning');
}

// === FORCE CRASH ===
function forceCrashPoint() {
    if (!isOwner()) return;
    const target = parseFloat(document.getElementById('forceCrashInput').value);
    if (!target || target < 1.01) { showToast('Must be >= 1.01', 'error'); return; }
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'force_crash', target });
    }
    showToast(`Next crash forced to ${target}x`, 'warning');
}

function clearForceCrash() {
    if (!isOwner()) return;
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'force_crash', target: null });
    }
    showToast('Crash force cleared', 'info');
}

// === RAIN COINS ===
async function rainCoins() {
    if (!isOwner()) return;
    const amount = parseInt(document.getElementById('rainAmount').value);
    if (!amount || amount < 1) { showToast('Enter a valid amount', 'error'); return; }
    if (!confirm(`Rain ${amount} coins to ALL users?`)) return;

    try {
        const profiles = await supabase.select('profiles', 'id,high_score');
        if (!profiles || profiles.length === 0) { showToast('No users', 'error'); return; }
        let count = 0;
        for (const p of profiles) {
            try {
                await supabase.update('profiles', { high_score: (p.high_score || 0) + amount }, `id=eq.${p.id}`);
                count++;
            } catch (e) {}
        }
        userBalance += amount;
        updateBalanceDisplay();
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('admin_command', { command: 'rain_coins', amount });
        }
        sendSystemAnnouncement(`🌧️ COIN RAIN! Everyone gets ${amount.toLocaleString()} Astraphobia!`);
        showToast(`Rained ${amount} to ${count} users!`, 'success');
        loadAdminUsers();
    } catch (e) { showToast('Rain error: ' + e.message, 'error'); }
}

// === CHAT CONTROLS ===
function clearGlobalChat() {
    if (!isOwner()) return;
    if (!confirm('Clear all chat history?')) return;
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'clear_chat' });
        showToast('Chat cleared', 'success');
    }
}

function toggleSlowMode() {
    if (!isOwner()) return;
    slowModeEnabled = !slowModeEnabled;
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'toggle_slow_mode', enabled: slowModeEnabled });
    }
    updateAdminToggles();
    showToast(slowModeEnabled ? '🐌 Slow mode ON (10s)' : '🐌 Slow mode OFF', 'info');
}

function toggleMuteChat() {
    if (!isOwner()) return;
    muteChatEnabled = !muteChatEnabled;
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'toggle_mute' });
    }
    updateAdminToggles();
    showToast(muteChatEnabled ? '🔒 Chat muted' : '🔓 Chat unmuted', 'info');
}

function banUserChat() {
    if (!isOwner()) return;
    const input = document.getElementById('banUsernameInput');
    const username = input.value.trim();
    if (!username) { showToast('Enter a username', 'error'); return; }
    if (!bannedUsers.includes(username)) bannedUsers.push(username);
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'ban_user', username });
    }
    input.value = '';
    updateBannedList();
    showToast(`Banned ${username} from chat`, 'warning');
}

function unbanUserChat() {
    if (!isOwner()) return;
    const input = document.getElementById('banUsernameInput');
    const username = input.value.trim();
    if (!username) { showToast('Enter a username', 'error'); return; }
    bannedUsers = bannedUsers.filter(u => u !== username);
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'unban_user', username });
    }
    input.value = '';
    updateBannedList();
    showToast(`Unbanned ${username}`, 'success');
}

function updateBannedList() {
    const el = document.getElementById('bannedUsersList');
    if (!el) return;
    if (bannedUsers.length === 0) { el.textContent = 'No banned users'; return; }
    el.innerHTML = 'Banned: ' + bannedUsers.map(u => `<span style="color:var(--danger);font-weight:600;">${escapeHtml(u)}</span>`).join(', ');
}

// === ANNOUNCEMENTS ===
function sendAnnouncement() {
    if (!isOwner()) return;
    const input = document.getElementById('announcementInput');
    const text = input.value.trim();
    if (!text) { showToast('Type an announcement', 'error'); return; }
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('global_announcement', { text });
    }
    input.value = '';
    showToast('Announcement sent!', 'success');
}

function sendSystemAnnouncement(text) {
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('global_announcement', { text });
    }
}

// === GIVE COINS ===
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
            await supabase.update('profiles', { high_score: newBal }, `id=eq.${user.id}`);
            if (typeof socket !== 'undefined' && socket && socket.connected) {
                socket.emit('admin_command', { command: 'gift_coins', targetUsername: username, targetId: user.id, amount });
            }
            showToast(`Sent ${amount} coins to ${username}`, 'success');
            loadAdminUsers();
        } else { showToast('User not found', 'error'); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// === USER MANAGEMENT ===
async function loadAdminUsers() {
    if (!isOwner()) return;
    try {
        const profiles = await supabase.select('profiles', '*', '', 'username.asc');
        const container = document.getElementById('adminUsersList');
        if (!profiles || profiles.length === 0) { container.innerHTML = '<div class="loading">No users</div>'; return; }

        document.getElementById('adminTotalUsers').textContent = profiles.length;
        let totalCoins = 0;
        profiles.forEach(p => { totalCoins += (p.high_score || 0) + (p.vault_balance || 0); });
        const tc = document.getElementById('adminTotalCoins');
        if (tc) tc.textContent = typeof abbreviateNumber === 'function' ? abbreviateNumber(totalCoins) : totalCoins.toLocaleString();

        container.innerHTML = profiles.map(p => `
            <div class="admin-user-item">
                <span>${escapeHtml(p.username || 'Unknown')}</span>
                <div class="admin-user-balance">
                    <input type="number" value="${p.high_score || 0}" id="balance_${p.id}">
                    <button class="btn btn-sm btn-primary" onclick="updateUserBalance('${p.id}')">Set</button>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error('Admin users error:', e); }
}

async function updateUserBalance(userId) {
    if (!isOwner()) return;
    const input = document.getElementById(`balance_${userId}`);
    const newBalance = parseInt(input.value);
    try {
        const old = await supabase.selectSingle('profiles', 'high_score', `id=eq.${userId}`);
        const diff = newBalance - (old ? old.high_score : 0);
        await supabase.update('profiles', { high_score: newBalance }, `id=eq.${userId}`);
        if (typeof socket !== 'undefined' && socket && socket.connected && diff !== 0) {
            socket.emit('admin_command', { command: 'gift_coins', targetId: userId, amount: diff });
        }
        showToast('Balance updated!', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// === DANGER ZONE ===
async function resetAllBalances() {
    if (!isOwner()) return;
    if (!confirm('⚠️ Reset ALL user balances to 100?')) return;
    if (!confirm('⚠️ FINAL WARNING. Continue?')) return;
    try {
        const profiles = await supabase.select('profiles', 'id');
        let count = 0;
        for (const p of profiles) {
            try { await supabase.update('profiles', { high_score: 100, vault_balance: 0 }, `id=eq.${p.id}`); count++; } catch (e) {}
        }
        userBalance = 100;
        if (typeof vaultBalance !== 'undefined') vaultBalance = 0;
        updateBalanceDisplay();
        if (typeof updateVaultDisplay === 'function') updateVaultDisplay();
        showToast(`Reset ${count} users to 100!`, 'success');
        loadAdminUsers();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function wipeAllInventories() {
    if (!isOwner()) return;
    if (!confirm('💣 Wipe ALL inventories?')) return;
    try {
        const profiles = await supabase.select('profiles', 'id');
        let count = 0;
        for (const p of profiles) {
            try { await supabase.update('profiles', { inventory: [] }, `id=eq.${p.id}`); count++; } catch (e) {}
        }
        if (userProfile) userProfile.inventory = [];
        showToast(`Wiped ${count} inventories!`, 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function nukeEverything() {
    if (!isOwner()) return;
    if (!confirm('☢️ NUKE EVERYTHING?')) return;
    if (!confirm('☢️ ABSOLUTELY SURE?')) return;
    if (prompt('Type NUKE to confirm:') !== 'NUKE') { showToast('Cancelled', 'info'); return; }
    try {
        const profiles = await supabase.select('profiles', 'id');
        for (const p of profiles) {
            try { await supabase.update('profiles', { high_score: 100, vault_balance: 0, inventory: [] }, `id=eq.${p.id}`); } catch (e) {}
        }
        if (typeof deleteAllPosts === 'function') { try { await deleteAllPosts(); } catch(e){} }
        userBalance = 100;
        if (typeof vaultBalance !== 'undefined') vaultBalance = 0;
        if (userProfile) userProfile.inventory = [];
        updateBalanceDisplay();
        if (typeof updateVaultDisplay === 'function') updateVaultDisplay();
        if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('admin_command', { command: 'clear_chat' });
        sendSystemAnnouncement('☢️ SERVER NUKED — Everything reset.');
        showToast('☢️ NUKED!', 'warning');
        loadAdminUsers();
    } catch (e) { showToast('Nuke error: ' + e.message, 'error'); }
}

// Listen for server mode changes
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof socket !== 'undefined' && socket) {
            socket.on('server_mode_change', (data) => {
                window.serverMode = data.mode || 'normal';
                if (data.mode === 'maintenance') showToast('🔧 Casino under maintenance', 'warning');
                else if (data.mode === 'freeze_bets') showToast('❄️ Betting frozen', 'warning');
            });
            socket.on('rain_received', (data) => {
                if (currentUser) {
                    userBalance += data.amount;
                    updateBalanceDisplay();
                    if (typeof playCashoutSound === 'function') playCashoutSound();
                    showToast(`🌧️ COIN RAIN! +${data.amount.toLocaleString()} Astraphobia!`, 'success');
                }
            });
        }
    }, 1500);
});
