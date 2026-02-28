// Daily Reward System
function initDailyReward() {
    updateDailyButton();
    setInterval(updateDailyButton, 1000);
}

function getLastClaim() {
    return localStorage.getItem('astrarise_daily_claim');
}

function canClaimDaily() {
    const lastClaim = getLastClaim();
    if (!lastClaim) return true;
    const diff = Date.now() - parseInt(lastClaim);
    return diff >= 24 * 60 * 60 * 1000;
}

function getTimeUntilClaim() {
    const lastClaim = getLastClaim();
    if (!lastClaim) return 0;
    const diff = 24 * 60 * 60 * 1000 - (Date.now() - parseInt(lastClaim));
    return Math.max(0, diff);
}

function formatCountdown(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateDailyButton() {
    const btn = document.getElementById('dailyBtn');
    const text = document.getElementById('dailyBtnText');
    if (!btn || !text) return;

    if (canClaimDaily()) {
        text.textContent = 'Claim Daily';
        btn.disabled = false;
    } else {
        const remaining = getTimeUntilClaim();
        text.textContent = formatCountdown(remaining);
        btn.disabled = true;
    }
}

async function claimDaily() {
    if (!currentUser) {
        showToast('Please login to claim daily reward', 'error');
        return;
    }
    if (!canClaimDaily()) {
        showToast('Daily reward already claimed', 'warning');
        return;
    }

    localStorage.setItem('astrarise_daily_claim', Date.now().toString());
    await updateBalance(userBalance + 100);
    showToast('Claimed 100 Astraphobia coins!', 'success');
    updateDailyButton();
}