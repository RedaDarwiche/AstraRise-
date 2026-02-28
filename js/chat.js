// chat.js
let globalMessages = [];
let announcementBannerTimer = null;

// Basic Profanity Filter
const BAD_WORDS = ['badword', 'scam', 'rigged', 'cheat', 'hack', 'fuck', 'shit', 'ass', 'bitch', 'scammer']; // Add your words here

function containsProfanity(text) {
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => lowerText.includes(word));
}

// ... (Keep showAnnouncementBanner and dismissAnnouncementBanner) ...

// Initialize Chat
function initChat() {
    // Clear initial render to prevent duplicates before socket loads
    const chatContainer = document.getElementById('chatMessages');
    if(chatContainer) chatContainer.innerHTML = '';

    if (socket && socket.connected !== undefined) {
        // Listen for chat history
        socket.on('chat_history', (messages) => {
            // FIX: Overwrite array instead of appending to avoid duplicates on refresh
            globalMessages = messages; 
            renderChatMessages();
        });

        // Listen for new messages
        socket.on('new_chat_message', (msg) => {
            globalMessages.push(msg);
            if (globalMessages.length > 50) globalMessages.shift();
            renderChatMessages();
            
            if (msg.author === '📢 ANNOUNCEMENT' && msg.text) {
                showAnnouncementBanner(msg.text);
            }
        });
    } else {
        // Only load local storage if socket is completely missing/offline
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

    if (localStorage.getItem(`muted_${currentUser.username}`)) {
        showToast('You have been muted by an Admin', 'error');
        return;
    }

    // FIX: Chat Moderation
    if (containsProfanity(text) && currentUser.email !== 'redadarwichepaypal@gmail.com') {
        showToast('Message blocked: Profanity detected.', 'error');
        input.value = ''; // Clear input
        return;
    }

    const isOwnerUser = currentUser.email === 'redadarwichepaypal@gmail.com'; // Use config var in real app
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
    if (e.key === 'Enter') {
        sendChatMessage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initChat, 1000);
});
