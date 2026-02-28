// Roulette Game - Fixed Visual
const ROULETTE_NUMBERS = [
    { num: 0, color: 'green' },
    { num: 1, color: 'red' }, { num: 2, color: 'black' }, { num: 3, color: 'red' }, { num: 4, color: 'black' },
    { num: 5, color: 'red' }, { num: 6, color: 'black' }, { num: 7, color: 'red' }, { num: 8, color: 'black' },
    { num: 9, color: 'red' }, { num: 10, color: 'black' }, { num: 11, color: 'red' }, { num: 12, color: 'black' },
    { num: 13, color: 'red' }, { num: 14, color: 'black' }
];

let rouletteSpinning = false;
let rouletteHistory = [];
const R_TILE_W = 70; // tile width + gap

function initRouletteWheel() {
    const track = document.getElementById('rouletteTrack');
    if (!track) return;

    let html = '';
    for (let rep = 0; rep < 40; rep++) {
        ROULETTE_NUMBERS.forEach(item => {
            const cls = item.color === 'green' ? 'roulette-num-green' :
                        item.color === 'red' ? 'roulette-num-red' : 'roulette-num-black';
            html += `<div class="roulette-num ${cls}">${item.num}</div>`;
        });
    }
    track.innerHTML = html;
    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';

    renderRouletteHistory();
}

function renderRouletteHistory() {
    const histEl = document.getElementById('rouletteHistory');
    if (!histEl) return;
    histEl.innerHTML = rouletteHistory.slice(0, 12).map(item => {
        const cls = item.color === 'green' ? 'roulette-hist-green' :
                   item.color === 'red' ? 'roulette-hist-red' : 'roulette-hist-black';
        return `<div class="roulette-hist-item ${cls}">${item.num}</div>`;
    }).join('');
}

async function playRoulette(choice) {
    if (rouletteSpinning) return;
    if (!currentUser) { showToast('Please login to play', 'error'); return; }

    const bet = parseInt(document.getElementById('rouletteBet').value);
    if (!bet || bet < 1) { showToast('Minimum bet is 1', 'error'); return; }
    if (bet > userBalance) { showToast('Insufficient balance', 'error'); return; }

    rouletteSpinning = true;
    await updateBalance(userBalance - bet);
    totalWagered += bet;
    playBetSound();

    const resultIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const result = ROULETTE_NUMBERS[resultIndex];

    const track = document.getElementById('rouletteTrack');
    const totalNums = ROULETTE_NUMBERS.length;
    const targetRep = 25;
    const targetTileIndex = targetRep * totalNums + resultIndex;
    const targetCenter = targetTileIndex * R_TILE_W + R_TILE_W / 2;
    const containerW = track.parentElement.offsetWidth;
    const finalX = -(targetCenter - containerW / 2);

    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';
    track.offsetHeight;

    track.style.transition = 'transform 4s cubic-bezier(0.15, 0.6, 0.15, 1)';
    track.style.transform = `translateX(${finalX}px)`;

    document.getElementById('rouletteResult').textContent = 'Spinning...';
    document.getElementById('rouletteResult').style.color = 'var(--text-secondary)';

    setTimeout(() => {
        rouletteSpinning = false;
        rouletteHistory.unshift(result);
        if (rouletteHistory.length > 20) rouletteHistory.pop();
        renderRouletteHistory();

        let won = false, winAmount = 0;
        if (choice === 'green' && result.color === 'green') { won = true; winAmount = bet * 14; }
        else if (choice === 'red' && result.color === 'red') { won = true; winAmount = bet * 2; }
        else if (choice === 'black' && result.color === 'black') { won = true; winAmount = bet * 2; }

        const resEl = document.getElementById('rouletteResult');
        if (won) {
            updateBalance(userBalance + winAmount);
            totalWins++;
            playCashoutSound();
            resEl.textContent = `🎉 ${result.color.toUpperCase()} ${result.num} — Won ${winAmount.toLocaleString()}!`;
            resEl.style.color = 'var(--success)';
            showToast(`Won ${winAmount.toLocaleString()} Astraphobia!`, 'success');
        } else {
            resEl.textContent = `${result.color.toUpperCase()} ${result.num} — You lost!`;
            resEl.style.color = 'var(--danger)';
            showToast(`Lost ${bet.toLocaleString()} Astraphobia`, 'error');
        }

        setTimeout(() => {
            track.style.transition = 'none';
            track.style.transform = 'translateX(0px)';
        }, 3000);
    }, 4200);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initRouletteWheel, 500);
});
