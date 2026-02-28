// --- START OF FILE auth.js ---

// Auth State
let currentUser = null;
let userProfile = null;
let userBalance = 0;
let totalWins = 0;
let totalWagered = 0;

async function initAuth() {
    try {
        const user = await supabase.getUser();
        if (user && user.id) {
            currentUser = user;
            await loadProfile();
            updateAuthUI(true);
        } else {
            updateAuthUI(false);
        }
    } catch (e) {
        console.error('Auth init error:', e);
        updateAuthUI(false);
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        const data = await supabase.signIn(email, password);
        
        // 1. Try to get user from response
        currentUser = data.user;
        
        // 2. Fallback: If user object is missing but we have a token, fetch user explicitly
        if (!currentUser && (data.access_token || localStorage.getItem('sb_access_token'))) {
            currentUser = await supabase.getUser();
        }

        if (!currentUser) {
            throw new Error('Login failed: Unable to retrieve user details.');
        }

        try {
            await loadProfile();
        } catch (profileErr) {
            console.error('Profile load after login:', profileErr);
            // Still show logged-in UI even if profile fetch fails
            userBalance = 0;
        }
        
        updateAuthUI(true);
        hideModal('loginModal');
        showToast('Welcome back!', 'success');
    } catch (e) {
        console.error("Login Error:", e);
        showToast(e.message || 'Login failed', 'error');
    }
}


async function signup() {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (!username || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        const data = await supabase.signUp(email, password);

        // Try to sign in immediately after signup
        try {
            const loginData = await supabase.signIn(email, password);
            currentUser = loginData.user;
        } catch (loginErr) {
            // If auto-login fails, the user might need to confirm email
            if (data.user) {
                currentUser = data.user;
            } else {
                showToast('Account created! Please check your email or try logging in.', 'info');
                hideModal('signupModal');
                return;
            }
        }

        // Fallback safety for signup flow as well
        if (!currentUser && (data.access_token || localStorage.getItem('sb_access_token'))) {
            currentUser = await supabase.getUser();
        }

        // Create profile
        if (currentUser && currentUser.id) {
            try {
                await supabase.insert('profiles', {
                    id: currentUser.id,
                    username: username,
                    high_score: 100,
                    updated_at: new Date().toISOString()
                });
            } catch (profileErr) {
                // Profile might already exist, try upsert
                try {
                    await supabase.upsert('profiles', {
                        id: currentUser.id,
                        username: username,
                        high_score: 100,
                        updated_at: new Date().toISOString()
                    });
                } catch (e2) {
                    console.error('Profile creation error:', e2);
                }
            }
        }

        await loadProfile();
        updateAuthUI(true);
        hideModal('signupModal');
        showToast('Account created! You received 100 Astraphobia coins!', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function logout() {
    await supabase.signOut();
    currentUser = null;
    userProfile = null;
    userBalance = 0;
    updateAuthUI(false);
    navigateTo('home');
    showToast('Logged out successfully', 'info');
}

async function loadProfile() {
    if (!currentUser) return;
    try {
        const profile = await supabase.selectSingle('profiles', '*', `id=eq.${currentUser.id}`);
        if (profile) {
            userProfile = profile;
            userBalance = profile.high_score || 0;
            updateBalanceDisplay();
        } else {
            // Create profile if not exists
            await supabase.insert('profiles', {
                id: currentUser.id,
                username: currentUser.email.split('@')[0],
                high_score: 100,
                updated_at: new Date().toISOString()
            });
            userBalance = 100;
            userProfile = { id: currentUser.id, username: currentUser.email.split('@')[0], high_score: 100 };
            updateBalanceDisplay();
        }
    } catch (e) {
        console.error('Load profile error:', e);
        // Try creating profile
        try {
            await supabase.upsert('profiles', {
                id: currentUser.id,
                username: currentUser.email.split('@')[0],
                high_score: 100,
                updated_at: new Date().toISOString()
            });
            userBalance = 100;
            userProfile = { id: currentUser.id, username: currentUser.email.split('@')[0], high_score: 100 };
            updateBalanceDisplay();
        } catch (e2) {
            console.error('Profile creation fallback error:', e2);
        }
    }
}

async function updateBalance(newBalance) {
    userBalance = Math.max(0, Math.round(newBalance));
    updateBalanceDisplay();
    if (currentUser) {
        try {
            await supabase.update('profiles',
                { high_score: userBalance, updated_at: new Date().toISOString() },
                `id=eq.${currentUser.id}`
            );
        } catch (e) {
            console.error('Balance update error:', e);
        }
    }
}

function updateBalanceDisplay() {
    const el = document.getElementById('balanceAmount');
    if (el) el.textContent = userBalance.toLocaleString();
}

function updateAuthUI(loggedIn) {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const balanceDisplay = document.getElementById('balanceDisplay');
    const dailyBtn = document.getElementById('dailyBtn');
    const profileNavBtn = document.getElementById('profileNavBtn');
    const floatingAdminBtn = document.getElementById('floatingAdminBtn');
    const createPostBtn = document.getElementById('createPostBtn');

    // Ensure logic handles potential null currentUser gracefully
    if (loggedIn && currentUser) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        balanceDisplay.style.display = 'flex';
        dailyBtn.style.display = 'flex';
        profileNavBtn.style.display = 'flex';
        if (createPostBtn) createPostBtn.style.display = 'flex';

        const avatar = document.getElementById('userAvatar');
        if (userProfile && userProfile.username) {
            avatar.textContent = userProfile.username.charAt(0).toUpperCase();
        } else if (currentUser.email) {
            avatar.textContent = currentUser.email.charAt(0).toUpperCase();
        }

        // Check if owner
        const isOwnerUser = currentUser.email === OWNER_EMAIL;
        if (isOwnerUser) {
            if (floatingAdminBtn) {
                floatingAdminBtn.style.display = 'flex';
            } else {
                // DOM might not be ready yet, retry after a short delay
                setTimeout(() => {
                    const btn = document.getElementById('floatingAdminBtn');
                    if (btn) btn.style.display = 'flex';
                }, 500);
            }
        }

        updateBalanceDisplay();
        initDailyReward();
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
        balanceDisplay.style.display = 'none';
        dailyBtn.style.display = 'none';
        profileNavBtn.style.display = 'none';
        if (floatingAdminBtn) floatingAdminBtn.style.display = 'none';
        if (createPostBtn) createPostBtn.style.display = 'none';
    }
}

function isOwner() {
    return currentUser && currentUser.email === OWNER_EMAIL;
}

// Ensure owner button shows up reliably
function checkAndShowOwnerBtn() {
    const btn = document.getElementById('floatingAdminBtn');
    if (!btn) return;
    if (currentUser && currentUser.email === OWNER_EMAIL) {
        btn.style.display = 'flex';
        console.log('Owner button activated for:', currentUser.email);
    }
}

// Run the owner check after a delay too, in case auth is slow
setTimeout(checkAndShowOwnerBtn, 2000);
setTimeout(checkAndShowOwnerBtn, 5000);
