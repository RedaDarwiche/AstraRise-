// Donation System - Cooldown + Tags + Proper Large Amount Parsing + Dedupe
let donationCooldown = false;
let donationCheckInFlight = false;
const processedDonationIds = new Set();

function parseAmountInput(raw) {
  if (raw === null || raw === undefined) return NaN;

  // turn into string, remove commas/spaces
  const s = String(raw).trim().toLowerCase().replace(/,/g, '');

  // supports: 1000000, 1m, 1mil, 500k, 2.5m, 1b
  const m = s.match(/^(\d+(\.\d+)?)(k|m|mil|b)?$/i);
  if (!m) return Math.floor(Number(s));

  let num = parseFloat(m[1]);
  const suffix = (m[3] || '').toLowerCase();

  if (suffix === 'k') num *= 1e3;
  if (suffix === 'm' || suffix === 'mil') num *= 1e6;
  if (suffix === 'b') num *= 1e9;

  return Math.floor(num);
}

async function sendDonation() {
  if (!currentUser || !userProfile) { showToast('Please login', 'error'); return; }
  if (donationCooldown) { showToast('Please wait before donating again', 'warning'); return; }

  const recipientUsername = document.getElementById('donateUsername').value.trim();
  const amountRaw = document.getElementById('donateAmount').value;
  const amount = parseAmountInput(amountRaw);

  if (!recipientUsername) { showToast('Enter a recipient username', 'error'); return; }
  if (!Number.isFinite(amount) || amount < 1) { showToast('Minimum donation is 1', 'error'); return; }
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
    const profiles = await supabase.select('profiles', '*', `username=eq.${encodeURIComponent(recipientUsername)}`);
    if (!profiles || profiles.length === 0) { showToast('User not found', 'error'); return; }

    const recipient = profiles[0];
    const recipientBalance = safeParseNumber(recipient.high_score);

    // Deduct sender
    await updateBalance(userBalance - amount);

    // Credit recipient
    const newRecipientBalance = Math.min(recipientBalance + amount, Number.MAX_SAFE_INTEGER);
    await supabase.update('profiles', { high_score: newRecipientBalance }, `id=eq.${recipient.id}`);

    // Insert donation row (to prevent duplicates we want the id)
    let donationId = null;
    try {
      const inserted = await supabase.insert('donations', {
        from_user_id: currentUser.id,
        from_username: userProfile.username,
        to_user_id: recipient.id,
        to_username: recipientUsername,
        amount: amount,
        seen: false
      });

      // postgrest typically returns array
      if (Array.isArray(inserted) && inserted[0] && inserted[0].id) {
        donationId = inserted[0].id;
      }
    } catch (e) {
      console.warn('Donations table insert failed:', e.message);
    }

    // Notify via socket (include donationId to dedupe)
    if (typeof socket !== 'undefined' && socket && socket.connected) {
      const isOwnerUser = currentUser.email === OWNER_EMAIL;
      socket.emit('donation_sent', {
        donationId,
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
  if (donationCheckInFlight) return;
  donationCheckInFlight = true;

  try {
    const donations = await supabase.select(
      'donations',
      '*',
      `to_user_id=eq.${currentUser.id}&seen=eq.false`,
      'created_at.desc'
    );

    if (donations && donations.length > 0) {
      for (const d of donations) {
        if (d.id && processedDonationIds.has(d.id)) continue;
        if (d.id) processedDonationIds.add(d.id);

        showToast(`❤️ ${d.from_username} donated ${safeParseNumber(d.amount).toLocaleString()} Astraphobia to you!`, 'success');

        // mark seen
        try { await supabase.update('donations', { seen: true }, `id=eq.${d.id}`); } catch(e) {}
      }

      await loadProfile();
    }
  } catch (e) {
    if (!String(e.message || '').includes('relation') && !String(e.message || '').includes('does not exist')) {
      console.warn('Donation check:', e.message);
    }
  } finally {
    donationCheckInFlight = false;
  }
}

function loadDonateNotifications() {
  const container = document.getElementById('donateNotifications');
  if (container) container.innerHTML = '';
}

setInterval(() => {
  if (currentUser) checkDonationNotifications();
}, 30000);
