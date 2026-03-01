// Donation System — uses server-side RPC to bypass RLS

// Build tag HTML for donation notifications: [OWNER] [RANK] username
function buildDonorDisplay(username, donorIsOwner, donorRank) {
    let tags = '';
    
    // OWNER tag first
    if (donorIsOwner) {
        tags += '<span class="rank-tag rank-owner" style="margin-right:4px;vertical-align:baseline;">OWNER</span>';
    }
    
    // Equipped rank tag (e.g. LEGEND, VIP, etc.)
    if (donorRank && typeof getRankTagHTML === 'function') {
        tags += getRankTagHTML(false, donorRank) + ' ';
    }
    
    const safeName = escapeHtml(username || 'Someone');
    
    // Result: [OWNER] [LEGEND] username
    return tags + safeName;
}

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

    const senderIsOwner = isOwner();
    const senderRank = (typeof getEquippedRank === 'function') ? getEquippedRank() : (userProfile.equipped_rank || null);

    try {
        const result = await supabase.rpc('process_donation', {
            p_sender_id: currentUser.id,
            p_recipient_username: recipientUsername,
            p_amount: amount,
            p_sender_username: userProfile.username,
            p_from_is_owner: senderIsOwner,
            p_from_rank: senderRank
        });

        if (!result || !result.success) {
            showToast(result?.error || 'Donation failed', 'error');
            return;
        }

        userBalance = safeParseNumber(result.new_sender_balance);
        updateBalanceDisplay();

        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('donation_sent', {
                fromUsername: userProfile.username,
                fromIsOwner: senderIsOwner,
                fromRank: senderRank,
                toUsername: result.recipient_username,
                toUserId: result.recipient_id,
                amount: amount
            });
        }

        showToast(`Donated ${amount.toLocaleString()} Astraphobia to ${result.recipient_username}!`, 'success');
        document.getElementById('donateUsername').value = '';
        document.getElementById('donateAmount').value = '';

    } catch (e) {
        console.error('Donation error:', e);
        showToast('Donation failed: ' + e.message, 'error');
    }
}

async function checkDonationNotifications() {
    if (!currentUser) return;

    try {
        const donations = await supabase.select('donations', '*',
            `to_user_id=eq.${currentUser.id}&seen=eq.false`,
            'created_at.desc');

        if (donations && donations.length > 0) {
            for (const d of donations) {
                await supabase.update('donations', { seen: true }, `id=eq.${d.id}`);
            }

            for (const d of donations) {
                let senderIsOwner = d.from_is_owner || false;
                let senderRank = d.from_rank || null;

                if (!senderRank) {
                    try {
                        const sp = await supabase.select('profiles', 'equipped_rank', `id=eq.${d.from_user_id}`);
                        if (sp && sp.length > 0) senderRank = sp[0].equipped_rank || null;
                    } catch (e) {}
                }

                const display = buildDonorDisplay(d.from_username, senderIsOwner, senderRank);
                const amt = safeParseNumber(d.amount);

                showToast(`${display} donated ${amt.toLocaleString()} Astraphobia to you!`, 'success');
            }

            await loadProfile();
        }
    } catch (e) {
        console.error('Donation check error:', e);
    }
}

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
