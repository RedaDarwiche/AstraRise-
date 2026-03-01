let globalMultiplierValue = 1.0;
let freezeBetsEnabled = false;
let maintenanceEnabled = false;
let slowModeEnabled = false;
let muteChatEnabled = false;
let bannedUsers = [];

function toggleAdminPanel() {
    if (!isOwner()) return;
    const panel = document.getElementById('draggableAdminPanel');
    if (panel.style.display === 'none') { panel.style.display = 'flex'; loadAdminUsers(); updateAdminToggles(); updateBannedList(); }
    else panel.style.display = 'none';
}

const adminPanelDragState = { xOffset: 0, yOffset: 0 };
document.addEventListener('DOMContentLoaded', () => {
    const p = document.getElementById('draggableAdminPanel'), h = document.getElementById('draggableAdminHeader');
    if (!p || !h) return;
    let drag = false, cx, cy, ix, iy;
    h.addEventListener('mousedown', (e) => { if (e.target.closest('.modal-close')) return; ix = e.clientX - adminPanelDragState.xOffset; iy = e.clientY - adminPanelDragState.yOffset; drag = true; });
    document.addEventListener('mouseup', () => drag = false);
    document.addEventListener('mousemove', (e) => { if (!drag) return; e.preventDefault(); cx = e.clientX - ix; cy = e.clientY - iy; adminPanelDragState.xOffset = cx; adminPanelDragState.yOffset = cy; p.style.transform = `translate3d(${cx}px,${cy}px,0)`; });
});

function getGlobalMultiplier() { return window.globalWinMultiplier || globalMultiplierValue; }
function getTrollMode() { return 'normal'; }

function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    if (window.serverMode === 'freeze_bets' || window.serverMode === 'maintenance') return { win: false, multiplier: 0, frozen: true };
    return { win: originalWin, multiplier: originalMultiplier * getGlobalMultiplier(), frozen: false };
}

function updateAdminToggles() {
    [['freezeBetsBtn', '❄️ Freeze Bets', freezeBetsEnabled],
     ['maintenanceBtn', '🔧 Maintenance', maintenanceEnabled],
     ['slowModeBtn', '🐌 Slow Mode', slowModeEnabled],
     ['muteChatBtn', '🔒 Mute Chat', muteChatEnabled]
    ].forEach(([id, label, val]) => {
        const btn = document.getElementById(id);
        if (btn) { btn.textContent = `${label}: ${val ? 'ON' : 'OFF'}`; btn.classList.toggle('troll-active', val); }
    });
    const m = document.getElementById('adminCurrentMode');
    if (m) m.textContent = maintenanceEnabled ? '🔧 MAINTENANCE' : freezeBetsEnabled ? '❄️ FROZEN' : 'NORMAL';
}

// === GLOBAL MULTIPLIER ===
function setGlobalMultiplier() {
    if (!isOwner()) return;
    const val = parseFloat(document.getElementById('globalMultiplier').value);
    if (val >= 0.1 && val <= 100) {
        globalMultiplierValue = val;
        window.globalWinMultiplier = val;
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('admin_command', { command: 'set_multiplier', value: val });
        }
        showToast(`Global win multiplier: ${val}x — all game payouts multiplied!`, 'success');
    } else showToast('Must be 0.1–100', 'error');
}

// === FREEZE BETS ===
function toggleFreezeBets() {
    if (!isOwner()) return;
    freezeBetsEnabled = !freezeBetsEnabled;
    const mode = maintenanceEnabled ? 'maintenance' : freezeBetsEnabled ? 'freeze_bets' : 'normal';
    window.serverMode = mode;
    applyServerMode(mode);
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'set_mode', mode: mode });
    }
    updateAdminToggles();
    showToast(freezeBetsEnabled ? '❄️ All bets frozen for everyone!' : '❄️ Bets unfrozen', freezeBetsEnabled ? 'warning' : 'success');
}

// === MAINTENANCE ===
function toggleMaintenance() {
    if (!isOwner()) return;
    maintenanceEnabled = !maintenanceEnabled;
    const mode = maintenanceEnabled ? 'maintenance' : freezeBetsEnabled ? 'freeze_bets' : 'normal';
    window.serverMode = mode;
    applyServerMode(mode);
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'set_mode', mode: mode });
    }
    updateAdminToggles();
    if (maintenanceEnabled) sendSystemAnnouncement('🔧 Casino under maintenance. All games paused.');
    else sendSystemAnnouncement('✅ Casino is back online!');
    showToast(maintenanceEnabled ? '🔧 Maintenance ON' : '🔧 Maintenance OFF', 'warning');
}

