// chat.js
let globalMessages =[];
let announcementBannerTimer = null;
window.chatMuted = false;
window.currentTipTarget = null;

// 1. Inject Theme-Matching CSS for the Tip Button
const chatStyle = document.createElement('style');
chatStyle.innerHTML = `
    .chat-author-wrapper { display: inline-flex; align-items: center; gap: 8px; position: relative; }
    .chat-tip-btn { 
        display: none; 
        background: var(--bg-tertiary); 
        color: var(--accent-secondary); 
        border: 1px solid var(--border-color); 
        border-radius: 6px; 
        padding: 3px 8px; 
        font-size: 0.7em; 
        cursor: pointer; 
        font-weight: 700; 
        text-transform: uppercase;
        transition: all 0.2s; 
    }
    .chat-tip-btn:hover { 
        background: var(--accent-primary); 
        color: white; 
        border-color: var(--accent-primary); 
        box-shadow: 0 0 10px rgba(108, 92, 231, 0.4);
    }
    .chat-msg-header:hover .chat-tip-btn { display: inline-block; }
`;
document.head.appendChild(chatStyle);

// 2. Inject the Built-in Tipping UI Modal
const tipModalHTML = `
<div class="modal-overlay" id="tipModal" style="display:none;">
    <div class="modal">
        <div class="modal-header">
            <h3>Tip Player</h3>
            <button class="modal-close" onclick="hideModal('tipModal')">
                <svg viewBox="0 0 24 24" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/></svg>
            </button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom: 15px; color: var(--text-secondary);">Send Astraphobia to <strong id="tipTargetName" style="color: var(--text-primary);">User</strong></p>
            <div class="form-group">
                <label>Amount to Tip</label>
                <input type="number" id="tipAmountInput" class="form-input" placeholder="e.g. 100" min="1">
            </div>
            <button class="btn btn-primary btn-full" onclick="confirmTip()">Send Tip</button>
        </div>
    </div>
</div>
`;
// Add it to the website dynamically
if (document.body) document.body.insertAdjacentHTML('beforeend', tipModalHTML);

function showAnnouncementBanner(text) {
    const banner = document.getElementById('announcementBanner');
    const textEl = document.getElementById('announcementBannerText');
    if (!banner || !textEl) return;
    
    // Ensure the label is clean
    const label = banner.querySelector('.announcement-banner-label');
    if (label) label.textContent = 'ANNOUNCEMENT';

    if (announcementBannerTimer) {
        clearTimeout(announcementBannerTimer);
        announcementBannerTimer = null;
    }
    
    // Remove emojis and html tags from the banner text
    const cleanText = (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[📢❄️✅🔇🧹🛡️]/g, '').trim();
    textEl.innerHTML = cleanText;
    
    banner.style.display = 'flex';
    announcementBannerTimer = setTimeout(() => {
        dismissAnnouncementBanner();
        announcementBannerTimer = null;
    }, 25000);
}

function dismissAnnouncementBanner() {
    if (announcementBannerTimer) {
        clearTimeout(announcementBannerTimer);
        announcementBannerTimer = null;
    }
    const banner = document.getElementById('announcementBanner');
    if (banner) banner.style.display = 'none';
}

function initChat() {
    renderChatMessages();

    if (socket && socket.connected !== undefined) {
        socket.on('chat_history', (messages) => {
            globalMessages = messages.filter(m => m.author !== 'SYSTEM_GIFT' && m.author !== 'SYSTEM_TIP');
            renderChatMessages();
            
            // Sync freeze & mute states safely
            let isFrozen = false;
            let isMuted = false;
            const announcements = messages.filter(m => m.author && m.author.includes('ANNOUNCEMENT'));
            
            announcements.forEach(msg => {
                if (msg.text.includes('frozen')) isFrozen = true;
                if (msg.text.includes('resumed')) isFrozen = false;
                if (msg.text.includes('muted')) isMuted = true;
                if (msg.text.includes('unmuted')) isMuted = false;
            });
            
            if (typeof window.applyServerMode === 'function') {
                window.applyServerMode(isFrozen ? 'freeze_bets' : 'normal');
            }
            window.chatMuted = isMuted;
            
            const muteBtn = document.getElementById('btnMuteChat');
            if (muteBtn) muteBtn.textContent = window.chatMuted ? 'Unmute Global Chat' : 'Lock Global Chat';
        });

        socket.on('new_chat_message', (msg) => {
            // INTERCEPT HIDDEN TIPS & GIFTS
            if (msg.author === 'SYSTEM_GIFT' || msg.author === 'SYSTEM_TIP') {
                try {
                    const data = JSON.parse(msg.text);
                    if (userProfile && userProfile.username === data.to) {
                        const title = msg.author === 'SYSTEM_GIFT' ? 'OWNER' : data.from;
                        showToast(`You received ${data.amount} Astraphobia from ${title}!`, 'success');
                        if (typeof loadProfile === 'function') loadProfile(); // Refresh balance
                    }
                } catch(e) {}
                return;
            }

            globalMessages.push(msg);
            if (globalMessages.length > 50) globalMessages.shift();
            renderChatMessages();
            
            if (msg.author && msg.author.includes('ANNOUNCEMENT') && msg.text) {
                showAnnouncementBanner(msg.text);
                
                // Live state syncs
                if (msg.text.includes('frozen')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('freeze_bets');
                } else if (msg.text.includes('resumed')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('normal');
                } else if (msg.text.includes('muted')) {
                    window.chatMuted = true;
                } else if (msg.text.includes('unmuted')) {
                    window.chatMuted = false;
                }
                
                const muteBtn = document.getElementById('btnMuteChat');
                if (muteBtn) muteBtn.textContent = window.chatMuted ? 'Unmute Global Chat' : 'Lock Global Chat';
            }
        });
    }

    if (!globalMessages.length) {
        const saved = localStorage.getItem('astrarise_offline_chat');
        if (saved) {
            try { globalMessages = JSON.parse(saved); } catch (e) { }
            renderChatMessages();
        }
    }
}

