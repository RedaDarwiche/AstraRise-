// chat.js - FIXED double message issue
let globalMessages = [];
let announcementBannerTimer = null;
let chatInitialized = false;

const BAD_WORDS = ['scam', 'cheat', 'rigged', 'hack', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot', 'retard']; 

function containsProfanity(text) {
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => lowerText.includes(word));
}

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
    if (chatInitialized) return; // Prevent double initialization
    chatInitialized = true;
    
    const chatContainer = document.getElementById('chatMessages');
    if(chatContainer) chatContainer.innerHTML = '';

    if (socket && socket.connected !== undefined) {
        socket.on('chat_history', (messages) => {
            globalMessages = messages;
            renderChatMessages();
        });

        // KEY FIX: Don't use optimistic rendering. Only render messages from server.
        socket.on('new_chat_message', (msg) => {
            // Simply add every message from server
            // Server is the single source of truth
            globalMessages.push(msg);
            if (globalMessages.length > 50) globalMessages.shift();
            renderChatMessages();

            if (msg.author === '📢 ANNOUNCEMENT' && msg.text) {
                showAnnouncementBanner(msg.text);
            }
        });
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

        const safeText = (msg.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeAuthor = (msg.author || 'User').replace(/</g, "&lt;").replace(/>/g, "&gt;");

        let authorDisplay = safeAuthor;
        
        let tagHTML = '';
        if (msg.author !== '📢 ANNOUNCEMENT') {
            if (msg.isOwner) {
                tagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
            }
            if (msg.equippedRank && typeof getRankTagHTML === 'function') {
                tagHTML += getRankTagHTML(false, msg.equippedRank);
            }
        }
        authorDisplay = tagHTML + safeAuthor;

        msgEl.innerHTML = `
            <div class="chat-msg-header">
                <span class="${authorClass}">${authorDisplay}</span>
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

    if (containsProfanity(text) && currentUser.email !== OWNER_EMAIL) {
        showToast('Message blocked: Profanity detected.', 'error');
        input.value = '';
        return;
    }

    const isOwnerUser = currentUser.email === OWNER_EMAIL;
    const equippedRank = typeof getEquippedRank === 'function' ? getEquippedRank() : null;

    const msgData = {
        author: userProfile?.username || 'User',
        text: text,
        isOwner: isOwnerUser,
        equippedRank: equippedRank,
        time: Date.now()
    };

    // NO optimistic render - just send to server and wait for echo
    if (socket && socket.connected) {
        socket.emit('send_chat', msgData);
    } else {
        // Offline fallback - render locally only
        globalMessages.push(msgData);
        if (globalMessages.length > 50) globalMessages.shift();
        renderChatMessages();
        localStorage.setItem('astrarise_offline_chat', JSON.stringify(globalMessages));
        showToast('Chat offline. Connecting...', 'warning');
    }

    input.value = '';
}

function handleChatInput(e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initChat, 1000);
});
