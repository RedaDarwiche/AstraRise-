// Mines Game
let minesGameActive = false;
let minePositions = [];
let revealedTiles = [];
let minesBetAmount = 0;
let minesNumMines = 3;
let minesCurrentMultiplier = 1.0;

function initMinesGrid() {
    const grid = document.getElementById('minesGrid');
    grid.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement('div');
        tile.className = 'mine-tile';
        tile.dataset.index = i;
        tile.onclick = () => clickMine(i);
        grid.appendChild(tile);
    }
}

function startMines() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }
    if (minesGameActive) return;

    // FREEZE CHECK
    if (window.serverMode === 'freeze_bets') {
        showToast('❄️ Betting is currently frozen by the Administrator.', 'error');
        return;
    }

    const bet = parseInt(document.getElementById('minesBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    minesNumMines = parseInt(document.getElementById('minesCount').value);
    if (minesNumMines < 1 || minesNumMines > 24) { showToast('Mines must be 1-24', 'error'); return; }

    minesBetAmount = bet;
    updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    // Place mines
    const trollMode = getTrollMode();
    minePositions = [];

    if (trollMode === 'all_mines') {
        for (let i = 0; i < 25; i++) minePositions.push(i);
    } else {
        const positions = Array.from({ length: 25 }, (_, i) => i);
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        minePositions = positions.slice(0, minesNumMines);
    }

    revealedTiles = [];
    minesCurrentMultiplier = 1.0;
    minesGameActive = true;

    initMinesGrid();

    document.getElementById('minesBtn').style.display = 'none';
    document.getElementById('minesCashout').style.display = 'block';
    document.getElementById('minesMultiplier').textContent = '1.00x';
    document.getElementById('minesProfit').textContent = '0.00';
}

function clickMine(index) {
    if (!minesGameActive) return;
    if (revealedTiles.includes(index)) return;

    const tiles = document.querySelectorAll('.mine-tile');
    let isMine = minePositions.includes(index);

    // Check baseline win
    let isWin = !isMine;

    // Calculate what multiplier WOULD be if safe
    const safeCount = revealedTiles.length + 1; // +1 because we are calculating the multiplier for THIS click
    const totalSafe = 25 - minesNumMines;
    let baselineMultiplier = 1;
    for (let i = 0; i < safeCount; i++) {
        baselineMultiplier *= (25 - i) / (25 - minesNumMines - i);
    }
    baselineMultiplier *= 0.97; // 3% house edge

    // Apply troll logic
    const tResult = handleTrollResult(isWin, baselineMultiplier, minesBetAmount);
    if (tResult.frozen) return;

    isWin = tResult.win;
    isMine = !isWin;

    // Force tile to match outcome
    if (isMine && !minePositions.includes(index)) {
        minePositions[0] = index; // Move a mine here
    } else if (!isMine && minePositions.includes(index)) {
        // Move mine somewhere else unrevealed
        const unrevealed = Array.from({ length: 25 }, (_, i) => i)
            .filter(i => !revealedTiles.includes(i) && !minePositions.includes(i) && i !== index);
        if (unrevealed.length > 0) {
            minePositions[minePositions.indexOf(index)] = unrevealed[0];
        } else {
            isMine = true; // Can't prevent it
        }
    }

    revealedTiles.push(index);

    if (isMine) {
        // Hit mine!
        tiles[index].classList.add('mine', 'revealed');
        tiles[index].innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="6" fill="white"/><line x1="12" y1="2" x2="12" y2="6" stroke="white" stroke-width="2"/><line x1="12" y1="18" x2="12" y2="22" stroke="white" stroke-width="2"/><line x1="2" y1="12" x2="6" y2="12" stroke="white" stroke-width="2"/><line x1="18" y1="12" x2="22" y2="12" stroke="white" stroke-width="2"/></svg>';

        // Reveal all mines
        minePositions.forEach(pos => {
            if (pos !== index) {
                tiles[pos].classList.add('mine', 'revealed');
                tiles[pos].innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="6" fill="white"/></svg>';
            }
        });

        minesGameActive = false;
        document.getElementById('minesBtn').style.display = 'block';
        document.getElementById('minesCashout').style.display = 'none';
        showToast(`Hit a mine! Lost ${minesBetAmount}`, 'error');
    } else {
        // Safe!
        tiles[index].classList.add('safe', 'revealed');
        tiles[index].innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';

        minesCurrentMultiplier = tResult.multiplier;

        // Ensure multiplier is at least 1.01x if we hit a safe tile to avoid negative profit visually
        if (minesCurrentMultiplier < 1.01) minesCurrentMultiplier = 1.01;

        const effectiveMultiplier = minesCurrentMultiplier * getGlobalMultiplier();
        document.getElementById('minesMultiplier').textContent = effectiveMultiplier.toFixed(2) + 'x';

        let profit = (minesBetAmount * effectiveMultiplier) - minesBetAmount;
        document.getElementById('minesProfit').textContent = Math.max(0, profit).toFixed(2);

        // Check if all safe tiles revealed
        if (revealedTiles.length >= totalSafe) {
            cashoutMines();
        }
    }
}

function cashoutMines() {
    if (!minesGameActive) return;
    minesGameActive = false;

    const effectiveMultiplier = minesCurrentMultiplier * getGlobalMultiplier();
    const winAmount = Math.floor(minesBetAmount * effectiveMultiplier);
    updateBalance(userBalance + winAmount);
    playCashoutSound();
    totalWins++;

    // Reveal remaining mines
    const tiles = document.querySelectorAll('.mine-tile');
    minePositions.forEach(pos => {
        if (!revealedTiles.includes(pos)) {
            tiles[pos].classList.add('mine', 'revealed');
            tiles[pos].innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="5" fill="white" opacity="0.5"/></svg>';
        }
    });

    document.getElementById('minesBtn').style.display = 'block';
    document.getElementById('minesCashout').style.display = 'none';
    showToast(`Cashed out! Won ${winAmount} Astraphobia!`, 'success');
}

// Initialize
initMinesGrid();
