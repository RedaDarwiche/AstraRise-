// --- AUDIO SYSTEM ---
const audioBet = new Audio('sounds/bet.mp3');
const audioCashout = new Audio('sounds/cashout.mp3');

function playBetSound() {
    audioBet.currentTime = 0;
    audioBet.play().catch(e => console.warn("Sound blocked:", e));
}

function playCashoutSound() {
    audioCashout.currentTime = 0;
    audioCashout.play().catch(e => console.warn("Sound blocked:", e));
}

// ============================================
// AstraRise - Core Application Logic
// ============================================

// Navigation - SPA page routing
function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    // Show target page
    const target = document.getElementById('page-' + page);
    if (target) {
        target.style.display = 'block';
    } else {
        // Fallback to home
        const home = document.getElementById('page-home');
        if (home) home.style.display = 'block';
        return;
    }

    // Update active sidebar item
    document.querySelectorAll('.game-item').forEach(item => item.classList.remove('active'));
    const gameItems = document.querySelectorAll('.game-item');
    gameItems.forEach(item => {
        const onclick = item.getAttribute('onclick') || '';
        if (onclick.includes(`'${page}'`)) {
            item.classList.add('active');
        }
    });

    // Page-specific initialization
    switch (page) {
        case 'profile':
            if (typeof loadProfilePage === 'function') loadProfilePage();
            break;
        case 'forum':
            if (typeof loadForumPosts === 'function') loadForumPosts();
            break;
        case 'admin':
            if (typeof loadAdminUsers === 'function') loadAdminUsers();
            break;
        case 'roulette':
            if (typeof initRouletteWheel === 'function') initRouletteWheel();
            break;
        case 'keno':
            if (typeof initKenoGrid === 'function') initKenoGrid();
            break;
        case 'wheel':
            if (typeof initWheelCanvas === 'function') initWheelCanvas();
            break;
        case 'home':
            loadHomeStats();
            break;
        case 'leaderboard':
            if (typeof loadLeaderboard === 'function') loadLeaderboard();
            break;
        case 'shop':
            if (typeof renderShop === 'function') renderShop();
            break;
    }

    // Scroll to top
    window.scrollTo(0, 0);
}

// --- MODAL CONTROLS (FIXED) ---

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Focus first input in modal
        setTimeout(() => {
            const input = modal.querySelector('input');
            if (input) input.focus();
        }, 100);
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// FIX: Improved Modal Closing Logic
// We track where the mouse goes down. We only close if it started AND ended on the overlay.
// This prevents closing when dragging/highlighting text from inside the modal to the outside.
let modalMouseDownTarget = null;

document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        modalMouseDownTarget = e.target;
    } else {
        modalMouseDownTarget = null;
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.target.classList.contains('modal-overlay') && modalMouseDownTarget === e.target) {
        e.target.style.display = 'none';
    }
    modalMouseDownTarget = null;
});

// Toast notification system
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Icon SVGs for each type
    const icons = {
        success: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 6L9 17l-5-5" stroke="#00d26a" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        error: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="#ff4757" fill="none" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="#ff4757" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="#ff4757" stroke-width="2"/></svg>',
        warning: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#ffa502" fill="none" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="#ffa502" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#ffa502" stroke-width="2"/></svg>',
        info: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="#a29bfe" fill="none" stroke-width="2"/><line x1="12" y1="16" x2="12" y2="12" stroke="#a29bfe" stroke-width="2"/><line x1="12" y1="8" x2="12.01" y2="8" stroke="#a29bfe" stroke-width="2"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/></svg>
        </button>
    `;

    container.appendChild(toast);

    // Trigger slide-in animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Load home page stats
async function loadHomeStats() {
    const el = document.getElementById('totalUsersHome');
    if (!el) return;
    try {
        const profiles = await supabase.select('profiles', 'id,username');
        if (profiles && Array.isArray(profiles)) {
            // Only count profiles with actual usernames
            const realUsers = profiles.filter(p => p.username && p.username.length >= 3);
            el.textContent = realUsers.length;
        } else {
            el.textContent = '0';
        }
    } catch (e) {
        el.textContent = '0';
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape closes modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            if (m.style.display !== 'none') {
                m.style.display = 'none';
            }
        });
    }
});

// Initialize the application
async function initApp() {
    // Initialize auth (check for existing session)
    if (typeof initAuth === 'function') {
        await initAuth();
    }

    // Show home page by default
    navigateTo('home');
}

// Start app when DOM is ready and setup Listeners
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    
    // Listen for events from the server
    if (typeof socket !== 'undefined') {
        
        // 1. Gift Notification (Sent by Admin)
        socket.on('gift_notification', async (data) => {
            // Check if this notification is for me
            // data structure: { targetUsername, targetId, amount }
            if (currentUser && userProfile) {
                if (userProfile.username === data.targetUsername || currentUser.id === data.targetId) {
                    playCashoutSound();
                    showToast(`You received ${data.amount} Astraphobia from OWNER!`, 'success');
                    
                    // Refresh balance immediately by reloading profile
                    if (typeof loadProfile === 'function') {
                        await loadProfile();
                    }
                }
            }
        });
        
        // 2. Betting Freeze Updates (Sent by Admin)
        socket.on('admin_mode_update', (data) => {
            // data.mode is 'freeze_bets' or 'normal'
            if (typeof window.setTrollMode !== 'undefined') {
                // Update the global state variable manually
                window.serverMode = data.mode; 
                
                // Update UI text if present
                const modeEl = document.getElementById('adminCurrentMode');
                if (modeEl) {
                    const label = data.mode === 'freeze_bets' ? '❄️ BETS FROZEN' : 'NORMAL';
                    modeEl.textContent = label;
                }

                // Update Admin Button visual state
                if (typeof updateAdminButtons === 'function') {
                    updateAdminButtons();
                }
                
                if (data.mode === 'freeze_bets') {
                    showToast('❄️ Betting has been frozen by an admin.', 'warning');
                } else {
                    showToast('✅ Betting is now enabled.', 'success');
                }
            }
        });
    }
});
