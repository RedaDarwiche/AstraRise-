// Admin Panel Logic
window.globalMultiplierValue = 1.0;
window.serverMode = 'normal'; 
window.chatMuted = false;

window.applyServerMode = function(mode) {
    window.serverMode = mode;
    const label = mode === 'freeze_bets' ? 'BETS FROZEN' : 'NORMAL';
    const modeEl = document.getElementById('adminCurrentMode');
    if (modeEl) modeEl.textContent = label;
    updateAdminButtons();
};

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

// --- GLOBAL CLICK INTERCEPTOR (FIXES FREEZE GLITCHES) ---
document.addEventListener('click', (e) => {
    if (window.serverMode === 'freeze_bets') {
        const target = e.target.closest('button');
        if (!target) return;
        
        const oc = target.getAttribute('onclick') || '';
        if (
            oc.includes('playDice') || oc.includes('toggleCrashBet') || oc.includes('startMines') || 
            oc.includes('startBlackjack') || oc.includes('playLimbo') || oc.includes('startHilo') || 
            oc.includes('playCoinflip') || oc.includes('playKeno') || oc.includes('startTowers')
        ) {
            e.stopPropagation();
            e.preventDefault();
            showToast('Betting is currently frozen for maintenance.', 'error');
        }
    }
}, true);

// --- DRAG LOGIC ---
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

function isOwner() {
    return currentUser && currentUser.email === 'redadarwichepaypal@gmail.com'; 
}

function getTrollMode() {
    return window.serverMode;
}

function getGlobalMultiplier() {
    return window.globalMultiplierValue;
}

function setTrollMode(mode) {
    if (!isOwner()) return;

    if (window.serverMode === mode) {
        window.applyServerMode('normal');
        showToast('Server mode: Normal', 'info');
        if (typeof socket !== 'undefined' && socket.connected) {
            socket.emit('global_announcement', { text: 'Betting has resumed.' });
        }
    } else {
        window.applyServerMode(mode);
        if (mode === 'freeze_bets') {
            showToast('All betting has been frozen.', 'error');
            if (typeof socket !== 'undefined' && socket.connected) {
                socket.emit('global_announcement', { text: 'Betting is temporarily frozen for maintenance.' });
            }
        }
    }
}

function updateAdminButtons() {
    document.querySelectorAll('.troll-btn').forEach(btn => {
        btn.classList.remove('troll-active');
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`'${window.serverMode}'`)) {
            btn.classList.add('troll-active');
        }
    });
}

function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    return { win: originalWin, multiplier: originalMultiplier * window.globalMultiplierValue, frozen: false };
}

function toggleGlobalMute() {
    if (!isOwner()) return;
    
    window.chatMuted = !window.chatMuted;
    const text = window.chatMuted ? 'Global chat is now muted.' : 'Global chat has been unmuted.';
    
    if (typeof socket !== 'undefined' && socket.connected) {
        socket.emit('global_announcement', { text: text });
    }
    
    showToast(text, 'info');
    
    const btn = document.getElementById('btnMuteChat');
    if (btn) btn.textContent = window.chatMuted ? 'Unmute Global Chat' : 'Lock Global Chat';
}

function clearGlobalChat() {
    if (!isOwner()) return;
    if(confirm("Are you sure you want to delete all chat history for everyone?")) {
        if (typeof socket !== 'undefined' && socket.connected) {
            socket.emit('admin_command', { command: 'clear_chat' });
            showToast('Chat history cleared', 'success');
        }
    }
}

function sendAnnouncement() {
    if (!isOwner()) return;
    const input = document.getElementById('announcementInput');
    const text = input.value.trim();
    if (!text) { showToast('Type an announcement first', 'error'); return; }

    if (typeof socket !== 'undefined' && socket.connected) {
        socket.emit('global_announcement', { text: text });
    }
    input.value = '';
}

function setGlobalMultiplier() {
    if (!isOwner()) return;
    const val = parseFloat(document.getElementById('globalMultiplier').value);
    if (val >= 0.1 && val <= 1000) {
        window.globalMultiplierValue = val;
        showToast(`Global multiplier set to ${val}x`, 'info');
    }
}

