// Global Multiplayer Crash Game (WebSockets)
const CRASH_STATE = {
    WAITING: 'WAITING',
    RUNNING: 'RUNNING',
    CRASHED: 'CRASHED'
};

let crashState = CRASH_STATE.WAITING;
let crashMultiplierValue = 1.00;
let crashTimer = 10.0;
let crashHistory = [];

let myCrashBetAmount = 0;
let myCrashAutoCashout = 0;
let myCrashCashedOut = false;
let myBetActive = false;

// Array of { user, bet, target, cashedOut, winAmount, isMe, cashoutMul }
let liveBets = [];

let crashCanvas, crashCtx;
let crashAnimFrame = null;
let lastCrashStartT = 0;

function initGlobalCrash() {
    crashCanvas = document.getElementById('crashCanvas');
    if (!crashCanvas) return;
    crashCtx = crashCanvas.getContext('2d');

    // SOCKET LISTENERS
    socket.on('crash_state', (data) => {
        crashState = data.state;
        crashMultiplierValue = data.multiplier || 1.0;
        if (data.timer !== null) crashTimer = data.timer;

        if (crashState === CRASH_STATE.WAITING) {
            // New round started
            liveBets = [];
            myBetActive = false;
            myCrashCashedOut = false;
        } else if (crashState === CRASH_STATE.RUNNING) {
            lastCrashStartT = Date.now();
        }

        updateCrashUI();
        renderBetsList();
        renderCrashLoop(); // Just trigger a draw once
    });

    socket.on('crash_timer', (data) => {
        crashTimer = data.timer;
        updateCrashUI();
        renderCrashLoop();
    });

    socket.on('crash_tick', (data) => {
        crashMultiplierValue = data.multiplier;

        // Handle Auto Cashout
        if (myBetActive && !myCrashCashedOut && myCrashAutoCashout > 0 && crashMultiplierValue >= myCrashAutoCashout) {
            cashoutCrashUser();
        }

        updateCrashUI();
        renderCrashLoop();
    });

    socket.on('crash_end', (data) => {
        crashState = CRASH_STATE.CRASHED;
        crashMultiplierValue = data.multiplier;

        crashHistory.unshift(crashMultiplierValue.toFixed(2));
        if (crashHistory.length > 10) crashHistory.pop();

        if (myBetActive && !myCrashCashedOut) {
            showToast(`Crashed at ${crashMultiplierValue.toFixed(2)}x! You lost ${myCrashBetAmount}`, 'error');
        }

        updateCrashUI();
        renderBetsList();
        renderCrashLoop();
    });

    socket.on('crash_live_bet', (data) => {
        liveBets.push({
            user: data.user,
            bet: data.bet,
            target: data.target,
            cashedOut: false,
            winAmount: 0,
            isMe: false,
            isOwner: data.isOwner || false,
            equippedRank: data.equippedRank || null
        });
        renderBetsList();
    });

    socket.on('crash_live_cashout', (data) => {
        const bet = liveBets.find(b => b.user === data.user && !b.cashedOut);
        if (bet) {
            bet.cashedOut = true;
            bet.cashoutMul = data.multiplier;
            bet.winAmount = data.winAmount;
        }
        renderBetsList();
    });

    // Start render loop (graphs only update when state changes, or continuously if running)
    requestAnimationFrame(continuousRender);
}

function continuousRender() {
    if (crashState === CRASH_STATE.RUNNING) {
        renderCrashLoop();
    }
    requestAnimationFrame(continuousRender);
}

