// Leaderboard
async function loadLeaderboard() {
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    list.innerHTML = '<div class="loading">Loading leaderboard...</div>';

    try {
        const profiles = await supabase.select('profiles', '*', '', 'high_score.desc');

        if (!profiles || profiles.length === 0) {
            list.innerHTML = '<div class="loading">No players found</div>';
            return;
        }

        // Show top 50 richest
        const top = profiles.slice(0, 50);

        let html = '';
        top.forEach((p, i) => {
            const rank = i + 1;
            let rankClass = '';
            let rankIcon = `#${rank}`;

            if (rank === 1) {
                rankClass = 'gold';
                rankIcon = '<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,2 15,9 22,9 16,14 18,22 12,18 6,22 8,14 2,9 9,9" fill="#ffa502" stroke="#e68a00" stroke-width="1"/></svg>';
            } else if (rank === 2) {
                rankClass = 'silver';
                rankIcon = '<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,2 15,9 22,9 16,14 18,22 12,18 6,22 8,14 2,9 9,9" fill="#a0a0a0" stroke="#888" stroke-width="1"/></svg>';
            } else if (rank === 3) {
                rankClass = 'bronze';
                rankIcon = '<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,2 15,9 22,9 16,14 18,22 12,18 6,22 8,14 2,9 9,9" fill="#cd7f32" stroke="#a0622a" stroke-width="1"/></svg>';
            }

            const username = p.username || 'Unknown';
            const balance = (p.high_score || 0).toLocaleString();
            const isCurrentUser = currentUser && p.id === currentUser.id;

            html += `
                <div class="leaderboard-row ${rankClass} ${isCurrentUser ? 'is-me' : ''}">
                    <div class="leaderboard-rank">${rankIcon}</div>
                    <div class="leaderboard-user">${username.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    <div class="leaderboard-balance">${balance} <span style="color:var(--text-muted);font-size:0.8em;">Astraphobia</span></div>
                </div>
            `;
        });

        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<div class="loading">Error loading leaderboard</div>';
        console.error('Leaderboard error:', e);
    }
}
