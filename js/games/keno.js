// Keno Game
let kenoSelected = [];
let kenoDrawn = [];

const kenoPayTable = {
    1: [0, 3.5],
    2: [0, 1, 9],
    3: [0, 0, 2, 25],
    4: [0, 0, 1.5, 5, 50],
    5: [0, 0, 1, 3, 15, 75],
    6: [0, 0, 0.5, 2, 6, 30, 100],
    7: [0, 0, 0, 1.5, 4, 12, 50, 200],
    8: [0, 0, 0, 1, 3, 8, 25, 80, 400],
    9: [0, 0, 0, 0.5, 2, 5, 15, 50, 150, 500],
    10: [0, 0, 0, 0, 1.5, 4, 10, 30, 100, 300, 1000]
};

function initKenoGrid() {
    const grid = document.getElementById('kenoGrid');
    grid.innerHTML = '';
    kenoSelected = [];
    kenoDrawn = [];

    for (let i = 1; i <= 40; i++) {
        const tile = document.createElement('div');
        tile.className = 'keno-tile';
        tile.textContent = i;
        tile.dataset.num = i;
        tile.onclick = () => toggleKenoNumber(i, tile);
        grid.appendChild(tile);
    }

    document.getElementById('kenoSelected').textContent = 'Selected: 0/10';
    document.getElementById('kenoResult').textContent = '';
}

function toggleKenoNumber(num, tile) {
    if (kenoDrawn.length > 0) {
        initKenoGrid();
        return;
    }

    const idx = kenoSelected.indexOf(num);
    if (idx > -1) {
        kenoSelected.splice(idx, 1);
        tile.classList.remove('selected');
    } else {
        if (kenoSelected.length >= 10) {
            showToast('Maximum 10 numbers', 'warning');
            return;
        }
        kenoSelected.push(num);
        tile.classList.add('selected');
    }

    document.getElementById('kenoSelected').textContent = `Selected: ${kenoSelected.length}/10`;
}

function clearKeno() {
    initKenoGrid();
}

async function playKeno() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }
    if (kenoSelected.length === 0) { showToast('Select at least 1 number', 'error'); return; }

    const bet = parseInt(document.getElementById('kenoBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    await updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    // Draw 10 numbers
    const allNumbers = Array.from({ length: 40 }, (_, i) => i + 1);
    for (let i = allNumbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allNumbers[i], allNumbers[j]] = [allNumbers[j], allNumbers[i]];
    }

    // Baseline draw
    let baselineDrawn = allNumbers.slice(0, 10);
    const baselineHits = kenoSelected.filter(n => baselineDrawn.includes(n)).length;

    // Check baseline win
    const payTable = kenoPayTable[kenoSelected.length] || [];
    let baseMultiplier = payTable[baselineHits] || 0;
    let isWin = baseMultiplier > 0;

    // Apply global logic
    const tResult = handleTrollResult(isWin, baseMultiplier, bet);
    isWin = tResult.win;

    // Force outcome
    if (isWin) {
        // Guarantee at least one hit if win needed but didn't happen
        if (!baselineHits && baseMultiplier > 0) {
             kenoDrawn = [...kenoSelected.slice(0,1), ...baselineDrawn.slice(1)];
        } else {
             kenoDrawn = baselineDrawn;
        }
    } else {
        // Force 0 hits if supposed to lose
        kenoDrawn = allNumbers.filter(n => !kenoSelected.includes(n)).slice(0, 10);
    }

    // Animate drawing
    const tiles = document.querySelectorAll('.keno-tile');
    let drawIndex = 0;

    function drawNext() {
        if (drawIndex >= kenoDrawn.length) {
            // Calculate result
            const hits = kenoSelected.filter(n => kenoDrawn.includes(n)).length;
            const numSelected = kenoSelected.length;
            const payTable = kenoPayTable[numSelected] || [];
            const multiplier = (payTable[hits] || 0) * getGlobalMultiplier();

            const resultEl = document.getElementById('kenoResult');
            if (multiplier > 0) {
                const winAmount = Math.floor(bet * multiplier);
                playCashoutSound();
                updateBalance(userBalance + winAmount);
                if (winAmount > bet) totalWins++;
                resultEl.textContent = `${hits} hits! Won ${winAmount} coins (${multiplier.toFixed(1)}x)`;
                resultEl.style.color = '#00d26a';
                showToast(`Won ${winAmount} Astraphobia!`, 'success');
            } else {
                resultEl.textContent = `${hits} hits - Lost!`;
                resultEl.style.color = '#ff4757';
                showToast(`Lost ${bet}`, 'error');
            }
            return;
        }

        const num = kenoDrawn[drawIndex];
        const tile = tiles[num - 1];

        if (kenoSelected.includes(num)) {
            tile.classList.add('hit');
        } else {
            tile.classList.add('drawn');
        }

        drawIndex++;
        setTimeout(drawNext, 150);
    }

    drawNext();
}

initKenoGrid();
