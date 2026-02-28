// Hi-Lo Game
let hiloGameActive = false;
let hiloBetAmount = 0;
let hiloCurrentCard = null;
let hiloMultiplier = 1.0;
let hiloDeck = [];

function createHiloDeck() {
    const deck = [];
    const suits = ['H', 'D', 'C', 'S'];
    for (let v = 1; v <= 13; v++) {
        for (const s of suits) {
            deck.push({ value: v, suit: s });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function hiloCardName(card) {
    const names = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suitSymbol = { H: '\u2665', D: '\u2666', C: '\u2663', S: '\u2660' }[card.suit];
    return names[card.value] + suitSymbol;
}

function renderHiloCard(card) {
    const el = document.getElementById('hiloCurrentCard');
    const isRed = card.suit === 'H' || card.suit === 'D';
    el.className = 'hilo-card' + (isRed ? ' red' : '');
    el.textContent = hiloCardName(card);

    // Trigger animation
    el.classList.remove('card-enter');
    void el.offsetWidth; // Force reflow
    el.classList.add('card-enter');
}

function startHilo() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }

    const bet = parseInt(document.getElementById('hiloBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    hiloBetAmount = bet;
    updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    hiloDeck = createHiloDeck();
    hiloCurrentCard = hiloDeck.pop();
    hiloMultiplier = 1.0;
    hiloGameActive = true;

    renderHiloCard(hiloCurrentCard);
    document.getElementById('hiloStartBtn').style.display = 'none';
    document.getElementById('hiloActions').style.display = 'flex';
    document.getElementById('hiloMultiplier').textContent = '1.00x';
    document.getElementById('hiloProfit').textContent = '0.00';
}

function hiloGuess(guess) {
    if (!hiloGameActive) return;

    const trollMode = getTrollMode();
    let nextCard = hiloDeck.pop();

    if (!nextCard) {
        hiloDeck = createHiloDeck();
        nextCard = hiloDeck.pop();
    }

    let correct;
    if (guess === 'higher') {
        correct = nextCard.value >= hiloCurrentCard.value;
    } else {
        correct = nextCard.value <= hiloCurrentCard.value;
    }

    // Apply troll logic
    const tResult = handleTrollResult(correct, hiloMultiplier * 1.5, hiloBetAmount);
    if (tResult.frozen) return;

    correct = tResult.win;

    // Force card to match troll outcome if needed
    if (correct && ((guess === 'higher' && nextCard.value < hiloCurrentCard.value) || (guess === 'lower' && nextCard.value > hiloCurrentCard.value))) {
        // We need a winning card, but drew a losing one
        const validCards = hiloDeck.filter(c => guess === 'higher' ? c.value >= hiloCurrentCard.value : c.value <= hiloCurrentCard.value);
        if (validCards.length > 0) {
            nextCard = validCards[0];
            hiloDeck = hiloDeck.filter(c => c !== nextCard);
        }
    } else if (!correct && ((guess === 'higher' && nextCard.value >= hiloCurrentCard.value) || (guess === 'lower' && nextCard.value <= hiloCurrentCard.value))) {
        // We need a losing card, but drew a winning one
        const invalidCards = hiloDeck.filter(c => guess === 'higher' ? c.value < hiloCurrentCard.value : c.value > hiloCurrentCard.value);
        if (invalidCards.length > 0) {
            nextCard = invalidCards[0];
            hiloDeck = hiloDeck.filter(c => c !== nextCard);
        }
    }

    hiloCurrentCard = nextCard;
    renderHiloCard(hiloCurrentCard);

    if (correct) {
        hiloMultiplier *= 1.5;
        const effectiveMultiplier = hiloMultiplier * getGlobalMultiplier();
        document.getElementById('hiloMultiplier').textContent = effectiveMultiplier.toFixed(2) + 'x';
        document.getElementById('hiloProfit').textContent = Math.floor(hiloBetAmount * effectiveMultiplier - hiloBetAmount).toString();
        showToast('Correct!', 'success');
    } else {
        hiloGameActive = false;
        document.getElementById('hiloStartBtn').style.display = 'block';
        document.getElementById('hiloActions').style.display = 'none';
        showToast(`Wrong! Lost ${hiloBetAmount}`, 'error');
    }
}

function hiloCashout() {
    if (!hiloGameActive) return;
    hiloGameActive = false;

    const effectiveMultiplier = hiloMultiplier * getGlobalMultiplier();
    const winAmount = Math.floor(hiloBetAmount * effectiveMultiplier);
    updateBalance(userBalance + winAmount);
    totalWins++;

    document.getElementById('hiloStartBtn').style.display = 'block';
    document.getElementById('hiloActions').style.display = 'none';
    showToast(`Cashed out! Won ${winAmount} Astraphobia!`, 'success');
    playCashoutSound();
}