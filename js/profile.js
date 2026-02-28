// Profile Page
function loadProfilePage() {
    if (!currentUser || !userProfile) return;
    
    document.getElementById('profileUsername').textContent = userProfile.username || 'Unknown';
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileBalance').textContent = userBalance.toLocaleString();
    document.getElementById('profileAvatar').textContent = (userProfile.username || '?').charAt(0).toUpperCase();
    document.getElementById('editUsername').value = userProfile.username || '';
    
    document.getElementById('profileWins').textContent = totalWins;
    document.getElementById('profileWagered').textContent = totalWagered.toLocaleString();
    document.getElementById('profileHighScore').textContent = userBalance.toLocaleString();
}

async function updateUsername() {
    const newUsername = document.getElementById('editUsername').value.trim();
    
    if (newUsername.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }

    try {
        await supabase.update('profiles', 
            { username: newUsername, updated_at: new Date().toISOString() },
            `id=eq.${currentUser.id}`
        );
        
        userProfile.username = newUsername;
        document.getElementById('profileUsername').textContent = newUsername;
        document.getElementById('profileAvatar').textContent = newUsername.charAt(0).toUpperCase();
        document.getElementById('userAvatar').textContent = newUsername.charAt(0).toUpperCase();
        showToast('Username updated!', 'success');
    } catch (e) {
        showToast('Error updating username: ' + e.message, 'error');
    }
}