// === FORCE CRASH ===
function forceCrashPoint() {
    if (!isOwner()) return;
    const target = parseFloat(document.getElementById('forceCrashInput').value);
    if (!target || target < 1.01) { showToast('Must be >= 1.01', 'error'); return; }
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'force_crash', target });
        showToast(`Next crash forced to ${target}x`, 'warning');
    } else showToast('Not connected', 'error');
}

function clearForceCrash() {
    if (!isOwner()) return;
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('admin_command', { command: 'force_crash', target: null });
        showToast('Crash force cleared', 'info');
    }
}

// === RAIN ===
async function rainCoins() {
    if (!isOwner()) return;
    const amount = parseInt(document.getElementById('rainAmount').value);
    if (!amount || amount < 1) { showToast('Enter amount', 'error'); return; }
    if (!confirm(`Rain ${amount} to ALL users?`)) return;
    try {
        const profiles = await supabase.select('profiles', 'id,high_score');
        if (!profiles) return;
        for (const p of profiles) { try { await supabase.update('profiles', { high_score: (p.high_score || 0) + amount }, `id=eq.${p.id}`); } catch(e){} }
        userBalance += amount; updateBalanceDisplay();
        if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('admin_command', { command: 'rain_coins', amount });
        sendSystemAnnouncement(`🌧️ COIN RAIN! Everyone gets ${amount.toLocaleString()} Astraphobia!`);
        showToast(`Rained ${amount} to ${profiles.length} users!`, 'success');
        loadAdminUsers();
    } catch (e) { showToast(e.message, 'error'); }
}

// === CHAT ===
function clearGlobalChat() { if (!isOwner() || !confirm('Clear chat?')) return; if (typeof socket !== 'undefined' && socket && socket.connected) { socket.emit('admin_command', { command: 'clear_chat' }); showToast('Cleared', 'success'); } }

function toggleSlowMode() {
    if (!isOwner()) return;
    slowModeEnabled = !slowModeEnabled;
    if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('admin_command', { command: 'set_slow_mode', enabled: slowModeEnabled });
    updateAdminToggles();
    showToast(slowModeEnabled ? '🐌 Slow mode ON (10s)' : '🐌 Slow mode OFF', 'info');
}

function toggleMuteChat() {
    if (!isOwner()) return;
    muteChatEnabled = !muteChatEnabled;
    if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('admin_command', { command: 'toggle_mute' });
    updateAdminToggles();
    showToast(muteChatEnabled ? '🔒 Chat muted' : '🔓 Unmuted', 'info');
}

function banUserChat() {
    if (!isOwner()) return;
    const input = document.getElementById('banUsernameInput'), u = input.value.trim();
    if (!u) { showToast('Enter username', 'error'); return; }
    if (!bannedUsers.includes(u)) bannedUsers.push(u);
    if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('admin_command', { command: 'ban_user', username: u });
    input.value = ''; updateBannedList();
    showToast(`Banned ${u}`, 'warning');
}

function unbanUserChat() {
    if (!isOwner()) return;
    const input = document.getElementById('banUsernameInput'), u = input.value.trim();
    if (!u) { showToast('Enter username', 'error'); return; }
    bannedUsers = bannedUsers.filter(x => x !== u);
    if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('admin_command', { command: 'unban_user', username: u });
    input.value = ''; updateBannedList();
    showToast(`Unbanned ${u}`, 'success');
}

function updateBannedList() {
    const el = document.getElementById('bannedUsersList');
    if (!el) return;
    el.innerHTML = bannedUsers.length === 0 ? 'No banned users' : 'Banned: ' + bannedUsers.map(u => `<span style="color:var(--danger);font-weight:600;">${escapeHtml(u)}</span>`).join(', ');
}

function sendAnnouncement() {
    if (!isOwner()) return;
    const input = document.getElementById('announcementInput'), text = input.value.trim();
    if (!text) { showToast('Type something', 'error'); return; }
    if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('global_announcement', { text });
    input.value = ''; showToast('Sent!', 'success');
}

function sendSystemAnnouncement(text) { if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('global_announcement', { text }); }

