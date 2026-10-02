(() => {
  const db = window.dvSupabase;
  const $ = id => document.getElementById(id);

  let orderId = '';
  let token = '';
  let currentOrder = null;
  let timer = null;
  let poller = null;
  let pollCount = 0;
  let redirecting = false;

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
    $('refreshBtn').disabled = status === 'paid' || status === 'cancelled' || status === 'expired';

    if (status === 'paid' && order.watch_url) {
      $('watchBtn').href = order.watch_url;
      $('watchBtn').classList.add('show');
      $('refreshBtn').hidden = true;
      autoOpenTelegram(order.watch_url);
    } else {
      $('watchBtn').classList.remove('show');
    }
  }

  async function renderQr(payload) {
    const box = $('qrBox');
    if (!payload) {
      box.innerHTML = '<div class="qr-empty"><b>KHQR មិនមានទេ</b><br/>សូមត្រឡប់ទៅជ្រើសរឿងម្តងទៀត។</div>';
      return;
    }

    if (!window.QRCode?.toDataURL) {
      box.innerHTML = '<div class="qr-empty">មិនអាចបង្កើត QR នៅលើ Browser បានទេ។</div>';
      return;
    }

    try {
      const dataUrl = await window.QRCode.toDataURL(payload, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'M'
      });
      box.innerHTML = `<img src="${dataUrl}" alt="Bakong KHQR" />`;
    } catch (error) {
      console.error(error);
      box.innerHTML = '<div class="qr-empty">បង្កើត KHQR មិនបាន។ សូម Refresh ម្តងទៀត។</div>';
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
        clearInterval(poller);
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      $('countdown').textContent = `Order នឹងផុតកំណត់ក្នុង ${m}:${String(s).padStart(2, '0')}`;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  async function loadSettings() {
    const { data, error } = await db
      .from('payment_settings')
      .select('provider_name,merchant_name,account_label,instructions,enabled')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return;

    $('providerName').textContent = data.provider_name || 'Bakong KHQR';
    $('accountLabel').textContent = [data.merchant_name, data.account_label].filter(Boolean).join(' • ');
    $('instructions').textContent = data.instructions || 'សូមស្កេន KHQR ហើយបង់តាមចំនួនទឹកប្រាក់ដែលបានបង្ហាញ។';
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

      if (order.poster_url) {
        $('poster').style.backgroundImage = `url('${String(order.poster_url).replaceAll("'", "%27")}')`;
      }

      await renderQr(order.khqr_payload);
      renderStatus(order);
      startCountdown(order.expires_at);

      if (order.status !== 'pending') clearInterval(poller);
    } catch (error) {
      if (!silent) fail(error.message || 'មិនអាចផ្ទុក Order បានទេ។');
    }
  }

  function autoOpenTelegram(url) {
    if (!url || redirecting) return;
    redirecting = true;
    $('statusText').textContent = 'Paid ✓ — កំពុងបើក Telegram...';
    setTimeout(() => {
      location.href = url;
    }, 900);
  }

  async function checkBakong(silent = false) {
    if (!currentOrder || currentOrder.status !== 'pending') return;

    if (!silent) {
      $('refreshBtn').disabled = true;
      $('refreshBtn').textContent = 'កំពុងពិនិត្យ Bakong...';
    }

    try {
      const { data, error } = await db.functions.invoke('bakong-order', {
        body: {
          action: 'status',
          orderId,
          accessToken: token
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.status === 'paid') {
        currentOrder.status = 'paid';
        currentOrder.paid_at = data.paid_at || new Date().toISOString();
        currentOrder.watch_url = data.watch_url || null;
        renderStatus(currentOrder);
        clearInterval(poller);

        if (!data.watch_url) {
          $('statusText').textContent = 'Paid ✓ — Telegram Link មិនទាន់បានកំណត់។';
        }
        return;
      }

      if (data?.status === 'expired' || data?.status === 'cancelled') {
        currentOrder.status = data.status;
        renderStatus(currentOrder);
        clearInterval(poller);
        return;
      }

      currentOrder.status = 'pending';
      renderStatus(currentOrder);
    } catch (error) {
      console.warn('Bakong status check:', error);
      if (!silent) alert(error.message || 'ពិនិត្យ Bakong មិនបាន។');
    } finally {
      if (!silent && currentOrder?.status === 'pending') {
        $('refreshBtn').disabled = false;
        $('refreshBtn').textContent = '🔄 ពិនិត្យការទូទាត់';
      }
    }
  }

  function startAutoCheck() {
    clearInterval(poller);
    pollCount = 0;

    poller = setInterval(async () => {
      if (!currentOrder || currentOrder.status !== 'pending') {
        clearInterval(poller);
        return;
      }

      pollCount += 1;
      await checkBakong(true);

      // Avoid burning through Bakong API request limits.
      // After six automatic checks the customer can still use the manual check button.
      if (pollCount >= 6) {
        clearInterval(poller);
      }
    }, 10000);
  }

  $('copyOrder')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentOrder?.order_code || '');
      $('copyOrder').textContent = 'Copied ✓';
      setTimeout(() => $('copyOrder').textContent = 'Copy', 1200);
    } catch (_) {}
  });

  $('refreshBtn')?.addEventListener('click', () => checkBakong(false));

  if (!db) return fail('Supabase មិនទាន់ភ្ជាប់។');
  if (!parseHash()) return fail('Payment link មិនត្រឹមត្រូវ។');

  Promise.all([loadSettings(), loadOrder(false)]).then(() => {
    if (currentOrder?.status === 'pending') startAutoCheck();
  });
})();