// Open custom tipping UI
function tipUser(targetUsername) {
    if (!currentUser || !userProfile) { showToast('Please login to tip users', 'error'); return; }
    if (targetUsername === userProfile.username) { showToast('You cannot tip yourself!', 'warning'); return; }
    
    window.currentTipTarget = targetUsername;
    document.getElementById('tipTargetName').textContent = targetUsername;
    document.getElementById('tipAmountInput').value = '';
    showModal('tipModal');
}

// Process the tip securely
async function confirmTip() {
    if (!window.currentTipTarget) return;
    
    const amountStr = document.getElementById('tipAmountInput').value;
    const amount = parseInt(amountStr);
    
    if (isNaN(amount) || amount <= 0) { showToast('Invalid amount', 'error'); return; }
    if (amount > userBalance) { showToast('Insufficient balance', 'error'); return; }

    const targetUsername = window.currentTipTarget;

    try {
        await supabase.query('rpc/tip_user', 'POST', {
            body: { sender_id: currentUser.id, target_username: targetUsername, tip_amount: amount }
        });
        
        updateBalance(userBalance - amount);
        showToast(`Successfully tipped ${amount} to ${targetUsername}!`, 'success');
        hideModal('tipModal');
        
        if (socket && socket.connected) {
            socket.emit('send_chat', {
                author: 'SYSTEM_TIP',
                text: JSON.stringify({ from: userProfile.username, to: targetUsername, amount: amount })
            });
        }
    } catch (e) {
        console.error(e);
        showToast('Tipping failed! Database blocked the transaction.', 'error');
        hideModal('tipModal');
    }
}

function renderChatMessages() {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;
    chatContainer.innerHTML = '';

    globalMessages.forEach(msg => {
        if (msg.author === 'SYSTEM_GIFT' || msg.author === 'SYSTEM_TIP') return;

        const date = new Date(msg.time);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';
        const authorClass = msg.isOwner ? 'chat-author owner' : 'chat-author';
        
        // Strip emojis from text and author rendering completely
        const safeText = (msg.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[📢❄️✅🔇🧹🛡️]/g, '').trim();
        const safeAuthor = (msg.author || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[📢❄️✅🔇🧹🛡️]/g, '').trim();

        let tagHTML = '';
        let tipButtonHTML = '';
        
        // Only show tags and tip button if they are a real player
        if (!safeAuthor.includes('ANNOUNCEMENT')) {
            if (msg.isOwner) tagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
            if (msg.equippedRank && typeof getRankTagHTML === 'function') tagHTML += getRankTagHTML(false, msg.equippedRank);
            
            tipButtonHTML = `<button class="chat-tip-btn" onclick="tipUser('${safeAuthor}')">Tip</button>`;
        }
        
        msgEl.innerHTML = `
            <div class="chat-msg-header">
                <div class="chat-author-wrapper">
                    <span class="${authorClass}">${tagHTML}${safeAuthor}</span>
                    ${tipButtonHTML}
                </div>
                <span class="chat-time">${timeStr}</span>
            </div>
            <div class="chat-text">${safeText}</div>
        `;
        chatContainer.appendChild(msgEl);
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    if (typeof currentUser === 'undefined' || !currentUser) {
        showToast('Please login to chat', 'warning');
        return;
    }

    const isOwnerUser = currentUser && currentUser.email === 'redadarwichepaypal@gmail.com';

    // Prevent regular users from chatting if muted
    if (window.chatMuted && !isOwnerUser) {
        showToast('Global chat is currently muted by an Admin.', 'error');
        return;
    }

    // Individual user mute check
    if (userProfile && userProfile.username && localStorage.getItem(`muted_${userProfile.username}`)) {
        showToast('You have been muted by an Admin', 'error');
        return;
    }

    const equippedRank = typeof getEquippedRank === 'function' ? getEquippedRank() : null;

    const msgData = {
        author: userProfile?.username || 'User',
        text: text,
        isOwner: isOwnerUser,
        equippedRank: equippedRank,
        time: Date.now()
    };

    if (socket && socket.connected) {
        socket.emit('send_chat', msgData);
    } else {
        globalMessages.push(msgData);
        if (globalMessages.length > 50) globalMessages.shift();
        localStorage.setItem('astrarise_offline_chat', JSON.stringify(globalMessages));
        renderChatMessages();
    }
    input.value = '';
}

function handleChatInput(e) {
    if (e.key === 'Enter') sendChatMessage();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initChat, 1000);
});