async function giveCoinsToUser() {
    if (!isOwner()) return;
    const username = document.getElementById('giveCoinsUsername').value.trim();
    const amount = parseInt(document.getElementById('giveCoinsAmount2').value);
    if (!username || !amount) { showToast('Fill fields', 'error'); return; }
    try {
        const profiles = await supabase.select('profiles', '*', `username=eq.${username}`);
        if (profiles && profiles.length > 0) {
            const user = profiles[0];
            await supabase.update('profiles', { high_score: (user.high_score || 0) + amount }, `id=eq.${user.id}`);
            if (typeof socket !== 'undefined' && socket && socket.connected)
                socket.emit('admin_command', { 
    command: 'gift_coins', 
    targetUsername: username, 
    targetId: user.id, 
    amount,
    senderName: userProfile?.username || 'Admin'
});
            showToast(`Sent ${amount} to ${username}`, 'success'); loadAdminUsers();
        } else showToast('Not found', 'error');
    } catch (e) { showToast(e.message, 'error'); }
}

async function loadAdminUsers() {
    if (!isOwner()) return;
    try {
        const profiles = await supabase.select('profiles', '*', '', 'username.asc');
        const c = document.getElementById('adminUsersList');
        if (!profiles || !profiles.length) { c.innerHTML = '<div class="loading">No users</div>'; return; }
        document.getElementById('adminTotalUsers').textContent = profiles.length;
        let total = 0; profiles.forEach(p => total += (p.high_score||0) + (p.vault_balance||0));
        const tc = document.getElementById('adminTotalCoins');
        if (tc) tc.textContent = typeof abbreviateNumber === 'function' ? abbreviateNumber(total) : total.toLocaleString();
        c.innerHTML = profiles.map(p => `<div class="admin-user-item"><span>${escapeHtml(p.username||'?')}</span><div class="admin-user-balance"><input type="number" value="${p.high_score||0}" id="balance_${p.id}"><button class="btn btn-sm btn-primary" onclick="updateUserBalance('${p.id}')">Set</button></div></div>`).join('');
    } catch (e) { console.error(e); }
}

async function updateUserBalance(userId) {
    if (!isOwner()) return;
    const nb = parseInt(document.getElementById(`balance_${userId}`).value);
    try {
        const old = await supabase.selectSingle('profiles', 'high_score', `id=eq.${userId}`);
        await supabase.update('profiles', { high_score: nb }, `id=eq.${userId}`);
        if (typeof socket !== 'undefined' && socket && socket.connected)socket.emit('admin_command', { 
    command: 'gift_coins', 
    targetId: userId, 
    amount: nb - (old ? old.high_score : 0),
    senderName: userProfile?.username || 'Admin'
});
        showToast('Updated!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function resetAllBalances() {
    if (!isOwner() || !confirm('Reset ALL to 100?') || !confirm('FINAL WARNING?')) return;
    try {
        const p = await supabase.select('profiles', 'id');
        for (const x of p) { try { await supabase.update('profiles', { high_score: 100, vault_balance: 0 }, `id=eq.${x.id}`); } catch(e){} }
        userBalance = 100; if (typeof vaultBalance !== 'undefined') vaultBalance = 0;
        updateBalanceDisplay(); if (typeof updateVaultDisplay === 'function') updateVaultDisplay();
        showToast('All reset!', 'success'); loadAdminUsers();
    } catch (e) { showToast(e.message, 'error'); }
}

async function wipeAllInventories() {
    if (!isOwner() || !confirm('Wipe ALL inventories?')) return;
    try {
        const p = await supabase.select('profiles', 'id');
        for (const x of p) { try { await supabase.update('profiles', { inventory: [] }, `id=eq.${x.id}`); } catch(e){} }
        if (userProfile) userProfile.inventory = [];
        showToast('Wiped!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function nukeEverything() {
    if (!isOwner() || !confirm('☢️ NUKE?') || prompt('Type NUKE:') !== 'NUKE') return;
    try {
        const p = await supabase.select('profiles', 'id');
        for (const x of p) { try { await supabase.update('profiles', { high_score: 100, vault_balance: 0, inventory: [] }, `id=eq.${x.id}`); } catch(e){} }
        if (typeof deleteAllPosts === 'function') try { await deleteAllPosts(); } catch(e){}
        userBalance = 100; if (typeof vaultBalance !== 'undefined') vaultBalance = 0;
        if (userProfile) userProfile.inventory = [];
        updateBalanceDisplay(); if (typeof updateVaultDisplay === 'function') updateVaultDisplay();
        if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('admin_command', { command: 'clear_chat' });
        sendSystemAnnouncement('☢️ SERVER NUKED.');
        showToast('☢️ NUKED!', 'warning'); loadAdminUsers();
    } catch (e) { showToast(e.message, 'error'); }
}

