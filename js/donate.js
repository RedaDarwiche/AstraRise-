// donate.js — SERVER-SIDE Donations + Cooldown + Tags (NO duplicate toasts)
let donationCooldown = false;
let donationInFlight = false;

function parseAmountInput(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');

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
    showToast("You can't donate to yourself!", 'error'); return;
  }

  donationInFlight = true;
  donationCooldown = true;

  const donateBtn = document.querySelector('#donateModal .btn-primary.btn-full');
  if (donateBtn) { donateBtn.disabled = true; donateBtn.textContent = 'Sending...'; }

  setTimeout(() => {
    donationCooldown = false;
    if (donateBtn) { donateBtn.disabled = false; donateBtn.textContent = 'Send Donation'; }
  }, 5000);

  try {
    // Get recipient id
    const profiles = await supabase.select('profiles', 'id,username', `username=eq.${encodeURIComponent(recipientUsername)}`);
    if (!profiles || profiles.length === 0) {
      donationInFlight = false;
      showToast('User not found', 'error');
      return;
    }
    const recipient = profiles[0];

    const payload = {
      fromUserId: currentUser.id,
      fromUsername: userProfile.username,
      fromIsOwner: currentUser.email === OWNER_EMAIL,
      fromRank: (typeof getEquippedRank === 'function' ? getEquippedRank() : null),
      toUserId: recipient.id,
      toUsername: recipientUsername,
      amount
    };

    // 12s safety timeout in case server never ACKs
    let acked = false;
    const timeout = setTimeout(() => {
      if (acked) return;
      donationInFlight = false;
      showToast('Donation failed: server did not respond', 'error');
    }, 12000);

    socket.emit('donation_make', payload, async (resp) => {
      acked = true;
      clearTimeout(timeout);
      donationInFlight = false;

      if (!resp || !resp.ok) {
        showToast('Donation failed: ' + (resp?.error || 'Unknown error'), 'error');
        return;
      }

      showToast(`Donated ${amount.toLocaleString()} Astraphobia to ${recipientUsername}!`, 'success');
      document.getElementById('donateUsername').value = '';
      document.getElementById('donateAmount').value = '';

      // Refresh sender balance (server already deducted)
      if (typeof loadProfile === 'function') await loadProfile();
    });

  } catch (e) {
    donationInFlight = false;
    showToast('Donation error: ' + e.message, 'error');
  }
}

// Optional: mark seen + refresh (NO toasts here)
async function checkDonationNotifications() {
  if (!currentUser) return;
  try {
    const donations = await supabase.select('donations', 'id', `to_user_id=eq.${currentUser.id}&seen=eq.false`, 'created_at.desc', 50);
    if (donations && donations.length > 0) {
      for (const d of donations) {
        try { await supabase.update('donations', { seen: true }, `id=eq.${d.id}`); } catch(e) {}
      }
      if (typeof loadProfile === 'function') await loadProfile();
    }
  } catch (e) {}
}

function loadDonateNotifications() {
  const container = document.getElementById('donateNotifications');
  if (container) container.innerHTML = '';
}

setInterval(() => {
  if (currentUser) checkDonationNotifications();
}, 60000);
