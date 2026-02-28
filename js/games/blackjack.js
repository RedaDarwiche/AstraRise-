// Blackjack Game
let bjDeck = [];
let bjPlayerHand = [];
let bjDealerHand = [];
let bjBetAmount = 0;
let bjGameActive = false;

const suits = ['H', 'D', 'C', 'S'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardValue(hand) {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
        if (card.rank === 'A') { total += 11; aces++; }
        else if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
        else total += parseInt(card.rank);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

function renderCard(card, hidden = false) {
    if (hidden) {
        return '<div class="bj-card hidden-card">?</div>';
    }
    const isRed = card.suit === 'H' || card.suit === 'D';
    const suitSymbol = { H: '\u2665', D: '\u2666', C: '\u2663', S: '\u2660' }[card.suit];
    return `<div class="bj-card ${isRed ? 'red' : 'black'}">${card.rank}<br>${suitSymbol}</div>`;
}

function renderHands(showDealerHole = false) {
    const dealerCards = document.getElementById('bjDealerCards');
    const playerCards = document.getElementById('bjPlayerCards');
    const dealerScore = document.getElementById('bjDealerScore');
    const playerScore = document.getElementById('bjPlayerScore');

    playerCards.innerHTML = bjPlayerHand.map(c => renderCard(c)).join('');
    playerScore.textContent = `(${cardValue(bjPlayerHand)})`;

    if (showDealerHole) {
        dealerCards.innerHTML = bjDealerHand.map(c => renderCard(c)).join('');
        dealerScore.textContent = `(${cardValue(bjDealerHand)})`;
    } else {
        dealerCards.innerHTML = renderCard(bjDealerHand[0]) + renderCard(bjDealerHand[1], true);
        dealerScore.textContent = `(${cardValue([bjDealerHand[0]])})`;
    }
}

function startBlackjack() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }

    // FREEZE CHECK
    if (window.serverMode === 'freeze_bets') {
        showToast('❄️ Betting is currently frozen by the Administrator.', 'error');
        return;
    }

    const bet = parseInt(document.getElementById('bjBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    bjBetAmount = bet;
    updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    bjDeck = createDeck();
    bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
    bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
    bjGameActive = true;

    document.getElementById('bjResult').textContent = '';
    document.getElementById('bjResult').style.color = '';
    document.getElementById('bjDealBtn').style.display = 'none';
    document.getElementById('bjActions').style.display = 'flex';

    renderHands();

    // Check blackjack
    if (cardValue(bjPlayerHand) === 21) {
        bjStand();
    }
}

function bjHit() {
    if (!bjGameActive) return;
    bjPlayerHand.push(bjDeck.pop());
    renderHands();

    if (cardValue(bjPlayerHand) > 21) {
        bjEndGame('bust');
    } else if (cardValue(bjPlayerHand) === 21) {
        bjStand();
    }
}

function bjStand() {
    if (!bjGameActive) return;

    const trollMode = getTrollMode();

    // Dealer draws
    while (cardValue(bjDealerHand) < 17) {
        bjDealerHand.push(bjDeck.pop());
    }

    if (trollMode === 'always_lose') {
        // Force dealer to have better hand
        while (cardValue(bjDealerHand) <= cardValue(bjPlayerHand) && cardValue(bjDealerHand) < 21) {
            bjDealerHand.push(bjDeck.pop());
            if (cardValue(bjDealerHand) > 21) break;
        }
    }

    renderHands(true);

    const playerVal = cardValue(bjPlayerHand);
    const dealerVal = cardValue(bjDealerHand);

    if (dealerVal > 21) bjEndGame('dealer_bust');
    else if (playerVal > dealerVal) bjEndGame('win');
    else if (playerVal === dealerVal) bjEndGame('push');
    else bjEndGame('lose');
}

function bjEndGame(result) {
    bjGameActive = false;
    renderHands(true);

    const resultEl = document.getElementById('bjResult');
    document.getElementById('bjDealBtn').style.display = 'block';
    document.getElementById('bjActions').style.display = 'none';

    let effectiveMultiplier = getGlobalMultiplier();

    // Baseline win logic
    const isBlackjack = bjPlayerHand.length === 2 && cardValue(bjPlayerHand) === 21;
    let baseMultiplier = 0;
    if (result === 'win' || result === 'dealer_bust') baseMultiplier = isBlackjack ? 2.5 : 2;
    else if (result === 'push') baseMultiplier = 1;

    let isWin = baseMultiplier >= 2;

    // Apply troll logic
    const tResult = handleTrollResult(isWin, baseMultiplier, bjBetAmount);
    if (tResult.frozen) return;

    isWin = tResult.win;

    // Force outcome
    if (isWin && (result === 'lose' || result === 'bust')) {
        result = 'win';
        baseMultiplier = Math.max(2, tResult.multiplier);
    } else if (!isWin && (result === 'win' || result === 'dealer_bust')) {
        result = 'lose';
        baseMultiplier = 0;
    } else if (!isWin && result === 'push' && tResult.multiplier === 0) {
        result = 'lose';
        baseMultiplier = 0;
    }

    if (result === 'win' || result === 'dealer_bust') {
        baseMultiplier = Math.max(baseMultiplier, tResult.multiplier);
    }

    switch (result) {
        case 'bust':
            resultEl.textContent = 'BUST! You lose!';
            resultEl.style.color = '#ff4757';
            showToast(`Bust! Lost ${bjBetAmount}`, 'error');
            break;
        case 'dealer_bust':
        case 'win':
            const isBlackjack = bjPlayerHand.length === 2 && cardValue(bjPlayerHand) === 21;
            const multiplier = isBlackjack ? 2.5 : 2;
            const winAmount = Math.floor(bjBetAmount * multiplier * effectiveMultiplier);
            updateBalance(userBalance + winAmount);
            playCashoutSound();
            totalWins++;
            resultEl.textContent = isBlackjack ? `BLACKJACK! Won ${winAmount}!` : `You win ${winAmount}!`;
            resultEl.style.color = '#00d26a';
            showToast(`Won ${winAmount} Astraphobia!`, 'success');
            break;
        case 'push':
            updateBalance(userBalance + bjBetAmount);
            resultEl.textContent = 'PUSH - Bet returned';
            resultEl.style.color = '#ffa502';
            showToast('Push - bet returned', 'info');
            break;
        case 'lose':
            resultEl.textContent = 'Dealer wins!';
            resultEl.style.color = '#ff4757';
            showToast(`Lost ${bjBetAmount}`, 'error');
            break;
    }
}
