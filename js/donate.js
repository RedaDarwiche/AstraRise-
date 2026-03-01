// Donation System

async function sendDonation() {
    if (!currentUser || !userProfile) { showToast('Please login', 'error'); return; }

    const recipientUsername = document.getElementById('donateUsername').value.trim();
    const amount = parseInt(document.getElementById('donateAmount').value);

    if (!recipientUsername) { showToast('Enter a recipient username', 'error'); return; }
    if (!amount || amount < 1) { showToast('Minimum donation is 1', 'error'); return; }
    if (amount > userBalance) { showToast('Insufficient balance', 'error'); return; }
    if (recipientUsername.toLowerCase() === (userProfile.username || '').toLowerCase()) {
        showToast("You can't donate to yourself!", 'error');
        return;
    }

    try {
        const encodedUsername = encodeURIComponent(recipientUsername);
        const profiles = await supabase.select('profiles', '*', `username=eq.${encodedUsername}`);
        if (!profiles || profiles.length === 0) {
            showToast('User not found', 'error');
            return;
        }

        const recipient = profiles[0];
        const recipientBalance = safeParseNumber(recipient.high_score);

        // Add to recipient FIRST — if this fails, sender keeps money
        const newRecipientBalance = Math.min(recipientBalance + amount, Number.MAX_SAFE_INTEGER);
        await supabase.update('profiles',
            { high_score: newRecipientBalance },
            `id=eq.${recipient.id}`
        );

        // Then deduct from sender
        await updateBalance(userBalance - amount);

        // Create donation record
        await supabase.insert('donations', {
            from_user_id: currentUser.id,
            from_username: userProfile.username,
            to_user_id: recipient.id,
            to_username: recipientUsername,
            amount: amount,
            seen: false
        });

        // Notify via socket with tag info (same pattern as cases.js)
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('donation_sent', {
                fromUsername: userProfile.username,
                fromIsOwner: isOwner(),
                fromRank: (userProfile.equipped_rank || null),
                toUsername: recipientUsername,
                toUserId: recipient.id,
                amount: amount
            });
        }

        showToast(`Donated ${amount.toLocaleString()} Astraphobia to ${recipientUsername}!`, 'success');
        document.getElementById('donateUsername').value = '';
        document.getElementById('donateAmount').value = '';

    } catch (e) {
        console.error('Donation error:', e);
        showToast('Donation error: ' + e.message, 'error');
    }
}

// Called ONCE on login — catches donations missed while offline
async function checkDonationNotifications() {
    if (!currentUser) return;

    try {
        const donations = await supabase.select('donations', '*',
            `to_user_id=eq.${currentUser.id}&seen=eq.false`,
            'created_at.desc');

        if (donations && donations.length > 0) {
            // Mark ALL as seen FIRST to prevent duplicates
            for (const d of donations) {
                await supabase.update('donations', { seen: true }, `id=eq.${d.id}`);
            }

            // Then show notifications using renderNameWithTags from cases.js
            for (const d of donations) {
                let senderRank = null;
                try {
                    const sp = await supabase.select('profiles', 'equipped_rank', `id=eq.${d.from_user_id}`);
                    if (sp && sp.length > 0) senderRank = sp[0].equipped_rank || null;
                } catch (e) {}

                const amt = safeParseNumber(d.amount);
                const display = (typeof renderNameWithTags === 'function')
                    ? renderNameWithTags(d.from_username, false, senderRank)
                    : escapeHtml(d.from_username);
                showToast(`${display} donated ${amt.toLocaleString()} Astraphobia to you!`, 'success');
            }

            await loadProfile();
        }
    } catch (e) {
        console.error('Donation check error:', e);
    }
}

// Mark all unseen donations as seen (called after socket notification to prevent duplicates)
async function markDonationsAsSeen() {
    if (!currentUser) return;
    try {
        const unseen = await supabase.select('donations', 'id',
            `to_user_id=eq.${currentUser.id}&seen=eq.false`);
        if (unseen && unseen.length > 0) {
            for (const d of unseen) {
                await supabase.update('donations', { seen: true }, `id=eq.${d.id}`);
            }
        }
    } catch (e) {}
}

// NO setInterval — that was causing duplicate notifications
// Real-time: socket 'donation_received' in app.js
// Missed offline: checkDonationNotifications() called once on login
