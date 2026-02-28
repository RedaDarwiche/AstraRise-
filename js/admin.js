// Admin Panel Logic
let globalMultiplierValue = 1.0;
let serverMode = 'normal'; // 'normal' or 'freeze_bets'

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

// --- DRAG LOGIC (Keep this as is) ---
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
    // Basic check - redundant if backend is secure, but good for UI hiding
    return currentUser && currentUser.email === 'redadarwichepaypal@gmail.com'; // Update your email here if needed
}

function getTrollMode() {
    return serverMode;
}

function getGlobalMultiplier() {
    return globalMultiplierValue;
}

// 1. FREEZE BETS LOGIC
function setTrollMode(mode) {
    if (!isOwner()) return;

    if (serverMode === mode) {
        // Toggle off
        serverMode = 'normal';
        document.getElementById('adminCurrentMode').textContent = 'NORMAL';
        showToast('Server mode: Normal', 'info');
    } else {
        // Toggle on
        serverMode = mode;
        const label = mode === 'freeze_bets' ? '❄️ BETS FROZEN' : 'NORMAL';
        document.getElementById('adminCurrentMode').textContent = label;
        
        if (mode === 'freeze_bets') {
            showToast('❄️ All betting has been frozen!', 'error');
            // Optional: Announce it to everyone
            if (socket && socket.connected) socket.emit('global_announcement', { text: '❄️ Betting is temporarily frozen for maintenance.' });
        }
    }
    updateAdminButtons();
}

function updateAdminButtons() {
    document.querySelectorAll('.troll-btn').forEach(btn => {
        btn.classList.remove('troll-active');
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`'${serverMode}'`)) {
            btn.classList.add('troll-active');
        }
    });
}

// 2. CHECK IF BETS ARE ALLOWED
// This replaces the old "handleTrollResult" with a clean check
function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    // If bets are frozen, we shouldn't have reached here usually, 
    // but as a failsafe:
    if (serverMode === 'freeze_bets') {
        return { win: false, multiplier: 0, frozen: true };
    }

    // Normal game logic
    return { 
        win: originalWin, 
        multiplier: originalMultiplier * globalMultiplierValue, 
        frozen: false 
    };
}

// 3. GLOBAL CHAT MUTE
function toggleGlobalMute() {
    if (!isOwner()) return;
    if (socket && socket.connected) {
        socket.emit('admin_command', { command: 'toggle_mute' });
        showToast('Toggled Global Chat Mute', 'warning');
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
        showToast('Balance updated!', 'success');
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
            const newBal = (profiles[0].high_score || 0) + amount;
            await supabase.update('profiles', { high_score: newBal }, `id=eq.${profiles[0].id}`);
            showToast(`Sent ${amount} coins to ${username}`, 'success');
            loadAdminUsers();
        } else { showToast('User not found', 'error'); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}