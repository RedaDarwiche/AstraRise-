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
        // Find recipient
        const profiles = await supabase.select('profiles', '*', `username=eq.${recipientUsername}`);
        if (!profiles || profiles.length === 0) {
            showToast('User not found', 'error');
            return;
        }
        
        const recipient = profiles[0];
        const recipientBalance = safeParseNumber(recipient.high_score);
        
        // Deduct from sender
        await updateBalance(userBalance - amount);
        
        // Add to recipient
        const newRecipientBalance = Math.min(recipientBalance + amount, Number.MAX_SAFE_INTEGER);
        await supabase.update('profiles',
            { high_score: newRecipientBalance },
            `id=eq.${recipient.id}`
        );
        
        // Create donation record
        await supabase.insert('donations', {
            from_user_id: currentUser.id,
            from_username: userProfile.username,
            to_user_id: recipient.id,
            to_username: recipientUsername,
            amount: amount,
            seen: false
        });
        
        // Notify via socket
        if (socket && socket.connected) {
            socket.emit('donation_sent', {
    fromUsername: userProfile.username,
    fromRank: typeof getEquippedRank === 'function' ? getEquippedRank() : null,
    toUsername: recipientUsername,
    toUserId: recipient.id,
    amount: amount
});
        }
        
        showToast(`Donated ${amount.toLocaleString()} Astraphobia to ${recipientUsername}!`, 'success');
        document.getElementById('donateUsername').value = '';
        document.getElementById('donateAmount').value = '';
        
    } catch(e) {
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
            
            // Mark as seen
            for (const d of donations) {
                await supabase.update('donations', { seen: true }, `id=eq.${d.id}`);
            }
            
            // Reload balance
            await loadProfile();
        }
    } catch(e) {
        console.error('Donation check error:', e);
    }
}

// Check for donation notifications every 15 seconds
setInterval(() => {
    if (currentUser) checkDonationNotifications();
}, 15000);
