// Donation System - Cooldown + Tags
let donationCooldown = false;

async function sendDonation() {
    if (!currentUser || !userProfile) { showToast('Please login', 'error'); return; }
    if (donationCooldown) { showToast('Please wait before donating again', 'warning'); return; }

    const recipientUsername = document.getElementById('donateUsername').value.trim();
    const amount = parseInt(document.getElementById('donateAmount').value);

    if (!recipientUsername) { showToast('Enter a recipient username', 'error'); return; }
    if (!amount || amount < 1) { showToast('Minimum donation is 1', 'error'); return; }
    if (amount > userBalance) { showToast('Insufficient balance', 'error'); return; }
    if (recipientUsername.toLowerCase() === (userProfile.username || '').toLowerCase()) {
        showToast("You can't donate to yourself!", 'error'); return;
    }

    donationCooldown = true;
    const donateBtn = document.querySelector('#donateModal .btn-primary.btn-full');
    if (donateBtn) { donateBtn.disabled = true; donateBtn.textContent = 'Wait 5s...'; }

    setTimeout(() => {
        donationCooldown = false;
        if (donateBtn) { donateBtn.disabled = false; donateBtn.textContent = 'Send Donation'; }
    }, 5000);

    try {
        const profiles = await supabase.select('profiles', '*', `username=eq.${recipientUsername}`);
        if (!profiles || profiles.length === 0) { showToast('User not found', 'error'); return; }

        const recipient = profiles[0];
        const recipientBalance = safeParseNumber(recipient.high_score);

        await updateBalance(userBalance - amount);

        const newRecipientBalance = Math.min(recipientBalance + amount, Number.MAX_SAFE_INTEGER);
        await supabase.update('profiles', { high_score: newRecipientBalance }, `id=eq.${recipient.id}`);

        try {
            await supabase.insert('donations', {
                from_user_id: currentUser.id,
                from_username: userProfile.username,
                to_user_id: recipient.id,
                to_username: recipientUsername,
                amount: amount,
                seen: false
            });
        } catch (e) { console.warn('Donations table:', e.message); }

        if (typeof socket !== 'undefined' && socket && socket.connected) {
            const isOwnerUser = currentUser.email === OWNER_EMAIL;
            socket.emit('donation_sent', {
                fromUsername: userProfile.username,
                fromIsOwner: isOwnerUser,
                fromRank: typeof getEquippedRank === 'function' ? getEquippedRank() : null,
                toUsername: recipientUsername,
                toUserId: recipient.id,
                amount: amount
            });
        }

        showToast(`Donated ${amount.toLocaleString()} Astraphobia to ${recipientUsername}!`, 'success');
        document.getElementById('donateUsername').value = '';
        document.getElementById('donateAmount').value = '';

    } catch (e) {
        showToast('Donation error: ' + e.message, 'error');
    }
}

async function checkDonationNotifications() {
    if (!currentUser) return;

    try {
        const donations = await supabase.select('donations', '*',
            `to_user_id=eq.${currentUser.id}&seen=eq.false`,
            'created_at.desc');

        if (donations && donations.length > 0) {
            donations.forEach(d => {
                showToast(`❤️ ${d.from_username} donated ${safeParseNumber(d.amount).toLocaleString()} Astraphobia to you!`, 'success');
            });

            for (const d of donations) {
                try { await supabase.update('donations', { seen: true }, `id=eq.${d.id}`); } catch(e) {}
            }

            await loadProfile();
        }
    } catch(e) {
        if (!e.message.includes('relation') && !e.message.includes('does not exist')) {
            console.warn('Donation check:', e.message);
        }
    }
}

function loadDonateNotifications() {
    const container = document.getElementById('donateNotifications');
    if (container) container.innerHTML = '';
}

setInterval(() => {
    if (currentUser) checkDonationNotifications();
}, 30000);