function toggleCrashBet() {
    if (!currentUser) { showToast('Please login to play', 'error'); return; }

    if (crashState === CRASH_STATE.RUNNING && myBetActive && !myCrashCashedOut) {
        cashoutCrashUser();
        return;
    }

    if (crashState !== CRASH_STATE.WAITING) {
        showToast('Betting is closed for this round!', 'warning');
        return;
    }

    if (myBetActive) {
        // Cancel bet
        updateBalance(userBalance + myCrashBetAmount);
        myBetActive = false;
        liveBets = liveBets.filter(b => !b.isMe);
        updateCrashUI();
        renderBetsList();
        showToast('Bet cancelled', 'info');
        return;
    }

    // FREEZE CHECK
    if (window.serverMode === 'freeze_bets') {
        showToast('❄️ Betting is currently frozen by the Administrator.', 'error');
        return;
    }

    const bet = parseInt(document.getElementById('crashBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    myCrashBetAmount = bet;
    myCrashAutoCashout = parseFloat(document.getElementById('crashAutoCashout').value) || 0;

    updateBalance(userBalance - bet);
    if (window.totalWagered !== undefined) window.totalWagered += bet;

    myBetActive = true;
    playBetSound();
    myCrashCashedOut = false;

    const isOwnerUser = currentUser && currentUser.email === 'redadarwichepaypal@gmail.com';
    const myBetData = {
        user: userProfile?.username || 'You',
        bet: bet,
        target: myCrashAutoCashout,
        cashedOut: false,
        winAmount: 0,
        isMe: true,
        isOwner: isOwnerUser,
        equippedRank: typeof getEquippedRank === 'function' ? getEquippedRank() : null
    };

    liveBets.push(myBetData);

    // Broadcast bet to server
    socket.emit('crash_place_bet', myBetData);

    updateCrashUI();
    renderBetsList();
    showToast('Bet placed for next round!', 'success');
}

function cashoutCrashUser() {
    if (crashState !== CRASH_STATE.RUNNING || !myBetActive || myCrashCashedOut) return;

    myCrashCashedOut = true;

    // Find my bet
    const myBet = liveBets.find(b => b.isMe);
    if (myBet) {
        myBet.cashedOut = true;

        const winAmount = Math.floor(myCrashBetAmount * crashMultiplierValue);
        myBet.winAmount = winAmount;
        myBet.cashoutMul = crashMultiplierValue;

        updateBalance(userBalance + winAmount);
        if (window.totalWins !== undefined) window.totalWins++;

        showToast(`Cashed out at ${crashMultiplierValue.toFixed(2)}x! Won ${winAmount}`, 'success');
        playCashoutSound();

        // Broadcast cashout to server
        socket.emit('crash_cashout', {
            user: userProfile?.username || 'You',
            multiplier: crashMultiplierValue,
            winAmount: winAmount
        });
    }

    updateCrashUI();
    renderBetsList();
}

function renderCrashLoop() {
    const display = document.getElementById('crashMultiplier');
    const status = document.getElementById('crashStatus');

    if (display && status) {
        if (crashState === CRASH_STATE.WAITING) {
            display.textContent = '1.00x';
            display.className = 'crash-multiplier';
            status.textContent = `Starting in ${crashTimer.toFixed(1)}s`;
            drawCrashGraph(0);
        } else if (crashState === CRASH_STATE.RUNNING) {
            display.textContent = crashMultiplierValue.toFixed(2) + 'x';
            display.className = 'crash-multiplier';
            status.textContent = 'Game running...';

            const elapsed = (Date.now() - lastCrashStartT) / 1000;
            drawCrashGraph(elapsed);
        } else if (crashState === CRASH_STATE.CRASHED) {
            display.textContent = crashMultiplierValue.toFixed(2) + 'x';
            display.className = 'crash-multiplier crashed';
            status.textContent = `Crashed! Waiting for next round...`;

            // Assume end of graph is ~ log(M)/0.00006 from server math, but let's just draw based on current multiplier
            const elapsed = Math.log(crashMultiplierValue) / 0.15;
            drawCrashGraph(elapsed); // Show final state
        }
    }
}

function updateCrashUI() {
    const btn = document.getElementById('crashBtn');
    if (!btn) return;

    if (crashState === CRASH_STATE.WAITING) {
        if (myBetActive) {
            btn.textContent = 'Cancel Bet';
            btn.className = 'btn btn-danger';
        } else {
            btn.textContent = 'Place Bet';
            btn.className = 'btn btn-play';
        }
    } else if (crashState === CRASH_STATE.RUNNING) {
        if (myBetActive && !myCrashCashedOut) {
            btn.textContent = 'Cash Out';
            btn.className = 'btn btn-cashout';
        } else if (myBetActive && myCrashCashedOut) {
            btn.textContent = 'Cashed Out';
            btn.className = 'btn btn-outline';
        } else {
            btn.textContent = 'Betting Closed';
            btn.className = 'btn btn-outline';
        }
    } else if (crashState === CRASH_STATE.CRASHED) {
        btn.textContent = 'Game Over';
        btn.className = 'btn btn-outline';
    }

    const countLabel = document.getElementById('totalCrashPlayers');
    if (countLabel) countLabel.textContent = `${liveBets.length} Players`;
}

function renderBetsList() {
    const list = document.getElementById('crashBetsList');
    if (!list) return;

    let html = '';

    // Sort: cashed out first, then active
    const sorted = [...liveBets].sort((a, b) => {
        if (a.cashedOut === b.cashedOut) return b.bet - a.bet;
        return a.cashedOut ? -1 : 1;
    });

    sorted.forEach(b => {
        let rowClass = 'crash-bet-row';
        if (b.cashedOut) rowClass += ' cashed-out';
        else if (crashState === CRASH_STATE.CRASHED) rowClass += ' crashed';

        let mulText = '-';
        let winText = b.bet;

        if (b.cashedOut) {
            mulText = `${b.cashoutMul.toFixed(2)}x`;
            winText = `<span class="crash-bet-mul win">+${b.winAmount}</span>`;
        } else if (crashState === CRASH_STATE.CRASHED) {
            mulText = 'CRASHED';
            winText = `<span style="color:var(--danger)">-${b.bet}</span>`;
        }

        // Build tag HTML — owner gets both tags
        let tagHTML = '';
        if (b.isOwner) {
            tagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
        }
        if (b.equippedRank && typeof getRankTagHTML === 'function') {
            tagHTML += getRankTagHTML(false, b.equippedRank);
        }

        html += `
            <div class="${rowClass}">
                <div class="crash-bet-user">${tagHTML}${b.user}</div>
                <div class="crash-bet-amount">${winText}</div>
                <div class="crash-bet-mul ${b.cashedOut ? 'win' : ''}">${mulText}</div>
            </div>
        `;
    });

    list.innerHTML = html;

    const countLabel = document.getElementById('totalCrashPlayers');
    if (countLabel) countLabel.textContent = `${liveBets.length} Players`;
}

function drawCrashGraph(elapsed) {
    if (!crashCanvas || !crashCtx) return;
    const w = crashCanvas.width;
    const h = crashCanvas.height;
    crashCtx.clearRect(0, 0, w, h);

    crashCtx.fillStyle = '#1a1a3a';
    crashCtx.fillRect(0, 0, w, h);

    // Grid
    crashCtx.strokeStyle = '#2a2a5a';
    crashCtx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
        const y = h - (h / 5) * i;
        crashCtx.beginPath();
        crashCtx.moveTo(0, y);
        crashCtx.lineTo(w, y);
        crashCtx.stroke();
    }

    if (crashState === CRASH_STATE.WAITING && elapsed === 0) return;

    // Draw line
    crashCtx.strokeStyle = crashState === CRASH_STATE.CRASHED ? '#ff4757' : '#6c5ce7';
    crashCtx.lineWidth = 3;
    crashCtx.beginPath();

    const points = Math.min(Math.floor(elapsed * 20), 200);
    const maxM = Math.max(crashMultiplierValue, 2);
    for (let i = 0; i <= points; i++) {
        const t = (i / 200) * elapsed;
        const m = Math.pow(Math.E, t * 0.15); // Match frontend visual curve rate
        const x = (i / 200) * w;
        const y = h - ((m - 1) / (maxM - 1)) * (h - 20);
        if (i === 0) crashCtx.moveTo(x, Math.max(20, y));
        else crashCtx.lineTo(x, Math.max(20, y));
    }
    crashCtx.stroke();
}

// Start global initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initGlobalCrash, 1000); // slight delay to let Socket connect
});
