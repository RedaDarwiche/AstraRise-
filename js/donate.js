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
        // Find recipient — URL-encode the username for safety
        const encodedUsername = encodeURIComponent(recipientUsername);
        const profiles = await supabase.select('profiles', '*', `username=eq.${encodedUsername}`);
        if (!profiles || profiles.length === 0) {
            showToast('User not found', 'error');
            return;
        }

        const recipient = profiles[0];
        const recipientBalance = safeParseNumber(recipient.high_score);

        // Add to recipient FIRST (if this fails, sender keeps their money)
        const newRecipientBalance = Math.min(recipientBalance + amount, Number.MAX_SAFE_INTEGER);
        await supabase.update('profiles',
            { high_score: newRecipientBalance },
            `id=eq.${recipient.id}`
        );

        // Then deduct from sender
        await updateBalance(userBalance - amount);

        // Build sender tag info
        const senderIsOwner = isOwner();
        const senderRank = userProfile.equipped_rank || null;

        // Create donation record
        await supabase.insert('donations', {
            from_user_id: currentUser.id,
            from_username: userProfile.username,
            to_user_id: recipient.id,
            to_username: recipientUsername,
            amount: amount,
            seen: false
        });

        // Notify via socket with tag info
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('donation_sent', {
                fromUsername: userProfile.username,
                fromIsOwner: senderIsOwner,
                fromRank: senderRank,
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

// Build the donor display string with OWNER tag + equipped rank tag (both if owner has rank)
function buildDonorDisplay(fromUsername, fromIsOwner, fromRank) {
    let tags = '';

    // OWNER tag
    if (fromIsOwner) {
        tags += '<span class="rank-tag rank-owner" style="margin:0 4px;vertical-align:baseline;">OWNER</span>';
    }

    // Equipped rank tag (shop rank)
    if (fromRank && typeof getRankTagHTML === 'function') {
        tags += getRankTagHTML(false, fromRank) + ' ';
    }

    // If no tags at all, no prefix
    const prefix = tags.trim() ? (tags.trim() + ' ') : '';
    return prefix + escapeHtml(fromUsername);
}

async function checkDonationNotifications() {
    if (!currentUser) return;

    try {
        const donations = await supabase.select('donations', '*',
            `to_user_id=eq.${currentUser.id}&seen=eq.false`,
            'created_at.desc');

        if (donations && donations.length > 0) {
            for (const d of donations) {
                const amt = safeParseNumber(d.amount);

                // Look up the sender's profile to get their rank & owner status
                let senderIsOwner = false;
                let senderRank = null;

                try {
                    const senderProfiles = await supabase.select('profiles', 'id,username,equipped_rank',
                        `id=eq.${d.from_user_id}`);
                    if (senderProfiles && senderProfiles.length > 0) {
                        senderRank = senderProfiles[0].equipped_rank || null;
                    }
                } catch (e) {
                    console.error('Sender lookup error:', e);
                }

                // Check if sender is the owner by looking up their auth email via known method
                // We can't access another user's email, so we check if the donation socket
                // carried that info. For DB-based checks, we rely on the from_user_id.
                // The OWNER_EMAIL constant is only useful if we know the sender's email.
                // Fallback: check if the from_user_id matches any known owner ID.
                // Since we can't get email from profiles, we skip owner check here
                // and rely on real-time socket notifications for owner tag display.

                const donorDisplay = buildDonorDisplay(d.from_username, senderIsOwner, senderRank);
                showToast(`${donorDisplay} donated ${amt.toLocaleString()} Astraphobia to you!`, 'success');

                // Mark as seen
                await supabase.update('donations', { seen: true }, `id=eq.${d.id}`);
            }

            // Reload balance
            await loadProfile();
        }
    } catch (e) {
        console.error('Donation check error:', e);
    }
}

// Called when donate modal opens — show recent donation history
async function loadDonateNotifications() {
    if (!currentUser) return;

    const container = document.getElementById('donateNotifications');
    if (!container) return;

    try {
        // Get recent donations TO this user
        const received = await supabase.select('donations', '*',
            `to_user_id=eq.${currentUser.id}`,
            'created_at.desc',
            10);

        // Get recent donations FROM this user
        const sent = await supabase.select('donations', '*',
            `from_user_id=eq.${currentUser.id}`,
            'created_at.desc',
            10);

        // Merge and sort by date
        const all = [...(received || []), ...(sent || [])];
        all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const recent = all.slice(0, 10);

        if (recent.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;">No donation history yet</div>';
            return;
        }

        // Look up all involved users' profiles for rank tags
        const userIds = [...new Set(recent.map(d => d.from_user_id).concat(recent.map(d => d.to_user_id)))];
        let profilesMap = {};
        try {
            for (const uid of userIds) {
                const p = await supabase.select('profiles', 'id,username,equipped_rank', `id=eq.${uid}`);
                if (p && p.length > 0) profilesMap[uid] = p[0];
            }
        } catch (e) { /* ignore */ }

        let html = '<div style="font-size:0.85em;color:var(--text-secondary);margin-bottom:8px;font-weight:600;">Recent Donations</div>';

        recent.forEach(d => {
            const amt = safeParseNumber(d.amount);
            const date = new Date(d.created_at);
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isSent = d.from_user_id === currentUser.id;

            // Get sender/recipient profile info
            const fromProfile = profilesMap[d.from_user_id];
            const toProfile = profilesMap[d.to_user_id];

            // Build tag displays
            const fromRank = fromProfile ? fromProfile.equipped_rank : null;
            const toRank = toProfile ? toProfile.equipped_rank : null;

            // We can't determine owner status from profiles alone in history,
            // but the current user's owner status we know
            const fromIsCurrentUser = d.from_user_id === currentUser.id;
            const toIsCurrentUser = d.to_user_id === currentUser.id;
            const fromIsOwner = fromIsCurrentUser && isOwner();
            const toIsOwner = toIsCurrentUser && isOwner();

            const fromDisplay = buildDonorDisplay(d.from_username, fromIsOwner, fromRank);
            const toDisplay = buildDonorDisplay(d.to_username, toIsOwner, toRank);

            if (isSent) {
                html += `<div class="donate-history-item donate-sent">
                    <span class="donate-arrow">↑</span>
                    <span>Sent <strong>${amt.toLocaleString()}</strong> to ${toDisplay}</span>
                    <span class="donate-time">${timeStr}</span>
                </div>`;
            } else {
                html += `<div class="donate-history-item donate-received">
                    <span class="donate-arrow">↓</span>
                    <span>${fromDisplay} sent <strong>${amt.toLocaleString()}</strong></span>
                    <span class="donate-time">${timeStr}</span>
                </div>`;
            }
        });

        container.innerHTML = html;

    } catch (e) {
        console.error('Load donate notifications error:', e);
        container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;">Error loading history</div>';
    }
}

// Check for donation notifications every 15 seconds
setInterval(() => {
    if (currentUser) checkDonationNotifications();
}, 15000);
