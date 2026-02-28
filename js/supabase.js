// Supabase Client - Auto token refresh on 401
const SUPABASE_URL = 'https://jppfsqkshcmwskcdsqis.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwcGZzcWtzaGNtd3NrY2RzcWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MjczMzgsImV4cCI6MjA4NjUwMzMzOH0.ACkiOnXuKGnzKTqi2HSLggktIzrRWOFLje-dp20dpqU';
const OWNER_EMAIL = 'redadarwichepaypal@gmail.com';

function safeParseNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    }
    return 0;
}

class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.accessToken = null;
        this.user = null;
        this._refreshing = null;
    }

    headers() {
        return {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${this.accessToken || this.key}`
        };
    }

    async signUp(email, password) {
        const res = await fetch(`${this.url}/auth/v1/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': this.key },
            body: JSON.stringify({ email, password, options: { data: {} } })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Signup failed');
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
        if (data.error) throw new Error(data.error.message || data.error_description || 'Login failed');
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
            const refreshed = await this.refreshToken();
            if (!refreshed) return null;
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
        // Prevent multiple simultaneous refreshes
        if (this._refreshing) return this._refreshing;

        this._refreshing = (async () => {
            const refreshToken = localStorage.getItem('sb_refresh_token');
            if (!refreshToken) return false;
            try {
                const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': this.key },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });
                const data = await res.json();
                if (data.access_token) {
                    this.accessToken = data.access_token;
                    this.user = data.user;
                    localStorage.setItem('sb_access_token', data.access_token);
                    if (data.refresh_token) localStorage.setItem('sb_refresh_token', data.refresh_token);
                    console.log('[Supabase] Token refreshed successfully');
                    return true;
                }
            } catch (e) {
                console.error('[Supabase] Token refresh failed:', e);
            }
            return false;
        })();

        const result = await this._refreshing;
        this._refreshing = null;
        return result;
    }

    async query(table, method, options = {}, _retried = false) {
        let url = `${this.url}/rest/v1/${table}`;
        const headers = this.headers();

        if (options.select) url += `?select=${options.select}`;
        if (options.filters) {
            url += (url.includes('?') ? '&' : '?') + options.filters;
        }
        if (options.order) {
            url += (url.includes('?') ? '&' : '?') + `order=${options.order}`;
        }
        if (options.limit) {
            url += (url.includes('?') ? '&' : '?') + `limit=${options.limit}`;
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
        if (options.body) fetchOptions.body = JSON.stringify(options.body);

        const res = await fetch(url, fetchOptions);

        // AUTO REFRESH ON 401
        if (res.status === 401 && !_retried) {
            console.log('[Supabase] Got 401, attempting token refresh...');
            const refreshed = await this.refreshToken();
            if (refreshed) {
                return this.query(table, method, options, true);
            } else {
                throw new Error('Session expired. Please login again.');
            }
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(err.message || err.details || 'Database error');
        }

        const text = await res.text();
        if (!text) return null;
        return JSON.parse(text);
    }

    async select(table, columns = '*', filters = '', order = '', limit = '') {
        return this.query(table, 'GET', { select: columns, filters, order, limit });
    }

    async insert(table, data) {
        return this.query(table, 'POST', { body: data, select: '*' });
    }

    async upsert(table, data) {
        return this.query(table, 'POST', { body: data, upsert: true, select: '*' });
    }

    async update(table, data, filters) {
        return this.query(table, 'PATCH', { body: data, filters, select: '*' });
    }

    async delete(table, filters) {
        return this.query(table, 'DELETE', { filters });
    }

    async selectSingle(table, columns = '*', filters = '') {
        return this.query(table, 'GET', { select: columns, filters, single: true });
    }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
