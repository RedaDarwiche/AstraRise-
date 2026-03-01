// --- AUDIO SYSTEM ---
const audioBet = new Audio('sounds/bet.mp3');
const audioCashout = new Audio('sounds/cashout.mp3');

window.serverMode = 'normal';

function playBetSound() {
    audioBet.currentTime = 0;
    audioBet.play().catch(e => console.warn("Sound blocked:", e));
}

function playCashoutSound() {
    audioCashout.currentTime = 0;
    audioCashout.play().catch(e => console.warn("Sound blocked:", e));
}

// Global win multiplier helper — call this in every game when calculating win payout
function getWinAmount(bet, gameMultiplier) {
    const globalMul = typeof getGlobalMultiplier === 'function' ? getGlobalMultiplier() : 1.0;
    return Math.floor(bet * gameMultiplier * globalMul);
}

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + page);
    if (target) {
        target.style.display = 'block';
    } else {
        const home = document.getElementById('page-home');
        if (home) home.style.display = 'block';
        return;
    }

    document.querySelectorAll('.game-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.game-item').forEach(item => {
        const onclick = item.getAttribute('onclick') || '';
        if (onclick.includes(`'${page}'`)) item.classList.add('active');
    });

    switch (page) {
        case 'profile': if (typeof loadProfilePage === 'function') loadProfilePage(); break;
        case 'forum': if (typeof loadForumPosts === 'function') loadForumPosts(); break;
        case 'keno': if (typeof initKenoGrid === 'function') initKenoGrid(); break;
        case 'home': loadHomeStats(); break;
        case 'leaderboard': if (typeof loadLeaderboard === 'function') loadLeaderboard(); break;
        case 'shop': if (typeof renderShop === 'function') renderShop(); break;
        case 'inventory': if (typeof loadInventoryPage === 'function') loadInventoryPage(); break;
        case 'cases':
            if (typeof renderCaseSelect === 'function') renderCaseSelect();
            if (typeof initCaseBattleSocket === 'function') initCaseBattleSocket();
            if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('case_get_lobbies');
            break;
    }
    window.scrollTo(0, 0);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { const input = modal.querySelector('input'); if (input) input.focus(); }, 100);
    }
    if (modalId === 'vaultModal' && typeof updateVaultDisplay === 'function') updateVaultDisplay();
    if (modalId === 'donateModal' && typeof loadDonateNotifications === 'function') loadDonateNotifications();
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

let modalMouseDownTarget = null;
document.addEventListener('mousedown', (e) => { modalMouseDownTarget = e.target.classList.contains('modal-overlay') ? e.target : null; });
document.addEventListener('mouseup', (e) => {
    if (e.target.classList.contains('modal-overlay') && modalMouseDownTarget === e.target) e.target.style.display = 'none';
    modalMouseDownTarget = null;
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 6L9 17l-5-5" stroke="#00d26a" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        error: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="#ff4757" fill="none" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="#ff4757" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="#ff4757" stroke-width="2"/></svg>',
        warning: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#ffa502" fill="none" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="#ffa502" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#ffa502" stroke-width="2"/></svg>',
        info: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="#a29bfe" fill="none" stroke-width="2"/><line x1="12" y1="16" x2="12" y2="12" stroke="#a29bfe" stroke-width="2"/><line x1="12" y1="8" x2="12.01" y2="8" stroke="#a29bfe" stroke-width="2"/></svg>'
    };
    toast.innerHTML = `<div class="toast-icon">${icons[type] || icons.info}</div><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()"><svg viewBox="0 0 24 24" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/></svg></button>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => { toast.classList.add('toast-hide'); setTimeout(() => toast.remove(), 300); }, 3000);
}

async function loadHomeStats() {
    const el = document.getElementById('totalUsersHome');
    if (!el) return;
    try {
        const profiles = await supabase.select('profiles', 'id,username');
        if (profiles && Array.isArray(profiles)) {
            el.textContent = profiles.filter(p => p.username && p.username.length >= 3).length;
        } else { el.textContent = '0'; }
    } catch (e) { el.textContent = '0'; }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => { if (m.style.display !== 'none') m.style.display = 'none'; });
});

async function initApp() {
    if (typeof initAuth === 'function') await initAuth();
    navigateTo('home');
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    if (typeof socket !== 'undefined') {
        socket.on('gift_notification', async (data) => {
            if (currentUser && userProfile && (userProfile.username === data.targetUsername || currentUser.id === data.targetId)) {
                playCashoutSound();
                showToast(data.amount > 0 ? `Received ${data.amount} Astraphobia from OWNER` : `Balance adjusted by ${data.amount}`, 'success');
                if (typeof loadProfile === 'function') await loadProfile();
            }
        });
        socket.on('global_announcement', (data) => { if (typeof showAnnouncementBanner === 'function') showAnnouncementBanner(data.text); });
        socket.on('donation_received', async (data) => {
            if (currentUser && (currentUser.id === data.toUserId || (userProfile && userProfile.username === data.toUsername))) {
                playCashoutSound();
                showToast(`❤️ ${data.fromUsername} donated ${data.amount.toLocaleString()} Astraphobia to you!`, 'success');
                if (typeof loadProfile === 'function') await loadProfile();
            }
        });
        socket.on('server_mode_change', (data) => {
            window.serverMode = data.mode || 'normal';
            if (data.mode === 'maintenance') showToast('🔧 Casino under maintenance', 'warning');
            else if (data.mode === 'freeze_bets') showToast('❄️ Betting frozen by admin', 'warning');
            else if (data.mode === 'normal' && window.serverMode !== 'normal') showToast('✅ Casino back to normal', 'success');
        });
        socket.on('rain_received', (data) => {
            if (currentUser && data.amount) {
                userBalance += data.amount;
                updateBalanceDisplay();
                playCashoutSound();
                showToast(`🌧️ COIN RAIN! +${data.amount.toLocaleString()} Astraphobia!`, 'success');
            }
        });
    }
});
