// Star Citizen Trade Desk - SPA Application
const App = {
  user: null,
  init() {
    this.checkAuth();
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  async checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        this.user = await res.json();
        this.updateNav(true);
      } else {
        this.user = null;
        this.updateNav(false);
      }
    } catch { this.user = null; this.updateNav(false); }
  },

  updateNav(loggedIn) {
    document.querySelectorAll('.auth-only').forEach(el => el.style.display = loggedIn ? '' : 'none');
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = loggedIn ? 'none' : '');
    if (loggedIn && this.user) {
      document.getElementById('user-greeting').textContent = this.user.display_name || this.user.username;
    }
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    this.user = null;
    this.updateNav(false);
    window.location.hash = '#/';
  },

  route() {
    const hash = window.location.hash || '#/';
    const [path, ...params] = hash.slice(2).split('/');
    const app = document.getElementById('app');

    switch(path) {
      case '': case 'browse': this.renderBrowse(app); break;
      case 'login': this.renderLogin(app); break;
      case 'register': this.renderRegister(app); break;
      case 'sell': this.renderSell(app); break;
      case 'listing': this.renderListing(app, params[0]); break;
      case 'my-listings': this.renderMyListings(app); break;
      case 'messages': this.renderMessages(app, params[0]); break;
      case 'profile': this.renderProfile(app, params[0]); break;
      default: app.innerHTML = '<div class="container"><h2>Page not found</h2></div>';
    }
  },

  // Browse / Home
  async renderBrowse(container) {
    container.innerHTML = `
      <div class="container">
        <div class="hero">
          <h1>Trade Ships & Gear</h1>
          <p>Buy and sell Star Citizen ships, vehicles, weapons, and more for USD or aUEC</p>
        </div>
        <div class="filters">
          <select id="filter-category" class="input">
            <option value="all">All Categories</option>
            <option value="ship">Ships</option>
            <option value="vehicle">Vehicles</option>
            <option value="weapon">Weapons</option>
            <option value="armor">Armor</option>
            <option value="component">Components</option>
            <option value="commodity">Commodities</option>
            <option value="other">Other</option>
          </select>
          <input type="text" id="filter-search" class="input" placeholder="Search listings...">
          <select id="filter-currency" class="input">
            <option value="">Any Currency</option>
            <option value="usd">USD Only</option>
            <option value="auec">aUEC Only</option>
          </select>
          <select id="filter-sort" class="input">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
          <button class="btn btn-primary" id="filter-btn">Filter</button>
        </div>
        <div class="listings-grid" id="listings-grid">
          <div class="loading">Loading listings...</div>
        </div>
      </div>`;
    
    const loadListings = async () => {
      const cat = document.getElementById('filter-category').value;
      const search = document.getElementById('filter-search').value;
      const currency = document.getElementById('filter-currency').value;
      const sort = document.getElementById('filter-sort').value;
      const params = new URLSearchParams();
      if (cat !== 'all') params.set('category', cat);
      if (search) params.set('search', search);
      if (currency) params.set('currency', currency);
      if (sort) params.set('sort', sort);

      const res = await fetch(`/api/listings?${params}`);
      const listings = await res.json();
      const grid = document.getElementById('listings-grid');

      if (!listings.length) {
        grid.innerHTML = '<div class="empty-state"><p>No listings found. Be the first to sell something!</p></div>';
        return;
      }

      grid.innerHTML = listings.map(l => `
        <a href="#/listing/${l.id}" class="listing-card">
          <div class="listing-image">
            ${l.image_url ? `<img src="${l.image_url}" alt="${l.title}">` : '<div class="no-image">🚀</div>'}
          </div>
          <div class="listing-body">
            <span class="category-badge badge-${l.category}">${l.category}</span>
            <h3 class="listing-title">${l.title}</h3>
            <p class="listing-item">${l.item_name}${l.manufacturer ? ` · ${l.manufacturer}` : ''}</p>
            <div class="listing-prices">
              ${l.accept_usd && l.price_usd ? `<span class="price price-usd">$${Number(l.price_usd).toFixed(2)}</span>` : ''}
              ${l.accept_auec && l.price_auec ? `<span class="price price-auec">${Number(l.price_auec).toLocaleString()} aUEC</span>` : ''}
            </div>
            <div class="listing-meta">
              <span class="seller">@${l.seller_username}</span>
              <span class="condition">${l.condition}</span>
            </div>
          </div>
        </a>
      `).join('');
    };

    document.getElementById('filter-btn').addEventListener('click', loadListings);
    document.getElementById('filter-search').addEventListener('keyup', e => { if (e.key === 'Enter') loadListings(); });
    loadListings();
  },

  // Login
  renderLogin(container) {
    container.innerHTML = `
      <div class="container container-sm">
        <div class="form-card">
          <h2>Log In</h2>
          <div class="error-msg" id="login-error" style="display:none"></div>
          <form id="login-form">
            <div class="form-group">
              <label>Username or Email</label>
              <input type="text" name="username" class="input" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" class="input" required>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Log In</button>
          </form>
          <p class="form-footer">Don't have an account? <a href="#/register">Sign up</a></p>
        </div>
      </div>`;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
      });
      const data = await res.json();
      if (res.ok) {
        await this.checkAuth();
        window.location.hash = '#/';
      } else {
        const err = document.getElementById('login-error');
        err.textContent = data.error;
        err.style.display = 'block';
      }
    });
  },

  // Register
  renderRegister(container) {
    container.innerHTML = `
      <div class="container container-sm">
        <div class="form-card">
          <h2>Create Account</h2>
          <div class="error-msg" id="reg-error" style="display:none"></div>
          <form id="register-form">
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" class="input" required minlength="3">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" class="input" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" class="input" required minlength="6">
            </div>
            <div class="form-group">
              <label>Display Name (optional)</label>
              <input type="text" name="displayName" class="input">
            </div>
            <div class="form-group">
              <label>Star Citizen Handle (optional)</label>
              <input type="text" name="scHandle" class="input" placeholder="Your RSI handle">
            </div>
            <button type="submit" class="btn btn-primary btn-full">Create Account</button>
          </form>
          <p class="form-footer">Already have an account? <a href="#/login">Log in</a></p>
        </div>
      </div>`;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'), email: form.get('email'),
          password: form.get('password'), displayName: form.get('displayName'),
          scHandle: form.get('scHandle')
        })
      });
      const data = await res.json();
      if (res.ok) {
        await this.checkAuth();
        window.location.hash = '#/';
      } else {
        const err = document.getElementById('reg-error');
        err.textContent = data.error;
        err.style.display = 'block';
      }
    });
  },

  // Create Listing
  renderSell(container) {
    if (!this.user) { window.location.hash = '#/login'; return; }
    container.innerHTML = `
      <div class="container container-md">
        <div class="form-card">
          <h2>Create Listing</h2>
          <div class="error-msg" id="sell-error" style="display:none"></div>
          <form id="sell-form">
            <div class="form-group">
              <label>Title</label>
              <input type="text" name="title" class="input" required placeholder="e.g. Selling my Constellation Andromeda">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Item Name</label>
                <input type="text" name="itemName" class="input" required placeholder="e.g. Constellation Andromeda">
              </div>
              <div class="form-group">
                <label>Manufacturer</label>
                <input type="text" name="manufacturer" class="input" placeholder="e.g. RSI">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Category</label>
                <select name="category" class="input" required>
                  <option value="ship">Ship</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="weapon">Weapon</option>
                  <option value="armor">Armor</option>
                  <option value="component">Component</option>
                  <option value="commodity">Commodity</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label>Condition</label>
                <select name="condition" class="input">
                  <option value="new">New</option>
                  <option value="used">Used</option>
                  <option value="upgraded">Upgraded</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea name="description" class="input textarea" rows="4" placeholder="Describe your item, upgrades, LTI status, etc."></textarea>
            </div>
            <div class="form-group">
              <label>Image URL (optional)</label>
              <input type="url" name="imageUrl" class="input" placeholder="https://...">
            </div>
            <h3 class="form-section-title">Pricing</h3>
            <div class="form-row">
              <div class="form-group">
                <label><input type="checkbox" name="acceptUsd" id="accept-usd"> Accept USD</label>
                <input type="number" name="priceUsd" class="input" step="0.01" min="0" placeholder="Price in USD" disabled id="price-usd">
              </div>
              <div class="form-group">
                <label><input type="checkbox" name="acceptAuec" id="accept-auec"> Accept aUEC</label>
                <input type="number" name="priceAuec" class="input" min="0" placeholder="Price in aUEC" disabled id="price-auec">
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Create Listing</button>
          </form>
        </div>
      </div>`;

    document.getElementById('accept-usd').addEventListener('change', e => {
      document.getElementById('price-usd').disabled = !e.target.checked;
    });
    document.getElementById('accept-auec').addEventListener('change', e => {
      document.getElementById('price-auec').disabled = !e.target.checked;
    });

    document.getElementById('sell-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const body = {
        title: form.get('title'), itemName: form.get('itemName'),
        manufacturer: form.get('manufacturer'), category: form.get('category'),
        condition: form.get('condition'), description: form.get('description'),
        imageUrl: form.get('imageUrl'),
        acceptUsd: document.getElementById('accept-usd').checked,
        acceptAuec: document.getElementById('accept-auec').checked,
        priceUsd: parseFloat(form.get('priceUsd')) || null,
        priceAuec: parseInt(form.get('priceAuec')) || null
      };
      if (!body.acceptUsd && !body.acceptAuec) {
        const err = document.getElementById('sell-error');
        err.textContent = 'Select at least one payment type';
        err.style.display = 'block';
        return;
      }
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) { window.location.hash = `#/listing/${data.id}`; }
      else {
        const err = document.getElementById('sell-error');
        err.textContent = data.error;
        err.style.display = 'block';
      }
    });
  },

  // Listing Detail
  async renderListing(container, id) {
    container.innerHTML = '<div class="container"><div class="loading">Loading...</div></div>';
    const res = await fetch(`/api/listings/${id}`);
    if (!res.ok) { container.innerHTML = '<div class="container"><h2>Listing not found</h2></div>'; return; }
    const l = await res.json();

    container.innerHTML = `
      <div class="container">
        <div class="listing-detail">
          <div class="listing-detail-image">
            ${l.image_url ? `<img src="${l.image_url}" alt="${l.title}">` : '<div class="no-image-lg">🚀</div>'}
          </div>
          <div class="listing-detail-info">
            <span class="category-badge badge-${l.category}">${l.category}</span>
            <span class="condition-badge">${l.condition}</span>
            ${l.status !== 'active' ? `<span class="status-badge status-${l.status}">${l.status}</span>` : ''}
            <h1>${l.title}</h1>
            <p class="item-name">${l.item_name}${l.manufacturer ? ` by ${l.manufacturer}` : ''}</p>
            <div class="detail-prices">
              ${l.accept_usd && l.price_usd ? `<div class="price-block"><span class="price-label">USD</span><span class="price-value">$${Number(l.price_usd).toFixed(2)}</span></div>` : ''}
              ${l.accept_auec && l.price_auec ? `<div class="price-block"><span class="price-label">aUEC</span><span class="price-value">${Number(l.price_auec).toLocaleString()}</span></div>` : ''}
            </div>
            ${l.description ? `<div class="description"><h3>Description</h3><p>${l.description}</p></div>` : ''}
            <div class="seller-info">
              <h3>Seller</h3>
              <a href="#/profile/${l.seller_username}" class="seller-link">
                @${l.seller_username} ${l.sc_handle ? `(${l.sc_handle})` : ''}
              </a>
              <span class="reputation">⭐ ${l.reputation || 0} rep</span>
            </div>
            ${this.user && this.user.id !== l.seller_id ? `
              <div class="contact-seller">
                <h3>Contact Seller</h3>
                <textarea id="msg-content" class="input textarea" rows="3" placeholder="Hi, I'm interested in this item..."></textarea>
                <button class="btn btn-primary" id="send-msg-btn">Send Message</button>
              </div>
            ` : ''}
            ${this.user && this.user.id === l.seller_id ? `
              <div class="owner-actions">
                <button class="btn btn-outline" id="mark-sold-btn">Mark as Sold</button>
                <button class="btn btn-danger" id="delete-listing-btn">Delete Listing</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>`;

    if (document.getElementById('send-msg-btn')) {
      document.getElementById('send-msg-btn').addEventListener('click', async () => {
        const content = document.getElementById('msg-content').value.trim();
        if (!content) return;
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiverId: l.seller_id, content, listingId: l.id })
        });
        document.getElementById('msg-content').value = '';
        alert('Message sent!');
      });
    }
    if (document.getElementById('mark-sold-btn')) {
      document.getElementById('mark-sold-btn').addEventListener('click', async () => {
        await fetch(`/api/listings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sold' })
        });
        this.route();
      });
    }
    if (document.getElementById('delete-listing-btn')) {
      document.getElementById('delete-listing-btn').addEventListener('click', async () => {
        if (!confirm('Delete this listing?')) return;
        await fetch(`/api/listings/${id}`, { method: 'DELETE' });
        window.location.hash = '#/my-listings';
      });
    }
  },

  // My Listings
  async renderMyListings(container) {
    if (!this.user) { window.location.hash = '#/login'; return; }
    container.innerHTML = '<div class="container"><h2>My Listings</h2><div class="loading">Loading...</div></div>';
    const res = await fetch(`/api/listings?seller=${this.user.id}`);
    const all = await res.json();
    const listings = all.filter(l => l.seller_id === this.user.id || l.seller_username === this.user.username);

    container.innerHTML = `
      <div class="container">
        <div class="page-header">
          <h2>My Listings</h2>
          <a href="#/sell" class="btn btn-primary">+ New Listing</a>
        </div>
        ${listings.length ? `<div class="listings-grid">${listings.map(l => `
          <a href="#/listing/${l.id}" class="listing-card">
            <div class="listing-image">
              ${l.image_url ? `<img src="${l.image_url}" alt="${l.title}">` : '<div class="no-image">🚀</div>'}
            </div>
            <div class="listing-body">
              <span class="category-badge badge-${l.category}">${l.category}</span>
              <span class="status-badge status-${l.status}">${l.status}</span>
              <h3 class="listing-title">${l.title}</h3>
              <div class="listing-prices">
                ${l.accept_usd && l.price_usd ? `<span class="price price-usd">$${Number(l.price_usd).toFixed(2)}</span>` : ''}
                ${l.accept_auec && l.price_auec ? `<span class="price price-auec">${Number(l.price_auec).toLocaleString()} aUEC</span>` : ''}
              </div>
            </div>
          </a>
        `).join('')}</div>` : '<div class="empty-state"><p>No listings yet. <a href="#/sell">Create your first listing!</a></p></div>'}
      </div>`;
  },

  // Messages
  async renderMessages(container, userId) {
    if (!this.user) { window.location.hash = '#/login'; return; }
    
    if (userId) {
      const res = await fetch(`/api/messages/${userId}`);
      const messages = await res.json();
      const otherUser = messages.length ? (messages[0].sender_id == userId ? messages[0].sender_username : this.user.username) : 'User';

      container.innerHTML = `
        <div class="container container-md">
          <a href="#/messages" class="back-link">&larr; All Conversations</a>
          <div class="messages-thread">
            <h2>Chat with @${otherUser}</h2>
            <div class="messages-list" id="messages-list">
              ${messages.map(m => `
                <div class="message ${m.sender_id == this.user.id ? 'message-mine' : 'message-theirs'}">
                  <div class="message-bubble">
                    <p>${m.content}</p>
                    <span class="message-time">${new Date(m.created_at).toLocaleString()}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="message-input">
              <textarea id="reply-content" class="input" rows="2" placeholder="Type a message..."></textarea>
              <button class="btn btn-primary" id="reply-btn">Send</button>
            </div>
          </div>
        </div>`;

      document.getElementById('reply-btn').addEventListener('click', async () => {
        const content = document.getElementById('reply-content').value.trim();
        if (!content) return;
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiverId: parseInt(userId), content })
        });
        this.renderMessages(container, userId);
      });
    } else {
      const res = await fetch('/api/messages');
      const convos = await res.json();

      container.innerHTML = `
        <div class="container container-md">
          <h2>Messages</h2>
          ${convos.length ? `<div class="conversations-list">${convos.map(c => `
            <a href="#/messages/${c.other_user_id}" class="conversation-item">
              <div class="convo-info">
                <span class="convo-user">@${c.other_username}</span>
                <span class="convo-time">${new Date(c.last_message_at).toLocaleDateString()}</span>
              </div>
              ${c.unread_count > 0 ? `<span class="badge">${c.unread_count}</span>` : ''}
            </a>
          `).join('')}</div>` : '<div class="empty-state"><p>No messages yet. Contact a seller to start a conversation!</p></div>'}
        </div>`;
    }
  },

  // Profile
  async renderProfile(container, username) {
    container.innerHTML = '<div class="container"><div class="loading">Loading...</div></div>';
    const res = await fetch(`/api/auth/profile/${username}`);
    if (!res.ok) { container.innerHTML = '<div class="container"><h2>User not found</h2></div>'; return; }
    const { user, listings, reviews } = await res.json();

    container.innerHTML = `
      <div class="container">
        <div class="profile-header">
          <div class="profile-avatar">${user.username[0].toUpperCase()}</div>
          <div class="profile-info">
            <h2>${user.display_name || user.username}</h2>
            <p class="profile-handle">@${user.username}${user.sc_handle ? ` · RSI: ${user.sc_handle}` : ''}</p>
            <p class="profile-meta">Joined ${new Date(user.created_at).toLocaleDateString()} · ⭐ ${user.reputation || 0} reputation</p>
          </div>
        </div>
        <h3>Active Listings (${listings.length})</h3>
        ${listings.length ? `<div class="listings-grid">${listings.map(l => `
          <a href="#/listing/${l.id}" class="listing-card">
            <div class="listing-image">
              ${l.image_url ? `<img src="${l.image_url}" alt="${l.title}">` : '<div class="no-image">🚀</div>'}
            </div>
            <div class="listing-body">
              <span class="category-badge badge-${l.category}">${l.category}</span>
              <h3 class="listing-title">${l.title}</h3>
              <div class="listing-prices">
                ${l.accept_usd && l.price_usd ? `<span class="price price-usd">$${Number(l.price_usd).toFixed(2)}</span>` : ''}
                ${l.accept_auec && l.price_auec ? `<span class="price price-auec">${Number(l.price_auec).toLocaleString()} aUEC</span>` : ''}
              </div>
            </div>
          </a>
        `).join('')}</div>` : '<p class="empty-state">No active listings</p>'}
        ${reviews.length ? `
          <h3>Reviews</h3>
          <div class="reviews-list">${reviews.map(r => `
            <div class="review-card">
              <div class="review-header">
                <span class="review-stars">${'⭐'.repeat(r.rating)}</span>
                <span class="review-author">by @${r.reviewer_username}</span>
              </div>
              ${r.comment ? `<p class="review-comment">${r.comment}</p>` : ''}
            </div>
          `).join('')}</div>
        ` : ''}
      </div>`;
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
