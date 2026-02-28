// chat.js
let globalMessages = [];
let announcementBannerTimer = null;

// Basic Profanity Filter
const BAD_WORDS = ['scam', 'cheat', 'rigged', 'hack', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot', 'retard']; 

function containsProfanity(text) {
    const lowerText = text.toLowerCase();
    // Check if any bad word is present
    return BAD_WORDS.some(word => lowerText.includes(word));
}

// Show big in-game announcement banner (stays 25 seconds or until dismiss)
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

// Initialize Chat
function initChat() {
    // Clear to avoid visual duplication on re-init
    const chatContainer = document.getElementById('chatMessages');
    if(chatContainer) chatContainer.innerHTML = '';

    if (socket && socket.connected !== undefined) {
        // Listen for chat history
        socket.on('chat_history', (messages) => {
            // FIX: Overwrite history instead of appending
            globalMessages = messages;
            renderChatMessages();
        });

        // Listen for new messages
        socket.on('new_chat_message', (msg) => {
            globalMessages.push(msg);
            if (globalMessages.length > 50) globalMessages.shift();
            renderChatMessages();
            // Show big announcement banner when admin sends one
            if (msg.author === '📢 ANNOUNCEMENT' && msg.text) {
                showAnnouncementBanner(msg.text);
            }
        });
    }

    // Load offline messages if no server
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

        // Escape HTML to prevent XSS (basic)
        const safeText = msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeAuthor = msg.author.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        let authorDisplay = safeAuthor;
        // Show rank tags
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

    // Scroll to bottom
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
    
    // FIX: Moderation Check
    if (containsProfanity(text) && currentUser.email !== 'redadarwichepaypal@gmail.com') {
        showToast('Message blocked: Profanity detected.', 'error');
        input.value = '';
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

    // Try server first
    if (socket && socket.connected) {
        socket.emit('send_chat', msgData);
    } else {
        // Offline fallback — add locally
        globalMessages.push(msgData);
        if (globalMessages.length > 50) globalMessages.shift();
        localStorage.setItem('astrarise_offline_chat', JSON.stringify(globalMessages));
        renderChatMessages();
    }

    input.value = '';
}

function handleChatInput(e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
}

// Ensure initChat is called
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initChat, 1000);
});
