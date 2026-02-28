// Admin Panel Logic
let globalMultiplierValue = 1.0;

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

// CLEANED UP: Standard result handler (Freeze logic removed)
function handleTrollResult(originalWin, originalMultiplier, betAmount) {
    return { 
        win: originalWin, 
        multiplier: originalMultiplier * globalMultiplierValue, 
        frozen: false 
    };
}

// Function to return current troll mode (always normal now)
function getTrollMode() {
    return 'normal';
}

// 1. CLEAR CHAT
function clearGlobalChat() {
    if (!isOwner()) return;
    if(confirm("Are you sure you want to delete all chat history for everyone?")) {
        if (socket && socket.connected) {
            socket.emit('admin_command', { command: 'clear_chat' });
            showToast('Chat history cleared', 'success');
        }
    }
}

// 2. ANNOUNCEMENTS
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

// 3. GLOBAL MULTIPLIER
function setGlobalMultiplier() {
    if (!isOwner()) return;
    const val = parseFloat(document.getElementById('globalMultiplier').value);
    if (val >= 0.1 && val <= 1000) {
        globalMultiplierValue = val;
        showToast(`Global multiplier set to ${val}x`, 'info');
    }
}

// 4. USER MANAGEMENT (Load Users)
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

// 5. UPDATE USER BALANCE (Set specific amount)
async function updateUserBalance(userId) {
    if (!isOwner()) return;
    const input = document.getElementById(`balance_${userId}`);
    const newBalance = parseInt(input.value);
    
    try {
        // 1. Get current data to calculate diff
        const currentData = await supabase.selectSingle('profiles', 'high_score, username', `id=eq.${userId}`);
        const oldBalance = currentData.high_score || 0;
        const diff = newBalance - oldBalance;

        // 2. Update DB
        await supabase.update('profiles', { high_score: newBalance }, `id=eq.${userId}`);
        
        // 3. Send Notification via Socket
        if (socket && socket.connected) {
            // If we added money, treat as "Received". If we set/reduced, treat as "Set Balance".
            const type = diff > 0 ? 'gift' : 'set_balance';
            const amountToSend = diff > 0 ? diff : newBalance;

            socket.emit('admin_command', { 
                command: 'gift_coins', 
                targetUsername: currentData.username,
                targetId: userId,
                amount: amountToSend,
                type: type
            });
        }

        showToast('Balance updated & user notified!', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// 6. GIVE COINS (Add amount)
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
            
            // 2. Emit Socket Event for Notification (Triggers "You received..." message)
            if (socket && socket.connected) {
                socket.emit('admin_command', { 
                    command: 'gift_coins', 
                    targetUsername: username, 
                    targetId: user.id,
                    amount: amount,
                    type: 'gift'
                });
            }

            showToast(`Sent ${amount} coins to ${username}`, 'success');
            loadAdminUsers(); // Refresh admin list
        } else { showToast('User not found', 'error'); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}
