(() => {
  const db = window.dvSupabase;
  const $ = id => document.getElementById(id);
  let orderId = '';
  let token = '';
  let currentOrder = null;
  let timer = null;
  let poller = null;

  const money = n => new Intl.NumberFormat('km-KH').format(Number(n || 0)) + '៛';

  function fail(message) {
    $('errorBox').textContent = message;
    $('errorBox').hidden = false;
    $('checkout').hidden = true;
  }

  function parseHash() {
    const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
    const [id, access] = raw.split(':');
    if (!id || !access) return false;
    orderId = id;
    token = access;
    return true;
  }

  function renderStatus(order) {
    const status = order.status || 'pending';
    $('statusBadge').className = 'status ' + status;
    const labels = {
      pending: '● Pending',
      paid: '✓ Paid',
      expired: '⌛ Expired',
      cancelled: '✕ Cancelled'
    };
    $('statusBadge').textContent = labels[status] || status;
    $('statusText').textContent = labels[status] || status;
    $('refreshBtn').disabled = status === 'paid' || status === 'cancelled';

    if (status === 'paid' && order.watch_url) {
      $('watchBtn').href = order.watch_url;
      $('watchBtn').classList.add('show');
      $('refreshBtn').hidden = true;
    } else {
      $('watchBtn').classList.remove('show');
    }
  }

  function startCountdown(expiresAt) {
    clearInterval(timer);
    const tick = () => {
      if (!expiresAt) return;
      const left = new Date(expiresAt).getTime() - Date.now();
      if (left <= 0) {
        $('countdown').textContent = 'Order បានផុតកំណត់។';
        clearInterval(timer);
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      $('countdown').textContent = `Order នឹងផុតកំណត់ក្នុង ${m}:${String(s).padStart(2,'0')}`;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  async function loadSettings() {
    const { data, error } = await db.from('payment_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) return;
    $('providerName').textContent = data.provider_name || 'DramaVers Pay';
    $('accountLabel').textContent = [data.merchant_name, data.account_label].filter(Boolean).join(' • ');
    $('instructions').textContent = data.instructions || 'សូមបង់តាមចំនួនទឹកប្រាក់ដែលបានបង្ហាញ។';
    const box = $('qrBox');
    if (data.enabled && data.qr_image_url) {
      box.innerHTML = `<img src="${String(data.qr_image_url).replaceAll('"','&quot;')}" alt="Payment QR" />`;
    } else {
      box.innerHTML = '<div class="qr-empty"><b>DramaVers Pay</b><br/>QR ទទួលប្រាក់មិនទាន់បានកំណត់។<br/>Admin អាចបញ្ចូល KHQR/Payment QR នៅក្នុង Admin Panel។</div>';
    }
  }

  async function loadOrder(silent = false) {
    try {
      const { data, error } = await db.rpc('get_checkout_order', {
        p_order_id: orderId,
        p_access_token: token
      });
      if (error) throw error;
      const order = Array.isArray(data) ? data[0] : data;
      if (!order) throw new Error('រកមិនឃើញ Order នេះទេ។');
      currentOrder = order;
      $('checkout').hidden = false;
      $('errorBox').hidden = true;
      $('movieTitle').textContent = order.movie_title || 'DramaVerse';
      $('amount').textContent = money(order.amount_khr);
      $('orderCode').textContent = order.order_code || '—';
      if (order.poster_url) $('poster').style.backgroundImage = `url('${String(order.poster_url).replaceAll("'", "%27")}')`;
      renderStatus(order);
      startCountdown(order.expires_at);
      if (order.status !== 'pending') clearInterval(poller);
    } catch (e) {
      if (!silent) fail(e.message || 'មិនអាចផ្ទុក Order បានទេ។');
    }
  }

  $('copyOrder')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentOrder?.order_code || '');
      $('copyOrder').textContent = 'Copied ✓';
      setTimeout(() => $('copyOrder').textContent = 'Copy', 1200);
    } catch (_) {}
  });

  $('refreshBtn')?.addEventListener('click', () => loadOrder(false));

  if (!db) return fail('Supabase មិនទាន់ភ្ជាប់។');
  if (!parseHash()) return fail('Payment link មិនត្រឹមត្រូវ។');

  Promise.all([loadSettings(), loadOrder(false)]);
  poller = setInterval(() => {
    if (currentOrder?.status === 'pending') loadOrder(true);
  }, 5000);
})();