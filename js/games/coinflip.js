// Coin Flip Game
let coinFlipping = false;

async function playCoinflip(choice) {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }
    if (coinFlipping) return;

    // FREEZE CHECK
    if (window.serverMode === 'freeze_bets') {
        showToast('❄️ Betting is currently frozen by the Administrator.', 'error');
        return;
    }

    const bet = parseInt(document.getElementById('coinflipBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    await updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();
    coinFlipping = true;

    // Determine baseline result
    let baselineResult = Math.random() > 0.5 ? 'heads' : 'tails';
    let isWin = baselineResult === choice;

    // Apply troll logic
    const tResult = handleTrollResult(isWin, 1.98, bet);
    if (tResult.frozen) {
        coinFlipping = false;
        return;
    }

    isWin = tResult.win;

    // Force result to match troll outcome
    let result = choice;
    if (!isWin) {
        result = choice === 'heads' ? 'tails' : 'heads';
    }

    const coin = document.getElementById('coin');
    const resultEl = document.getElementById('coinflipResult');
    resultEl.textContent = 'Flipping...';
    resultEl.style.color = '#b8b8d0';

    coin.className = 'coin flipping';

    setTimeout(() => {
        coin.classList.remove('flipping');
        if (result === 'tails') {
            coin.classList.add('show-tails');
        } else {
            coin.classList.remove('show-tails');
        }

        const won = result === choice;

        if (won) {
            const multiplier = 1.98 * getGlobalMultiplier();
            playCashoutSound();
            const winAmount = Math.floor(bet * multiplier);
            updateBalance(userBalance + winAmount);
            totalWins++;
            resultEl.textContent = `${result.toUpperCase()} - Won ${winAmount}!`;
            resultEl.style.color = '#00d26a';
            showToast(`Won ${winAmount} Astraphobia!`, 'success');
        } else {
            resultEl.textContent = `${result.toUpperCase()} - Lost!`;
            resultEl.style.color = '#ff4757';
            showToast(`Lost ${bet}`, 'error');
        }

        coinFlipping = false;
    }, 1000);
}
