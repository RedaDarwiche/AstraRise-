// Forum System
let currentForumFilter = 'all';
let currentPostId = null;

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return Math.floor(diff / 604800) + 'w ago';
}

async function loadForumPosts() {
    const container = document.getElementById('forumPosts');
    container.innerHTML = '<div class="loading">Loading posts...</div>';

    try {
        let filters = 'order=created_at.desc';
        if (currentForumFilter !== 'all') {
            filters = `category=eq.${currentForumFilter}&order=created_at.desc`;
        }

        const posts = await supabase.select('forum_posts', '*', currentForumFilter !== 'all' ? `category=eq.${currentForumFilter}` : '', 'created_at.desc');

        if (!posts || posts.length === 0) {
            container.innerHTML = '<div class="loading">No posts yet. Be the first to post!</div>';
            return;
        }

        container.innerHTML = posts.map(post => {
            let tagHTML = '';
            if (post.is_owner) tagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
            if (post.equipped_rank && typeof getRankTagHTML === 'function') tagHTML += getRankTagHTML(false, post.equipped_rank);
            const deleteBtn = (isOwner() || (currentUser && post.user_id === currentUser.id))
                ? '<button class="delete-btn" onclick="event.stopPropagation();showConfirmDeletePost(\'' + post.id + '\')">Delete</button>' : '';
            return `
            <div class="forum-post" onclick="viewPost('${post.id}')">
                <div class="forum-post-header">
                    <span class="forum-post-title">${escapeHtml(post.title)}</span>
                    <span class="forum-post-category">${post.category}</span>
                </div>
                <div class="forum-post-meta">
                    <span>${tagHTML}${escapeHtml(post.author)}</span>
                    <span>${timeAgo(post.created_at)}</span>
                    ${deleteBtn}
                </div>
            </div>
        `}).join('');
    } catch (e) {
        console.error('Load posts error:', e);
        container.innerHTML = '<div class="loading">Error loading posts</div>';
    }
}

function filterForum(category) {
    currentForumFilter = category;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadForumPosts();
}

async function createPost() {
    if (!currentUser) { showToast('Please login', 'error'); return; }

    const category = document.getElementById('postCategory').value;
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();

    if (!title || !content) { showToast('Please fill in all fields', 'error'); return; }

    try {
        const payload = {
            category,
            title,
            description: content,
            author: userProfile ? userProfile.username : 'Anonymous',
            user_id: currentUser.id,
            is_owner: isOwner(),
            created_at: new Date().toISOString()
        };
        const equippedRank = typeof getEquippedRank === 'function' ? getEquippedRank() : null;
        if (equippedRank != null) payload.equipped_rank = equippedRank;
        try {
            await supabase.insert('forum_posts', payload);
        } catch (err) {
            if (equippedRank != null && (err.message || '').includes('equipped_rank')) {
                delete payload.equipped_rank;
                await supabase.insert('forum_posts', payload);
            } else throw err;
        }

        hideModal('createPostModal');
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        loadForumPosts();
        showToast('Post created!', 'success');
    } catch (e) {
        showToast('Error creating post: ' + e.message, 'error');
    }
}

async function viewPost(postId) {
    currentPostId = postId;
    navigateTo('post-detail');

    const container = document.getElementById('postDetailContent');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const post = await supabase.selectSingle('forum_posts', '*', `id=eq.${postId}`);

        if (!post) {
            container.innerHTML = '<div class="loading">Post not found</div>';
            return;
        }

        let postTagHTML = '';
        if (post.is_owner) postTagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
        if (post.equipped_rank && typeof getRankTagHTML === 'function') postTagHTML += getRankTagHTML(false, post.equipped_rank);

        container.innerHTML = `
            <div class="forum-post" style="cursor:default; margin-top:20px;">
                <div class="forum-post-header">
                    <span class="forum-post-title" style="font-size:1.4em;">${escapeHtml(post.title)}</span>
                    <span class="forum-post-category">${post.category}</span>
                </div>
                <div class="forum-post-meta">
                    <span>${postTagHTML}${escapeHtml(post.author)}</span>
                    <span>${timeAgo(post.created_at)}</span>
                </div>
                <div class="forum-post-content">${escapeHtml(post.description)}</div>
            </div>
        `;

        if (currentUser) {
            document.getElementById('commentForm').style.display = 'block';
        }

        loadComments(postId);
    } catch (e) {
        container.innerHTML = '<div class="loading">Error loading post</div>';
    }
}

