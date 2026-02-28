// --- START OF FILE supabase.js ---

// Supabase Client
const SUPABASE_URL = 'https://jppfsqkshcmwskcdsqis.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwcGZzcWtzaGNtd3NrY2RzcWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MjczMzgsImV4cCI6MjA4NjUwMzMzOH0.ACkiOnXuKGnzKTqi2HSLggktIzrRWOFLje-dp20dpqU';
const OWNER_EMAIL = 'redadarwichepaypal@gmail.com';

class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.accessToken = localStorage.getItem('sb_access_token');
        this.user = null;
    }

    headers() {
        const h = {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${this.accessToken || this.key}`
        };
        return h;
    }

    async signUp(email, password) {
        const res = await fetch(`${this.url}/auth/v1/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': this.key },
            body: JSON.stringify({ email, password, options: { data: {} } })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.msg || data.message || data.error_description || data.error || 'Signup failed');
        }

        if (data.access_token) {
            this.accessToken = data.access_token;
            this.user = data.user;
            localStorage.setItem('sb_access_token', data.access_token);
            if (data.refresh_token) localStorage.setItem('sb_refresh_token', data.refresh_token);
        } else if (data.user) {
            this.user = data.user;
        }
        return data;
    }

    async signIn(email, password) {
        const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': this.key },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            // Checks for specific Supabase error fields
            throw new Error(data.error_description || data.msg || data.message || data.error || 'Login failed');
        }

        this.accessToken = data.access_token;
        this.user = data.user;
        localStorage.setItem('sb_access_token', data.access_token);
        localStorage.setItem('sb_refresh_token', data.refresh_token);
        return data;
    }

    async signOut() {
        if (this.accessToken) {
            await fetch(`${this.url}/auth/v1/logout`, {
                method: 'POST',
                headers: this.headers()
            }).catch(() => {});
        }
        this.accessToken = null;
        this.user = null;
        localStorage.removeItem('sb_access_token');
        localStorage.removeItem('sb_refresh_token');
    }

    async getUser() {
        const token = this.accessToken || localStorage.getItem('sb_access_token');
        if (!token) return null;
        
        this.accessToken = token;
        
        const res = await fetch(`${this.url}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': this.key }
        });
        
        if (!res.ok) {
            // Try refresh if token invalid
            const refreshed = await this.refreshToken();
            if (!refreshed) {
                // Clear invalid tokens
                this.signOut();
                return null;
            }
            // Retry with new token
            const res2 = await fetch(`${this.url}/auth/v1/user`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}`, 'apikey': this.key }
            });
            if (!res2.ok) return null;
            this.user = await res2.json();
            return this.user;
        }
        
        this.user = await res.json();
        return this.user;
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('sb_refresh_token');
        if (!refreshToken) return false;
        try {
            const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': this.key },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                console.warn('Refresh token failed:', data);
                return false;
            }

            if (data.access_token) {
                this.accessToken = data.access_token;
                this.user = data.user;
                localStorage.setItem('sb_access_token', data.access_token);
                localStorage.setItem('sb_refresh_token', data.refresh_token);
                return true;
            }
        } catch (e) {
            console.error('Refresh token error:', e);
        }
        return false;
    }

    // REST API for database operations
    async from(table) {
        return new QueryBuilder(this, table);
    }

    async query(table, method, options = {}) {
        let url = `${this.url}/rest/v1/${table}`;
        const headers = this.headers();
        
        if (options.select) {
            url += `?select=${options.select}`;
        }
        
        if (options.filters) {
            const sep = url.includes('?') ? '&' : '?';
            url += sep + options.filters;
        }

        if (options.order) {
            const sep = url.includes('?') ? '&' : '?';
            url += sep + `order=${options.order}`;
        }

        if (options.limit) {
            const sep = url.includes('?') ? '&' : '?';
            url += sep + `limit=${options.limit}`;
        }

        if (options.single) {
            headers['Accept'] = 'application/vnd.pgrst.object+json';
        }

        if (method === 'POST' && options.upsert) {
            headers['Prefer'] = 'resolution=merge-duplicates';
        }

        if (method === 'PATCH' || method === 'DELETE') {
            headers['Prefer'] = 'return=representation';
        }

        if (method === 'POST') {
            headers['Prefer'] = headers['Prefer'] || 'return=representation';
        }

        const fetchOptions = { method, headers };
        if (options.body) {
            fetchOptions.body = JSON.stringify(options.body);
        }

        const res = await fetch(url, fetchOptions);
        
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(err.message || err.details || err.msg || `Database error: ${res.status}`);
        }

        const text = await res.text();
        if (!text) return null;
        return JSON.parse(text);
    }

    // Select
    async select(table, columns = '*', filters = '', order = '', limit = '') {
        return this.query(table, 'GET', { select: columns, filters, order, limit });
    }

    // Insert
    async insert(table, data) {
        return this.query(table, 'POST', { body: data, select: '*' });
    }

    // Upsert
    async upsert(table, data) {
        return this.query(table, 'POST', { body: data, upsert: true, select: '*' });
    }

    // Update
    async update(table, data, filters) {
        return this.query(table, 'PATCH', { body: data, filters, select: '*' });
    }

    // Delete
    async delete(table, filters) {
        return this.query(table, 'DELETE', { filters });
    }

    // Single row select
    async selectSingle(table, columns = '*', filters = '') {
        return this.query(table, 'GET', { select: columns, filters, single: true });
    }
}

class QueryBuilder {
    constructor(client, table) {
        this.client = client;
        this.table = table;
    }
    
    // Placeholder for cleaner chaining syntax if needed in future
    select(columns) { return this.client.select(this.table, columns); }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
