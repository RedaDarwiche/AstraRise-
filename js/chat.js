// chat.js
let globalMessages = [];
let announcementBannerTimer = null;

// Basic Profanity Filter
const BAD_WORDS = ['scam', 'cheat', 'rigged', 'hack', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot', 'retard']; 

function containsProfanity(text) {
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => lowerText.includes(word));
}

// Show big in-game announcement banner
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
    const chatContainer = document.getElementById('chatMessages');
    if(chatContainer) chatContainer.innerHTML = '';

    if (socket && socket.connected !== undefined) {
        // Listen for chat history
        socket.on('chat_history', (messages) => {
            // Overwrite history to sync with server
            globalMessages = messages;
            renderChatMessages();
        });

        // Listen for new messages from OTHERS
        socket.on('new_chat_message', (msg) => {
            // DEDUPLICATION CHECK:
            // Check if we already have this message (by ID or exact content/time/author match)
            // This prevents the "double message" bug since we render our own messages immediately now.
            const exists = globalMessages.some(m => 
                (m.id && m.id === msg.id) || 
                (m.author === msg.author && m.text === msg.text && Math.abs(m.time - msg.time) < 500)
            );

            if (!exists) {
                globalMessages.push(msg);
                if (globalMessages.length > 50) globalMessages.shift();
                renderChatMessages();
            }

            // Show announcement banner if applicable
            if (msg.author === '📢 ANNOUNCEMENT' && msg.text) {
                showAnnouncementBanner(msg.text);
            }
        });
    }

    // Load offline messages if no server connection logic kicked in
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

        // Escape HTML to prevent XSS
        const safeText = (msg.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeAuthor = (msg.author || 'User').replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

    // Auto-scroll to bottom
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
    
    // Moderation Check (Owner Bypass)
    if (containsProfanity(text) && currentUser.email !== 'redadarwichepaypal@gmail.com') {
        showToast('Message blocked: Profanity detected.', 'error');
        input.value = '';
        return;
    }

    const isOwnerUser = currentUser.email === 'redadarwichepaypal@gmail.com';
    const equippedRank = typeof getEquippedRank === 'function' ? getEquippedRank() : null;

    // Create message object with unique ID
    const msgData = {
        author: userProfile?.username || 'User',
        text: text,
        isOwner: isOwnerUser,
        equippedRank: equippedRank,
        time: Date.now(),
        id: Date.now() + Math.random().toString(36).substr(2, 9) // Unique ID for deduplication
    };

    // 1. OPTIMISTIC RENDER: Show message immediately to sender
    globalMessages.push(msgData);
    if (globalMessages.length > 50) globalMessages.shift();
    renderChatMessages();

    // 2. Send to Server
    if (socket && socket.connected) {
        socket.emit('send_chat', msgData);
    } else {
        // Offline fallback
        localStorage.setItem('astrarise_offline_chat', JSON.stringify(globalMessages));
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
