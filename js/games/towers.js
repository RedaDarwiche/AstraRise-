// Towers Game
let towersGameActive = false;
let towersBetAmount = 0;
let towersCurrentRow = 7; // Start from bottom (row 7 = bottom)
let towersMultiplier = 1.0;
let towersGrid = [];
let towersDiff = 'medium';

const towersDiffConfig = {
    easy: { tiles: 3, safe: 2 },
    medium: { tiles: 2, safe: 1 },
    hard: { tiles: 4, safe: 2 }
};

function initTowersGrid() {
    const grid = document.getElementById('towersGrid');
    grid.innerHTML = '';
    towersDiff = document.getElementById('towersDifficulty').value;
    const config = towersDiffConfig[towersDiff];
    towersGrid = [];

    for (let row = 0; row < 8; row++) {
        const rowData = [];
        const rowEl = document.createElement('div');
        rowEl.className = 'tower-row';
        rowEl.dataset.row = row;

        // Determine safe tiles
        const positions = Array.from({length: config.tiles}, (_, i) => i);
        const shuffled = [...positions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const safeTiles = shuffled.slice(0, config.safe);

        for (let col = 0; col < config.tiles; col++) {
            const tile = document.createElement('div');
            tile.className = 'tower-tile' + (row < 7 ? ' locked' : '');
            tile.dataset.row = row;
            tile.dataset.col = col;
            tile.onclick = () => clickTower(row, col);
            rowEl.appendChild(tile);
            rowData.push({ safe: safeTiles.includes(col), element: tile });
        }
        
        grid.appendChild(rowEl);
        towersGrid.push(rowData);
    }
}

function startTowers() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }
    if (towersGameActive) return;

     // ADD THIS BLOCK
    if (window.serverMode === 'freeze_bets') {
        showToast('❄️ Betting is currently frozen for maintenance!', 'error');
        return;
    }

    const bet = parseInt(document.getElementById('towersBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    towersBetAmount = bet;
    updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    towersCurrentRow = 7;
    towersMultiplier = 1.0;
    towersGameActive = true;

    initTowersGrid();

    document.getElementById('towersBtn').style.display = 'none';
    document.getElementById('towersCashout').style.display = 'block';
    document.getElementById('towersMultiplier').textContent = '1.00x';
    document.getElementById('towersProfit').textContent = '0.00';
}

function clickTower(row, col) {
    if (!towersGameActive) return;
    if (row !== towersCurrentRow) return;

    const config = towersDiffConfig[towersDiff];
    const trollMode = getTrollMode();
    const tileData = towersGrid[row][col];
    
    let isSafe = tileData.safe;
    if (trollMode === 'always_win') isSafe = true;
    if (trollMode === 'always_lose') isSafe = false;

    if (isSafe) {
        tileData.element.classList.add('safe', 'revealed');
        tileData.element.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="3" fill="none"/></svg>';

        // Show dangers in this row
        towersGrid[row].forEach((t, i) => {
            if (i !== col) {
                t.element.classList.add('revealed');
                if (!t.safe) {
                    t.element.classList.add('danger');
                }
            }
        });

        const rowMultiplier = config.tiles / config.safe;
        towersMultiplier *= rowMultiplier;
        
        const effectiveMultiplier = towersMultiplier * getGlobalMultiplier();
        document.getElementById('towersMultiplier').textContent = effectiveMultiplier.toFixed(2) + 'x';
        document.getElementById('towersProfit').textContent = Math.floor(towersBetAmount * effectiveMultiplier - towersBetAmount).toString();

        towersCurrentRow--;

        if (towersCurrentRow < 0) {
            cashoutTowers();
            return;
        }

        // Unlock next row
        towersGrid[towersCurrentRow].forEach(t => {
            t.element.classList.remove('locked');
        });
    } else {
        tileData.element.classList.add('danger', 'revealed');
        tileData.element.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18" stroke="white" stroke-width="3"/><line x1="6" y1="6" x2="18" y2="18" stroke="white" stroke-width="3"/></svg>';

        // Reveal all
        towersGrid.forEach(rowData => {
            rowData.forEach(t => {
                t.element.classList.add('revealed');
                if (!t.safe) t.element.classList.add('danger');
                else t.element.classList.add('safe');
            });
        });

        towersGameActive = false;
        document.getElementById('towersBtn').style.display = 'block';
        document.getElementById('towersCashout').style.display = 'none';
        showToast(`Wrong tile! Lost ${towersBetAmount}`, 'error');
    }
}

function cashoutTowers() {
    if (!towersGameActive) return;
    towersGameActive = false;

    const effectiveMultiplier = towersMultiplier * getGlobalMultiplier();
    const winAmount = Math.floor(towersBetAmount * effectiveMultiplier);
    updateBalance(userBalance + winAmount);
    playCashoutSound();
    totalWins++;

    document.getElementById('towersBtn').style.display = 'block';
    document.getElementById('towersCashout').style.display = 'none';
    showToast(`Cashed out! Won ${winAmount} Astraphobia!`, 'success');
}

// Initialize

initTowersGrid();