async function loadAdminUsers() {
    if (!isOwner()) return;
    const container = document.getElementById('adminUsersList');
    container.innerHTML = '<div class="loading">Loading users...</div>';
    
    try {
        const profiles = await supabase.select('profiles', '*', '', 'username.asc');
        
        if (!profiles || profiles.length === 0) {
            container.innerHTML = `<div class="loading" style="color:var(--warning)">No users found.</div>`;
            return;
        }
        
        document.getElementById('adminTotalUsers').textContent = profiles.length;
        
        const totalCoins = profiles.reduce((sum, p) => sum + (p.high_score || 0), 0);
        const totalCoinsEl = document.getElementById('adminTotalCoins');
        if (totalCoinsEl) totalCoinsEl.textContent = totalCoins.toLocaleString();
        
        container.innerHTML = profiles.map(p => `
            <div class="admin-user-item">
                <span>${(p.username || 'Unknown').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                <div class="admin-user-balance">
                    <input type="number" value="${p.high_score || 0}" id="balance_${p.id}">
                    <button class="btn btn-sm btn-primary" onclick="updateUserBalance('${p.id}')">Set</button>
                </div>
            </div>
        `).join('');
    } catch (e) { 
        container.innerHTML = `<div class="loading" style="color:var(--danger)">Failed to load users.</div>`;
    }
}

async function updateUserBalance(userId) {
    if (!isOwner()) return;
    const input = document.getElementById(`balance_${userId}`);
    const newBalance = parseInt(input.value);
    const oldBalance = parseInt(input.defaultValue);
    
    try {
        // Find the username so we can notify them properly
        const profiles = await supabase.select('profiles', 'username', `id=eq.${userId}`);
        const targetUsername = profiles && profiles.length > 0 ? profiles[0].username : null;

        await supabase.update('profiles', { high_score: newBalance }, `id=eq.${userId}`);
        showToast('Balance updated!', 'success');
        
        if (currentUser && userId === currentUser.id) {
            userBalance = newBalance;
            if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
        }

        // HIDDEN MAGIC: Notify the user they received coins from OWNER
        const difference = newBalance - oldBalance;
        if (difference > 0 && targetUsername && typeof socket !== 'undefined' && socket.connected) {
            socket.emit('send_chat', {
                author: 'SYSTEM_GIFT',
                text: JSON.stringify({ from: 'OWNER', to: targetUsername, amount: difference })
            });
        }
        
        const oldTotalText = document.getElementById('adminTotalCoins').textContent.replace(/,/g, '');
        document.getElementById('adminTotalCoins').textContent = (parseInt(oldTotalText) + difference).toLocaleString();
        input.defaultValue = newBalance; 
        
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function giveCoinsToUser() {
    if (!isOwner()) return;
    const username = document.getElementById('giveCoinsUsername').value.trim();
    const amount = parseInt(document.getElementById('giveCoinsAmount2').value);
    if (!username || !amount) { showToast('Fill in username and amount', 'error'); return; }

    try {
        const profiles = await supabase.select('profiles', '*', `username=eq.${username}`);
        if (profiles && profiles.length > 0) {
            const targetUser = profiles[0];
            const newBal = (targetUser.high_score || 0) + amount;
            await supabase.update('profiles', { high_score: newBal }, `id=eq.${targetUser.id}`);
            showToast(`Sent ${amount} coins to ${username}`, 'success');
            
            if (currentUser && targetUser.id === currentUser.id) {
                userBalance = newBal;
                if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
            }

            // HIDDEN MAGIC: Notify the user they received coins from OWNER
            if (typeof socket !== 'undefined' && socket.connected) {
                socket.emit('send_chat', {
                    author: 'SYSTEM_GIFT',
                    text: JSON.stringify({ from: 'OWNER', to: targetUser.username, amount: amount })
                });
            }

            loadAdminUsers();
        } else { showToast('User not found', 'error'); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}