async function loadComments(postId) {
    const container = document.getElementById('commentsList');

    try {
        const comments = await supabase.select('forum_comments', '*', `post_id=eq.${postId}`, 'created_at.asc');

        if (!comments || comments.length === 0) {
            container.innerHTML = '<div class="loading">No comments yet</div>';
            return;
        }

        container.innerHTML = comments.map(c => {
            let cTagHTML = '';
            if (c.is_owner) cTagHTML += '<span class="rank-tag rank-owner">OWNER</span>';
            if (c.equipped_rank && typeof getRankTagHTML === 'function') cTagHTML += getRankTagHTML(false, c.equipped_rank);
            const cDeleteBtn = (isOwner() || (currentUser && c.user_id === currentUser.id))
                ? '<button class="delete-btn" onclick="showConfirmDeleteComment(\'' + c.id + '\')">Delete</button>' : '';
            return `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${cTagHTML}${escapeHtml(c.author)}</span>
                    <div>
                        <span class="comment-time">${timeAgo(c.created_at)}</span>
                        ${cDeleteBtn}
                    </div>
                </div>
                <div class="comment-content">${escapeHtml(c.content)}</div>
            </div>
        `}).join('');
    } catch (e) {
        container.innerHTML = '<div class="loading">Error loading comments</div>';
    }
}

async function submitComment() {
    if (!currentUser) return;

    const content = document.getElementById('commentInput').value.trim();
    if (!content) { showToast('Comment cannot be empty', 'error'); return; }

    try {
        const payload = {
            post_id: currentPostId,
            author: userProfile ? userProfile.username : 'Anonymous',
            content,
            user_id: currentUser.id,
            is_owner: isOwner(),
            created_at: new Date().toISOString()
        };
        const equippedRank = typeof getEquippedRank === 'function' ? getEquippedRank() : null;
        if (equippedRank != null) payload.equipped_rank = equippedRank;
        try {
            await supabase.insert('forum_comments', payload);
        } catch (err) {
            if (equippedRank != null && (err.message || '').includes('equipped_rank')) {
                delete payload.equipped_rank;
                await supabase.insert('forum_comments', payload);
            } else throw err;
        }

        document.getElementById('commentInput').value = '';
        loadComments(currentPostId);
        showToast('Comment posted!', 'success');
    } catch (e) {
        showToast('Error posting comment: ' + e.message, 'error');
    }
}

// In-game confirm delete (no browser confirm / no freezing white toast)
let pendingDeletePostId = null;
let pendingDeleteCommentId = null;

function showConfirmDeletePost(postId) {
    pendingDeletePostId = postId;
    pendingDeleteCommentId = null;
    document.getElementById('confirmDeleteMessage').textContent = 'Delete this post?';
    document.getElementById('confirmDeleteYesBtn').onclick = confirmDeleteYes;
    showModal('confirmDeleteModal');
}

function showConfirmDeleteComment(commentId) {
    pendingDeleteCommentId = commentId;
    pendingDeletePostId = null;
    document.getElementById('confirmDeleteMessage').textContent = 'Delete this comment?';
    document.getElementById('confirmDeleteYesBtn').onclick = confirmDeleteYes;
    showModal('confirmDeleteModal');
}

async function confirmDeleteYes() {
    hideModal('confirmDeleteModal');
    if (pendingDeletePostId) {
        const postId = pendingDeletePostId;
        pendingDeletePostId = null;
        try {
            await supabase.delete('forum_comments', `post_id=eq.${postId}`);
            await supabase.delete('forum_posts', `id=eq.${postId}`);
            loadForumPosts();
        } catch (e) {
            showToast('Error deleting post', 'error');
        }
        return;
    }
    if (pendingDeleteCommentId) {
        const commentId = pendingDeleteCommentId;
        pendingDeleteCommentId = null;
        try {
            await supabase.delete('forum_comments', `id=eq.${commentId}`);
            loadComments(currentPostId);
        } catch (e) {
            showToast('Error deleting comment', 'error');
        }
    }
}

async function deletePost(postId) {
    try {
        await supabase.delete('forum_comments', `post_id=eq.${postId}`);
        await supabase.delete('forum_posts', `id=eq.${postId}`);
        loadForumPosts();
    } catch (e) {
        showToast('Error deleting post', 'error');
    }
}

async function deleteComment(commentId) {
    try {
        await supabase.delete('forum_comments', `id=eq.${commentId}`);
        loadComments(currentPostId);
    } catch (e) {
        showToast('Error deleting comment', 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}