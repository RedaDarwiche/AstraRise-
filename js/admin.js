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

function getGlobalMultiplier() {
    return globalMultiplierValue;
}

// CHECK IF BETS ARE ALLOWED
// Simplified: Just returns standard multipliers since freeze is removed
function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    return { 
        win: originalWin, 
        multiplier: originalMultiplier * globalMultiplierValue, 
        frozen: false 
    };
}

// CLEAR CHAT
function clearGlobalChat() {
    if (!isOwner()) return;
    if(confirm("Are you sure you want to delete all chat history for everyone?")) {
        if (socket && socket.connected) {
            socket.emit('admin_command', { command: 'clear_chat' });
            showToast('Chat history cleared', 'success');
        }
    }
}

// ANNOUNCEMENTS
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

// GLOBAL MULTIPLIER
function setGlobalMultiplier() {
    if (!isOwner()) return;
    const val = parseFloat(document.getElementById('globalMultiplier').value);
    if (val >= 0.1 && val <= 1000) {
        globalMultiplierValue = val;
        showToast(`Global multiplier set to ${val}x`, 'info');
    }
}

// USER MANAGEMENT (Load/Update Balances)
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
        // Fetch old balance to calculate difference for notification
        const { data: oldProfile } = await supabase.selectSingle('profiles', 'high_score', `id=eq.${userId}`);
        const oldBal = oldProfile ? oldProfile.high_score : 0;
        const diff = newBalance - oldBal;

        // Update DB
        await supabase.update('profiles', { high_score: newBalance }, `id=eq.${userId}`);
        
        // Notify User via Socket if there was a change
        if (socket && socket.connected && diff !== 0) {
            socket.emit('admin_command', { 
                command: 'gift_coins', 
                targetId: userId,
                amount: diff
            });
        }

        showToast('Balance updated & User notified!', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// SEND COINS (By Username)
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
