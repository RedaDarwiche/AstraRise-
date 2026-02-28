// chat.js
let globalMessages =[];
let announcementBannerTimer = null;

function showAnnouncementBanner(text) {
    const banner = document.getElementById('announcementBanner');
    const textEl = document.getElementById('announcementBannerText');
    if (!banner || !textEl) return;
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
    renderChatMessages();

    if (socket && socket.connected !== undefined) {
        socket.on('chat_history', (messages) => {
            globalMessages = messages;
            renderChatMessages();
            
            // MAGIC SYNC: Check history so late-joiners get frozen too
            const announcements = messages.filter(m => m.author === '📢 ANNOUNCEMENT');
            if (announcements.length > 0) {
                const lastMsg = announcements[announcements.length - 1].text;
                if (lastMsg.includes('❄️ Betting is temporarily frozen')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('freeze_bets');
                } else if (lastMsg.includes('✅ Betting has resumed')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('normal');
                }
            }
        });

        socket.on('new_chat_message', (msg) => {
            globalMessages.push(msg);
            if (globalMessages.length > 50) globalMessages.shift();
            renderChatMessages();
            
            if (msg.author === '📢 ANNOUNCEMENT' && msg.text) {
                showAnnouncementBanner(msg.text);
                
                // MAGIC SYNC: Instantly freeze all active players when announcement drops
                if (msg.text.includes('❄️ Betting is temporarily frozen')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('freeze_bets');
                } else if (msg.text.includes('✅ Betting has resumed')) {
                    if (typeof window.applyServerMode === 'function') window.applyServerMode('normal');
                }
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

function renderChatMessages() {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;
    chatContainer.innerHTML = '';

    globalMessages.forEach(msg => {
        const date = new Date(msg.time);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';
        const authorClass = msg.isOwner ? 'chat-author owner' : 'chat-author';
        const safeText = msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeAuthor = msg.author.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        let tagHTML = '';
        if (msg.author !== '📢 ANNOUNCEMENT') {
            if (msg.isOwner) tagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
            if (msg.equippedRank && typeof getRankTagHTML === 'function') tagHTML += getRankTagHTML(false, msg.equippedRank);
        }
        
        msgEl.innerHTML = `
            <div class="chat-msg-header">
                <span class="${authorClass}">${tagHTML}${safeAuthor}</span>
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

    if (localStorage.getItem(`muted_${currentUser.username}`)) {
        showToast('You have been muted by an Admin', 'error');
        return;
    }

    const isOwnerUser = currentUser.email === 'redadarwichepaypal@gmail.com';
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
