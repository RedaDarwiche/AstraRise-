// chat.js
let globalMessages =[];
let announcementBannerTimer = null;

// Dynamically inject CSS for the Tip button so you don't have to edit styles.css
const chatStyle = document.createElement('style');
chatStyle.innerHTML = `
    .chat-author-wrapper { display: inline-flex; align-items: center; gap: 6px; position: relative; }
    .chat-tip-btn { display: none; background: var(--warning); color: #000; border: none; border-radius: 4px; padding: 2px 6px; font-size: 0.7em; cursor: pointer; font-weight: bold; text-transform: uppercase; }
    .chat-msg-header:hover .chat-tip-btn { display: inline-block; }
`;
document.head.appendChild(chatStyle);

function showAnnouncementBanner(text) {
    const banner = document.getElementById('announcementBanner');
    const textEl = document.getElementById('announcementBannerText');
    if (!banner || !textEl) return;
    
    // Ensure no emojis in the label
    const label = banner.querySelector('.announcement-banner-label');
    if (label) label.textContent = 'ANNOUNCEMENT';

    if (announcementBannerTimer) {
        clearTimeout(announcementBannerTimer);
        announcementBannerTimer = null;
    }
    const safeText = (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    textEl.innerHTML = safeText;
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
    window.chatMuted = false;
    renderChatMessages();

    if (socket && socket.connected !== undefined) {
        socket.on('chat_history', (messages) => {
            // Filter out system backend messages from history
            globalMessages = messages.filter(m => m.author !== 'SYSTEM_GIFT' && m.author !== 'SYSTEM_TIP');
            renderChatMessages();
            
            // MAGIC SYNC: Restore Freeze/Mute states without emojis
            let isFrozen = false;
            let isMuted = false;
            const announcements = messages.filter(m => m.author === 'ANNOUNCEMENT');
            
            announcements.forEach(msg => {
                if (msg.text.includes('Betting is temporarily frozen')) isFrozen = true;
                if (msg.text.includes('Betting has resumed')) isFrozen = false;
                if (msg.text.includes('Global chat is now muted')) isMuted = true;
                if (msg.text.includes('Global chat has been unmuted')) isMuted = false;
            });
            
            if (typeof window.applyServerMode === 'function') {
                window.applyServerMode(isFrozen ? 'freeze_bets' : 'normal');
            }
            window.chatMuted = isMuted;
            
            const muteBtn = document.getElementById('btnMuteChat');
            if (muteBtn) muteBtn.textContent = window.chatMuted ? 'Unmute Global Chat' : 'Lock Global Chat';
        });

        socket.on('new_chat_message', (msg) => {
            // INTERCEPT HIDDEN TIPS & GIFTS (Do not render in chat)
            if (msg.author === 'SYSTEM_GIFT' || msg.author === 'SYSTEM_TIP') {
                try {
                    const data = JSON.parse(msg.text);
                    if (userProfile && userProfile.username === data.to) {
                        const title = msg.author === 'SYSTEM_GIFT' ? 'OWNER' : data.from;
                        showToast(`You received ${data.amount} Astraphobia from ${title}!`, 'success');
                        
                        // Instantly refresh balance safely
                        if (typeof loadProfile === 'function') loadProfile();
                    }
                } catch(e) {}
                return; // Stop here!
            }

            globalMessages.push(msg);
            if (globalMessages.length > 50) globalMessages.shift();
            renderChatMessages();
            
            if (msg.author === 'ANNOUNCEMENT' && msg.text) {
                showAnnouncementBanner(msg.text);
                
                // Live state syncs
                if (msg.text.includes('Betting is temporarily frozen')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('freeze_bets');
                } else if (msg.text.includes('Betting has resumed')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('normal');
                } else if (msg.text.includes('Global chat is now muted')) {
                    window.chatMuted = true;
                } else if (msg.text.includes('Global chat has been unmuted')) {
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

async function tipUser(targetUsername) {
    if (!currentUser || !userProfile) { showToast('Please login to tip users', 'error'); return; }
    if (targetUsername === userProfile.username) { showToast('You cannot tip yourself!', 'warning'); return; }
    if (targetUsername === 'ANNOUNCEMENT') return;
    
    const amountStr = prompt(`How much Astraphobia do you want to tip ${targetUsername}?`);
    if (!amountStr) return;
    const amount = parseInt(amountStr);
    
    if (isNaN(amount) || amount <= 0) { showToast('Invalid amount', 'error'); return; }
    if (amount > userBalance) { showToast('Insufficient balance', 'error'); return; }

    try {
        // Trigger the Supabase RPC function we created
        await supabase.query('rpc/tip_user', 'POST', {
            body: { sender_id: currentUser.id, target_username: targetUsername, tip_amount: amount }
        });
        
        // Deduct locally and save
        updateBalance(userBalance - amount);
        showToast(`Successfully tipped ${amount} to ${targetUsername}!`, 'success');
        
        // Send hidden system notification via Chat Socket
        if (socket && socket.connected) {
            socket.emit('send_chat', {
                author: 'SYSTEM_TIP',
                text: JSON.stringify({ from: userProfile.username, to: targetUsername, amount: amount })
            });
        }
    } catch (e) {
        console.error(e);
        showToast('Tipping failed! Make sure the Admin ran the SQL fix.', 'error');
    }
}

function renderChatMessages() {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;
    chatContainer.innerHTML = '';

    globalMessages.forEach(msg => {
        // Double check we don't render system messages
        if (msg.author === 'SYSTEM_GIFT' || msg.author === 'SYSTEM_TIP') return;

        const date = new Date(msg.time);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';
        const authorClass = msg.isOwner ? 'chat-author owner' : 'chat-author';
        const safeText = msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeAuthor = msg.author.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        let tagHTML = '';
        let tipButtonHTML = '';
        if (msg.author !== 'ANNOUNCEMENT') {
            if (msg.isOwner) tagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
            if (msg.equippedRank && typeof getRankTagHTML === 'function') tagHTML += getRankTagHTML(false, msg.equippedRank);
            
            // Inject the Tip Button
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

    const isOwnerUser = currentUser.email === 'redadarwichepaypal@gmail.com';

    if (window.chatMuted && !isOwnerUser) {
        showToast('Global chat is currently muted by an Admin.', 'error');
        return;
    }

    if (localStorage.getItem(`muted_${currentUser.username}`)) {
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
