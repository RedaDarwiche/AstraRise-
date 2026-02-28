// Vault System with Passive Income (0.5% online only, NO offline earnings)
let vaultBalance = 0;
let vaultPassiveInterval = null;
let vaultLastActive = null;
let vaultSaveThrottle = 0;

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
    
    // NO offline earnings - vault earns nothing while offline
    
    try {
        await supabase.update('profiles', 
            { last_active: new Date().toISOString() },
            `id=eq.${currentUser.id}`
        );
    } catch(e) {}
    
    startVaultPassiveIncome();
    updateVaultDisplay();
}

function startVaultPassiveIncome() {
    stopVaultPassiveIncome();
    
    vaultPassiveInterval = setInterval(async () => {
        if (!currentUser || vaultBalance <= 0) return;
        
        // 0.5% per second while online
        const onlineRate = 0.005;
        const earnings = Math.floor(vaultBalance * onlineRate);
        
        if (earnings > 0) {
            userBalance += earnings;
            userBalance = Math.min(userBalance, Number.MAX_SAFE_INTEGER);
            updateBalanceDisplay();
            
            vaultSaveThrottle++;
            if (vaultSaveThrottle >= 5) {
                vaultSaveThrottle = 0;
                try {
                    await supabase.update('profiles',
                        { high_score: userBalance, last_active: new Date().toISOString() },
                        `id=eq.${currentUser.id}`
                    );
                } catch(e) {}
            }
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
        const perSec = Math.floor(vaultBalance * 0.005);
        rateDisplay.textContent = `+${perSec.toLocaleString()}/sec (online only)`;
    }
    
    const btnText = document.getElementById('vaultBtnText');
    if (btnText) {
        btnText.textContent = vaultBalance > 0 ? `Vault (${abbreviateNumber(vaultBalance)})` : 'Vault';
    }
    
    // Hide offline earnings display since we no longer have offline earnings
    const offlineDiv = document.getElementById('vaultOfflineEarnings');
    if (offlineDiv) offlineDiv.style.display = 'none';
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
    
    const amountInput = document.getElementById('vaultAmount');
    const amount = parseInt(amountInput.value);
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
    
    const amountInput = document.getElementById('vaultAmount');
    const amount = parseInt(amountInput.value);
    if (!amount || amount < 1) { showToast('Minimum withdrawal is 1', 'error'); return; }
    if (amount > vaultBalance) { showToast('Insufficient vault balance! You only have ' + vaultBalance.toLocaleString(), 'error'); return; }
    
    vaultBalance -= amount;
    userBalance += amount;
    userBalance = Math.min(userBalance, Number.MAX_SAFE_INTEGER);
    
    updateBalanceDisplay();
    updateVaultDisplay();
    
    await saveVaultAndBalance();
    
    showToast(`Withdrew ${amount.toLocaleString()} from Vault!`, 'success');
}

async function saveVaultBalance() {
    if (!currentUser) return;
    try {
        await supabase.update('profiles',
            { vault_balance: vaultBalance, last_active: new Date().toISOString() },
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
        if (userProfile) {
            userProfile.high_score = userBalance;
            userProfile.vault_balance = vaultBalance;
        }
    } catch(e) {
        console.error('Vault+Balance save error:', e);
    }
}
