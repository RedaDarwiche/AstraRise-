// Vault System with Passive Income
let vaultBalance = 0;
let vaultPassiveInterval = null;
let vaultLastActive = null;
let vaultOfflineEarningsShown = false;

function getVaultBalance() {
    if (userProfile && userProfile.vault_balance !== undefined) {
        return safeParseNumber(userProfile.vault_balance);
    }
    return 0;
}

async function initVault() {
    if (!currentUser || !userProfile) return;
    
    vaultBalance = getVaultBalance();
    vaultLastActive = userProfile.last_active ? new Date(userProfile.last_active) : new Date();
    
    // Calculate offline earnings (1% per second while offline)
    const now = new Date();
    const offlineSeconds = Math.floor((now - vaultLastActive) / 1000);
    
    if (offlineSeconds > 5 && vaultBalance > 0 && !vaultOfflineEarningsShown) {
        const offlineRate = 0.01; // 1% per second offline
        const offlineEarnings = Math.floor(vaultBalance * offlineRate * offlineSeconds);
        
        if (offlineEarnings > 0) {
            // Cap offline earnings to prevent insane amounts (max 1 hour equivalent)
            const maxOfflineSeconds = 3600;
            const cappedSeconds = Math.min(offlineSeconds, maxOfflineSeconds);
            const cappedEarnings = Math.floor(vaultBalance * offlineRate * cappedSeconds);
            
            vaultBalance += cappedEarnings;
            
            // Save offline earnings notification to show when vault opens
            localStorage.setItem('astrarise_offline_earnings', cappedEarnings.toString());
            localStorage.setItem('astrarise_offline_seconds', cappedSeconds.toString());
            
            // Update DB
            await saveVaultBalance();
        }
        vaultOfflineEarningsShown = true;
    }
    
    // Update last_active
    await supabase.update('profiles', 
        { last_active: new Date().toISOString() },
        `id=eq.${currentUser.id}`
    );
    
    // Start passive income (5% per second online)
    startVaultPassiveIncome();
    
    updateVaultDisplay();
}

function startVaultPassiveIncome() {
    stopVaultPassiveIncome();
    
    vaultPassiveInterval = setInterval(async () => {
        if (!currentUser || vaultBalance <= 0) return;
        
        const onlineRate = 0.05; // 5% per second
        const earnings = Math.floor(vaultBalance * onlineRate);
        
        if (earnings > 0) {
            userBalance += earnings;
            // Cap balance
            userBalance = Math.min(userBalance, Number.MAX_SAFE_INTEGER);
            updateBalanceDisplay();
            
            // Save balance periodically (every tick)
            try {
                await supabase.update('profiles',
                    { high_score: userBalance, last_active: new Date().toISOString() },
                    `id=eq.${currentUser.id}`
                );
            } catch(e) {}
        }
        
        updateVaultDisplay();
    }, 1000);
}

function stopVaultPassiveIncome() {
    if (vaultPassiveInterval) {
        clearInterval(vaultPassiveInterval);
        vaultPassiveInterval = null;
    }
}

function updateVaultDisplay() {
    const balDisplay = document.getElementById('vaultBalanceDisplay');
    if (balDisplay) balDisplay.textContent = vaultBalance.toLocaleString();
    
    const rateDisplay = document.getElementById('vaultPassiveRate');
    if (rateDisplay) {
        const perSec = Math.floor(vaultBalance * 0.05);
        rateDisplay.textContent = `+${perSec.toLocaleString()}/sec (online)`;
    }
    
    const btnText = document.getElementById('vaultBtnText');
    if (btnText) {
        btnText.textContent = vaultBalance > 0 ? `Vault (${abbreviateNumber(vaultBalance)})` : 'Vault';
    }
    
    // Show offline earnings if they exist
    const offlineEarnings = localStorage.getItem('astrarise_offline_earnings');
    const offlineDiv = document.getElementById('vaultOfflineEarnings');
    const offlineAmountEl = document.getElementById('vaultOfflineAmount');
    
    if (offlineEarnings && parseInt(offlineEarnings) > 0 && offlineDiv) {
        offlineDiv.style.display = 'flex';
        if (offlineAmountEl) offlineAmountEl.textContent = '+' + parseInt(offlineEarnings).toLocaleString() + ' Astraphobia';
    }
}

function abbreviateNumber(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
}

async function depositToVault() {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    
    const amount = parseInt(document.getElementById('vaultAmount').value);
    if (!amount || amount < 1) { showToast('Minimum deposit is 1', 'error'); return; }
    if (amount > userBalance) { showToast('Insufficient balance', 'error'); return; }
    
    userBalance -= amount;
    vaultBalance += amount;
    
    updateBalanceDisplay();
    updateVaultDisplay();
    await saveVaultAndBalance();
    
    showToast(`Deposited ${amount.toLocaleString()} to Vault!`, 'success');
}

async function withdrawFromVault() {
    if (!currentUser) { showToast('Please login', 'error'); return; }
    
    const amount = parseInt(document.getElementById('vaultAmount').value);
    if (!amount || amount < 1) { showToast('Minimum withdrawal is 1', 'error'); return; }
    if (amount > vaultBalance) { showToast('Insufficient vault balance', 'error'); return; }
    
    vaultBalance -= amount;
    userBalance += amount;
    userBalance = Math.min(userBalance, Number.MAX_SAFE_INTEGER);
    
    updateBalanceDisplay();
    updateVaultDisplay();
    await saveVaultAndBalance();
    
    // Clear offline earnings notification after interacting
    localStorage.removeItem('astrarise_offline_earnings');
    localStorage.removeItem('astrarise_offline_seconds');
    const offlineDiv = document.getElementById('vaultOfflineEarnings');
    if (offlineDiv) offlineDiv.style.display = 'none';
    
    showToast(`Withdrew ${amount.toLocaleString()} from Vault!`, 'success');
}

async function saveVaultBalance() {
    if (!currentUser) return;
    try {
        await supabase.update('profiles',
            { vault_balance: vaultBalance },
            `id=eq.${currentUser.id}`
        );
    } catch(e) {
        console.error('Vault save error:', e);
    }
}

async function saveVaultAndBalance() {
    if (!currentUser) return;
    try {
        await supabase.update('profiles',
            { 
                high_score: userBalance, 
                vault_balance: vaultBalance,
                last_active: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            `id=eq.${currentUser.id}`
        );
    } catch(e) {
        console.error('Vault+Balance save error:', e);
    }
}

// When vault modal opens, show latest info
document.addEventListener('DOMContentLoaded', () => {
    // Override showModal to refresh vault when opening vault modal
    const origShowModal = window.showModal;
    window.showModal = function(id) {
        if (id === 'vaultModal') {
            updateVaultDisplay();
        }
        if (typeof origShowModal === 'function') {
            origShowModal(id);
        } else {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = 'flex';
        }
    };
});
