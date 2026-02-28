// Limbo Game
async function playLimbo() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }

    const bet = parseInt(document.getElementById('limboBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    const target = parseFloat(document.getElementById('limboTarget').value);
    if (!target || target < 1.01) { showToast('Target must be at least 1.01', 'error'); return; }

    await updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    // Generate baseline result
    let r = Math.random();
    let baselineResult = Math.max(1.00, 0.99 / r);
    baselineResult = Math.min(baselineResult, 1000);

    // Check baseline win
    let isWin = baselineResult >= target;

    const tResult = handleTrollResult(isWin, target, bet);
    if (tResult.frozen) return;

    isWin = tResult.win;

    if (isWin) {
        result = target + Math.random() * 10;
    } else {
        result = 1 + Math.random() * (target - 1.01);
    }

    result = parseFloat(result.toFixed(2));

    const resultEl = document.getElementById('limboResult');
    const labelEl = document.getElementById('limboLabel');

    // Animate
    let animCount = 0;
    const animInterval = setInterval(() => {
        resultEl.textContent = (Math.random() * target * 2).toFixed(2) + 'x';
        animCount++;
        if (animCount > 12) {
            clearInterval(animInterval);
            resultEl.textContent = result.toFixed(2) + 'x';

            let effectiveTarget = target;

            if (result >= effectiveTarget) {
                // Win
                resultEl.className = 'limbo-result win';
                playCashoutSound();
                const effectiveMultiplier = effectiveTarget * getGlobalMultiplier();
                const winAmount = Math.floor(bet * effectiveMultiplier);
                updateBalance(userBalance + winAmount);
                totalWins++;
                labelEl.textContent = `Won ${winAmount} coins at ${effectiveTarget}x!`;
                showToast(`Won ${winAmount} Astraphobia!`, 'success');
            } else {
                resultEl.className = 'limbo-result lose';
                labelEl.textContent = `Needed ${effectiveTarget}x - Lost!`;
                showToast(`Lost ${bet}`, 'error');
            }
        }
    }, 60);
}