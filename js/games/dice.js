// Dice Game
function updateDiceInfo() {
    const target = parseInt(document.getElementById('diceTarget').value);
    const slider = document.getElementById('diceTarget');
    const pct = ((target - 2) / 96) * 100;
    slider.style.setProperty('--target-pct', pct + '%');

    document.getElementById('diceTargetDisplay').textContent = target;

    const multiplier = 99 / (target - 1);
    document.getElementById('diceMultiplier').textContent = multiplier.toFixed(2) + 'x';
    document.getElementById('diceChance').textContent = (target - 1) + '%';

    const bet = parseFloat(document.getElementById('diceBet').value) || 0;
    const profit = (bet * multiplier - bet).toFixed(2);
    document.getElementById('dicePotentialProfit').textContent = profit;
}

async function playDice() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }

    // FREEZE CHECK
    if (window.serverMode === 'freeze_bets') {
        showToast('❄️ Betting is currently frozen by the Administrator.', 'error');
        return;
    }

    const bet = parseInt(document.getElementById('diceBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    const target = parseInt(document.getElementById('diceTarget').value);
    const multiplier = 99 / (target - 1);

    await updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    // Generate result
    let result = Math.random() * 100;

    // Check baseline win
    let isWin = result < target;

    // Apply troll logic
    const tResult = handleTrollResult(isWin, multiplier, bet);
    if (tResult.frozen) return; // double check

    isWin = tResult.win;
    const effectiveMultiplier = tResult.multiplier;

    // Adjust visual result to match forced outcome if needed
    if (isWin && result >= target) {
        result = Math.random() * (target - 1); // Force winning number
    } else if (!isWin && result < target) {
        result = target + Math.random() * (99 - target); // Force losing number
    }

    result = parseFloat(result.toFixed(2));

    const resultEl = document.getElementById('diceResult');
    const labelEl = document.getElementById('diceResultLabel');

    // Animate result
    let animCount = 0;
    const animInterval = setInterval(() => {
        resultEl.textContent = (Math.random() * 100).toFixed(2);
        animCount++;
        if (animCount > 15) {
            clearInterval(animInterval);
            resultEl.textContent = result.toFixed(2);

            if (isWin) {
                // Win
                resultEl.className = 'dice-result-number win';
                playCashoutSound();
                const winAmount = Math.floor(bet * effectiveMultiplier);
                updateBalance(userBalance + winAmount);
                totalWins++;
                labelEl.textContent = `You won ${winAmount} coins!`;
                showToast(`Won ${winAmount} Astraphobia!`, 'success');
            } else {
                // Lose
                resultEl.className = 'dice-result-number lose';
                labelEl.textContent = 'You lost!';
                showToast(`Lost ${bet} Astraphobia`, 'error');
            }
        }
    }, 50);
}

// Initialize dice slider
document.addEventListener('DOMContentLoaded', () => {
    updateDiceInfo();
});
