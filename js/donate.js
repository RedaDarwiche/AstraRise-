// donate.js — Donations (SERVER-SIDE transfer) + Cooldown + Tags
let donationCooldown = false;
let donationInFlight = false;

function parseAmountInput(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');

  // allow: 1000000, 1m, 1mil, 500k, 2.5m, 1b
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
  if (!socket || !socket.connected) { showToast('Not connected to server', 'error'); return; }
  if (donationInFlight) { showToast('Donation already processing...', 'warning'); return; }
  if (donationCooldown) { showToast('Please wait before donating again', 'warning'); return; }

  const recipientUsername = document.getElementById('donateUsername').value.trim();
  const amountRaw = document.getElementById('donateAmount').value;
  const amount = parseAmountInput(amountRaw);

  if (!recipientUsername) { showToast('Enter a recipient username', 'error'); return; }
  if (!Number.isFinite(amount) || amount < 1) { showToast('Minimum donation is 1', 'error'); return; }
  if (amount > userBalance) { showToast('Insufficient balance', 'error'); return; }
  if (recipientUsername.toLowerCase() === (userProfile.username || '').toLowerCase()) {
    showToast("You can't donate to yourself!", 'error');
    return;
  }

  donationInFlight = true;
  donationCooldown = true;

  const donateBtn = document.querySelector('#donateModal .btn-primary.btn-full');
  if (donateBtn) { donateBtn.disabled = true; donateBtn.textContent = 'Sending...'; }

  // cooldown reset (even if server fails, still prevents spam)
  setTimeout(() => {
    donationCooldown = false;
    if (donateBtn) { donateBtn.disabled = false; donateBtn.textContent = 'Send Donation'; }
  }, 5000);

  try {
    // Find recipient id (client can read profiles)
    const profiles = await supabase.select('profiles', 'id,username', `username=eq.${encodeURIComponent(recipientUsername)}`);
    if (!profiles || profiles.length === 0) {
      showToast('User not found', 'error');
      donationInFlight = false;
      return;
    }

    const recipient = profiles[0];

    const isOwnerUser = currentUser.email === OWNER_EMAIL;
    const fromRank = (typeof getEquippedRank === 'function') ? getEquippedRank() : null;

    socket.emit('donation_make', {
      fromUserId: currentUser.id,
      fromUsername: userProfile.username,
      fromIsOwner: isOwnerUser,
      fromRank: fromRank,

      toUserId: recipient.id,
      toUsername: recipientUsername,

      amount: amount
    }, async (resp) => {
      donationInFlight = false;

      if (!resp || !resp.ok) {
        showToast('Donation failed: ' + (resp?.error || 'Unknown error'), 'error');
        return;
      }

      showToast(`Donated ${amount.toLocaleString()} Astraphobia to ${recipientUsername}!`, 'success');
      document.getElementById('donateUsername').value = '';
      document.getElementById('donateAmount').value = '';

      // reload sender balance (server already deducted)
      if (typeof loadProfile === 'function') await loadProfile();
    });

  } catch (e) {
    donationInFlight = false;
    showToast('Donation error: ' + e.message, 'error');
  }
}

// OPTIONAL: Keep polling only to mark donations as seen + refresh balance.
// IMPORTANT: DO NOT toast here (socket shows the tag-based toast).
async function checkDonationNotifications() {
  if (!currentUser) return;

  try {
    const donations = await supabase.select(
      'donations',
      'id,to_user_id,seen',
      `to_user_id=eq.${currentUser.id}&seen=eq.false`,
      'created_at.desc',
      50
    );

    if (donations && donations.length > 0) {
      for (const d of donations) {
        try { await supabase.update('donations', { seen: true }, `id=eq.${d.id}`); } catch(e) {}
      }
      if (typeof loadProfile === 'function') await loadProfile();
    }
  } catch (e) {
    // ignore missing table or RLS errors
  }
}

function loadDonateNotifications() {
  const container = document.getElementById('donateNotifications');
  if (container) container.innerHTML = '';
}

setInterval(() => {
  if (currentUser) checkDonationNotifications();
}, 60000);
