// --- AUTHENTICATION LOGIC ---

async function signup() {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (username.length < 3) { showToast('Username must be 3+ chars', 'error'); return; }
    if (password.length < 6) { showToast('Password must be 6+ chars', 'error'); return; }

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { username: username } // Metadata
        }
    });

    if (error) {
        showToast(error.message, 'error');
        return;
    }

    // Create Profile Entry in Database with 100 coins
    if (data.user) {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([
                { 
                    id: data.user.id, 
                    username: username, 
                    high_score: 100, // 100 Free Coins
                    email: email 
                }
            ]);

        if (profileError) {
            console.error('Profile creation failed:', profileError);
        } else {
            showToast('Account created! +100 Coins', 'success');
            hideModal('signupModal');
            
            // FORCE RELOAD TO UPDATE UI
            setTimeout(() => {
                window.location.reload(); 
            }, 1000);
        }
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showToast(error.message, 'error');
        return;
    }

    if (data.user) {
        showToast('Logged in successfully!', 'success');
        hideModal('loginModal');
        
        // FORCE RELOAD TO UPDATE UI
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }
}

function logout() {
    supabase.auth.signOut().then(() => {
        showToast('Logged out', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });
}
