// Admin Panel Logic
let globalMultiplierValue = 1.0;

function toggleAdminPanel() {
    if (!isOwner()) return;
    const panel = document.getElementById('draggableAdminPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        loadAdminUsers();
        // Reset position if needed or keep saved
    } else {
        panel.style.display = 'none';
    }
}

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

// --- CORE ADMIN FUNCTIONS ---

function isOwner() {
    return currentUser && currentUser.email === 'redadarwichepaypal@gmail.com'; 
}

function getTrollMode() {
    return window.serverMode;
}

function getGlobalMultiplier() {
    return globalMultiplierValue;
}

// 1. FREEZE BETS LOGIC (Fixed Toggle)
function setTrollMode(actionType) {
    if (!isOwner()) return;

    let newMode = 'normal';

    if (actionType === 'freeze_bets') {
        // Toggle logic: If currently frozen, switch to normal. Else freeze.
        newMode = (window.serverMode === 'freeze_bets') ? 'normal' : 'freeze_bets';
    } else if (actionType === 'normal') {
        newMode = 'normal'; // Force reset
    }

    window.serverMode = newMode;
    
    // Update Admin UI Label
    const label = newMode === 'freeze_bets' ? '❄️ BETS FROZEN' : 'NORMAL';
    const modeLabel = document.getElementById('adminCurrentMode');
    if (modeLabel) modeLabel.textContent = label;
    
    // Show Toast
    if (newMode === 'freeze_bets') {
        showToast('❄️ All betting has been frozen!', 'error');
    } else {
        showToast('✅ Betting resumed (Normal mode)', 'success');
    }

    updateAdminButtons();

    // Broadcast change to all players via Socket
    if (socket && socket.connected) {
        socket.emit('admin_command', { command: 'set_mode', mode: newMode });
    }
}

function updateAdminButtons() {
    // Find the freeze button and update its look
    const freezeBtns = document.querySelectorAll('.troll-btn');
    freezeBtns.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes('freeze_bets')) {
            if (window.serverMode === 'freeze_bets') {
                btn.innerHTML = '❄️ Unfreeze Bets';
                btn.classList.remove('troll-red');
                btn.classList.add('troll-gold'); // Gold indicates "Click to Fix/Normal"
            } else {
                btn.innerHTML = '❄️ Freeze All Bets';
                btn.classList.remove('troll-gold');
                btn.classList.add('troll-red');
            }
        }
    });
}

// 2. CHECK IF BETS ARE ALLOWED
// This is called by EVERY game
function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    if (window.serverMode === 'freeze_bets') {
        return { win: false, multiplier: 0, frozen: true };
    }

    return { 
        win: originalWin, 
        multiplier: originalMultiplier * globalMultiplierValue, 
        frozen: false 
    };
}

// 3. GLOBAL CHAT MUTE (Includes Announcement)
let isGlobalChatMuted = false; // Local toggle state tracker

function toggleGlobalMute() {
    if (!isOwner()) return;
    
    isGlobalChatMuted = !isGlobalChatMuted;
    
    if (socket && socket.connected) {
        // 1. Toggle technical mute
        socket.emit('admin_command', { command: 'toggle_mute' });
        
        // 2. Send Global Announcement
        const text = isGlobalChatMuted 
            ? '🔒 Global Chat has been LOCKED by an Administrator.' 
            : '🔓 Global Chat has been UNLOCKED.';
            
        socket.emit('global_announcement', { text: text });
        
        // 3. Local Feedback
        showToast(`Chat ${isGlobalChatMuted ? 'Locked' : 'Unlocked'}`, 'success');
        
        // Update button text
        const btn = document.getElementById('btnMuteChat');
        if(btn) btn.innerHTML = isGlobalChatMuted ? '🔓 Unlock Global Chat' : '🔇 Lock Global Chat';
    }
}

// 4. CLEAR CHAT
function clearGlobalChat() {
    if (!isOwner()) return;
    if(confirm("Are you sure you want to delete all chat history for everyone?")) {
        if (socket && socket.connected) {
            socket.emit('admin_command', { command: 'clear_chat' });
            showToast('Chat history cleared', 'success');
        }
    }
}

// 5. ANNOUNCEMENTS
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

// 6. GLOBAL MULTIPLIER
function setGlobalMultiplier() {
    if (!isOwner()) return;
    const val = parseFloat(document.getElementById('globalMultiplier').value);
    if (val >= 0.1 && val <= 1000) {
        globalMultiplierValue = val;
        showToast(`Global multiplier set to ${val}x`, 'info');
    }
}

// 7. USER MANAGEMENT (Load/Update Balances)
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
        showToast('Balance updated! User will see change instantly.', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// 8. SEND COINS (By Username)
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
            
            // 1. Update Database
            await supabase.update('profiles', { high_score: newBal }, `id=eq.${user.id}`);
            
            // 2. Emit Socket Event for Instant Notification
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
