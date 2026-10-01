(() => {
  const db = window.dvSupabase;
  const $ = (id) => document.getElementById(id);

  const authView = $('authView');
  const activationView = $('activationView');
  const dashboardView = $('dashboardView');
  const statusBox = $('statusBox');
  const movieForm = $('movieForm');
  const movieList = $('movieList');
  const settingsForm = $('settingsForm');
  const currentUser = $('currentUser');

  let editingId = null;

  function showStatus(message, type = 'info') {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `status ${type}`;
    statusBox.hidden = false;
  }

  function clearStatus() {
    if (statusBox) statusBox.hidden = true;
  }

  function showOnly(view) {
    [authView, activationView, dashboardView].forEach(el => {
      if (el) el.hidden = el !== view;
    });
  }

  function categoriesFromForm() {
    return [...document.querySelectorAll('input[name="category"]:checked')].map(el => el.value);
  }

  function setCategories(values = []) {
    const set = new Set((values || []).map(v => String(v).toLowerCase()));
    document.querySelectorAll('input[name="category"]').forEach(el => {
      el.checked = set.has(el.value.toLowerCase());
    });
  }

  async function getSession() {
    if (!db) return null;
    const { data } = await db.auth.getSession();
    return data.session || null;
  }

  async function isCurrentUserAdmin(user) {
    if (!user) return false;
    const { data, error } = await db
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return false;
    return !!data;
  }

  async function routeSession(session) {
    clearStatus();
    if (!session?.user) {
      showOnly(authView);
      return;
    }

    if (currentUser) currentUser.textContent = session.user.email || session.user.id;
    const admin = await isCurrentUserAdmin(session.user);
    if (!admin) {
      showOnly(activationView);
      return;
    }

    showOnly(dashboardView);
    await Promise.all([loadMovies(), loadSettings()]);
  }

  async function login(event) {
    event.preventDefault();
    clearStatus();
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return showStatus(error.message, 'error');
    showStatus('ចូល Admin បានជោគជ័យ។', 'success');
    await routeSession(data.session);
  }

  async function signup(event) {
    event.preventDefault();
    clearStatus();
    const email = $('signupEmail').value.trim();
    const password = $('signupPassword').value;
    if (password.length < 8) return showStatus('Password ត្រូវមានយ៉ាងតិច 8 តួអក្សរ។', 'error');

    const { data, error } = await db.auth.signUp({ email, password });
    if (error) return showStatus(error.message, 'error');

    if (data.session) {
      showStatus('Account ត្រូវបានបង្កើត។ សូមបញ្ចូល Setup Code ដើម្បីបើក Admin។', 'success');
      await routeSession(data.session);
    } else {
      showStatus('Account ត្រូវបានបង្កើត។ សូមបញ្ជាក់ Email រួចត្រឡប់មក Login វិញ។', 'success');
    }
  }

  async function activateAdmin(event) {
    event.preventDefault();
    clearStatus();
    const code = $('setupCode').value.trim();
    if (!code) return showStatus('សូមបញ្ចូល Setup Code។', 'error');

    const { error } = await db.rpc('claim_admin', { p_code: code });
    if (error) return showStatus('Setup Code មិនត្រឹមត្រូវ ឬ Admin បានបង្កើតរួចហើយ។', 'error');

    showStatus('Admin ត្រូវបានបើករួចហើយ។', 'success');
    const session = await getSession();
    await routeSession(session);
  }

  async function logout() {
    await db.auth.signOut();
    showOnly(authView);
    showStatus('បានចាកចេញពី Admin។', 'success');
  }

  async function loadSettings() {
    const { data, error } = await db
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return;
    $('siteName').value = data.site_name || 'DramaVerse';
    $('telegramUrl').value = data.telegram_url || '';
    $('heroBadge').value = data.hero_badge || '';
    $('heroTitle').value = data.hero_title || '';
    $('heroDescription').value = data.hero_description || '';
    $('heroButtonText').value = data.hero_button_text || '';
  }

  async function saveSettings(event) {
    event.preventDefault();
    clearStatus();
    const payload = {
      site_name: $('siteName').value.trim() || 'DramaVerse',
      telegram_url: $('telegramUrl').value.trim(),
      hero_badge: $('heroBadge').value.trim(),
      hero_title: $('heroTitle').value.trim(),
      hero_description: $('heroDescription').value.trim(),
      hero_button_text: $('heroButtonText').value.trim(),
      updated_at: new Date().toISOString()
    };

    const { error } = await db.from('site_settings').update(payload).eq('id', 1);
    if (error) return showStatus(error.message, 'error');
    showStatus('បានរក្សាទុកការកែ Website រួចហើយ។', 'success');
  }

  function resetMovieForm() {
    editingId = null;
    movieForm.reset();
    $('movieRating').value = '4.9';
    $('moviePrice').value = '2,000៛';
    $('movieEpisode').value = 'រឿងពេញ';
    $('movieBadge').value = 'NEW';
    $('movieSort').value = '0';
    $('moviePublished').checked = true;
    setCategories(['new']);
    $('movieFormTitle').textContent = '➕ បន្ថែមរឿងថ្មី';
    $('cancelEdit').hidden = true;
  }

  async function saveMovie(event) {
    event.preventDefault();
    clearStatus();

    const payload = {
      title: $('movieTitle').value.trim(),
      category: categoriesFromForm(),
      badge: $('movieBadge').value,
      price: $('moviePrice').value.trim() || '2,000៛',
      rating: Number($('movieRating').value || 4.9),
      episode: $('movieEpisode').value.trim() || 'រឿងពេញ',
      description: $('movieDescription').value.trim(),
      poster_url: $('moviePoster').value.trim(),
      watch_url: $('movieWatchUrl').value.trim() || '#',
      sort_order: Number($('movieSort').value || 0),
      is_published: $('moviePublished').checked,
      updated_at: new Date().toISOString()
    };

    if (!payload.title) return showStatus('សូមបញ្ចូលចំណងជើងរឿង។', 'error');

    let error;
    if (editingId) {
      ({ error } = await db.from('movies').update(payload).eq('id', editingId));
    } else {
      payload.id = `dv-${Date.now()}`;
      ({ error } = await db.from('movies').insert(payload));
    }

    if (error) return showStatus(error.message, 'error');
    showStatus(editingId ? 'បានកែរឿងរួចហើយ។' : 'បានបន្ថែមរឿងថ្មីរួចហើយ។', 'success');
    resetMovieForm();
    await loadMovies();
  }

  async function loadMovies() {
    const { data, error } = await db
      .from('movies')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      movieList.innerHTML = `<div class="empty">${error.message}</div>`;
      return;
    }

    if (!data?.length) {
      movieList.innerHTML = '<div class="empty">មិនទាន់មានរឿងទេ។</div>';
      return;
    }

    movieList.innerHTML = data.map(movie => `
      <article class="movie-row" data-id="${movie.id}">
        <div class="thumb" ${movie.poster_url ? `style="background-image:url('${String(movie.poster_url).replaceAll("'", '%27')}')"` : ''}></div>
        <div class="movie-row-main">
          <strong>${escapeHtml(movie.title)}</strong>
          <span>${escapeHtml((movie.category || []).join(' • '))} · ${escapeHtml(movie.price || '')} · ★ ${movie.rating}</span>
          <small>${movie.is_published ? '🟢 Published' : '⚪ Hidden'}</small>
        </div>
        <div class="row-actions">
          <button type="button" class="small-btn edit" data-action="edit">កែ</button>
          <button type="button" class="small-btn delete" data-action="delete">លុប</button>
        </div>
      </article>`).join('');

    movieList.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.closest('[data-id]').dataset.id;
      const movie = data.find(item => item.id === id);
      editMovie(movie);
    }));

    movieList.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.closest('[data-id]').dataset.id;
      const movie = data.find(item => item.id === id);
      if (!confirm(`លុបរឿង “${movie?.title || id}” មែនទេ?`)) return;
      const { error: deleteError } = await db.from('movies').delete().eq('id', id);
      if (deleteError) return showStatus(deleteError.message, 'error');
      showStatus('បានលុបរឿងរួចហើយ។', 'success');
      await loadMovies();
    }));
  }

  function editMovie(movie) {
    if (!movie) return;
    editingId = movie.id;
    $('movieTitle').value = movie.title || '';
    $('movieBadge').value = movie.badge || 'NEW';
    $('moviePrice').value = movie.price || '';
    $('movieRating').value = movie.rating ?? 4.9;
    $('movieEpisode').value = movie.episode || '';
    $('movieDescription').value = movie.description || '';
    $('moviePoster').value = movie.poster_url || '';
    $('movieWatchUrl').value = movie.watch_url || '';
    $('movieSort').value = movie.sort_order ?? 0;
    $('moviePublished').checked = !!movie.is_published;
    setCategories(movie.category || []);
    $('movieFormTitle').textContent = '✏️ កែរឿង';
    $('cancelEdit').hidden = false;
    movieForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  $('loginForm')?.addEventListener('submit', login);
  $('signupForm')?.addEventListener('submit', signup);
  $('activationForm')?.addEventListener('submit', activateAdmin);
  $('logoutBtn')?.addEventListener('click', logout);
  settingsForm?.addEventListener('submit', saveSettings);
  movieForm?.addEventListener('submit', saveMovie);
  $('cancelEdit')?.addEventListener('click', resetMovieForm);

  if (!db) {
    showStatus('Supabase មិនទាន់ភ្ជាប់។', 'error');
    return;
  }

  db.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => routeSession(session), 0);
  });

  resetMovieForm();
  getSession().then(routeSession);
})();
