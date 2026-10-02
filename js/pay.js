import {
  BakongKHQR as BakongKHQRClass,
  khqrData,
  IndividualInfo,
  MerchantInfo
} from 'https://cdn.jsdelivr.net/npm/bakong-khqr@1.0.20/+esm';

(() => {
  const db = window.dvSupabase;
  const $ = id => document.getElementById(id);

  let orderId = '';
  let token = '';
  let currentOrder = null;
  let paySettings = null;
  let timer = null;
  let poller = null;
  let khqrKey = '';

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
      const box = $('qrBox');
      if (box) box.innerHTML = '<div class="qr-empty"><b style="color:#8ff0c6;font-size:20px">✓ Paid</b><br/>ការទូទាត់បានបញ្ជាក់រួចហើយ។</div>';
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
      $('countdown').textContent = `Order នឹងផុតកំណត់ក្នុង ${m}:${String(s).padStart(2, '0')}`;
    };

    tick();
    timer = setInterval(tick, 1000);
  }

  function staticQrFallback(message = '') {
    const box = $('qrBox');
    if (!box) return;

    if (paySettings?.enabled && paySettings?.qr_image_url) {
      box.innerHTML = `<img src="${String(paySettings.qr_image_url).replaceAll('"', '&quot;')}" alt="Payment QR" />`;
      return;
    }

    box.innerHTML = `<div class="qr-empty"><b>DramaVers Pay</b><br/>${message || 'Auto KHQR មិនទាន់បានកំណត់។'}<br/>សូមបញ្ចូល Bakong Account ID នៅ Admin។</div>`;
  }

  async function attachKhqr(md5, qr) {
    try {
      await db.rpc('attach_order_khqr', {
        p_order_id: orderId,
        p_access_token: token,
        p_md5: md5,
        p_payload: qr
      });
    } catch (_) {}
  }

  async function renderAutoKhqr() {
    if (!currentOrder || !paySettings) return;
    if (currentOrder.status !== 'pending') return;
    if (!paySettings.enabled) return staticQrFallback('DramaVers Pay ត្រូវបានបិទ។');

    const accountId = String(paySettings.bakong_account_id || '').trim();
    if (!accountId) return staticQrFallback();

    const key = [currentOrder.order_id, currentOrder.order_code, currentOrder.amount_khr, accountId].join('|');
    if (key === khqrKey) return;

    try {
      const optionalData = {
        currency: khqrData.currency.khr,
        amount: Number(currentOrder.amount_khr || 0),
        billNumber: String(currentOrder.order_code || '').slice(0, 25),
        mobileNumber: String(paySettings.mobile_number || '').trim(),
        storeLabel: String(paySettings.store_label || 'DramaVerse').slice(0, 25),
        terminalLabel: String(paySettings.terminal_label || 'Web').slice(0, 25),
        expirationTimestamp: new Date(currentOrder.expires_at).getTime(),
        merchantCategoryCode: String(paySettings.merchant_category_code || '5999')
      };

      const merchantName = String(paySettings.merchant_name || 'DramaVerse').trim();
      const merchantCity = String(paySettings.merchant_city || 'PHNOM PENH').trim();
      const khqr = new BakongKHQRClass();
      let response;

      if (paySettings.khqr_mode === 'merchant') {
        if (!paySettings.merchant_id || !paySettings.acquiring_bank) {
          throw new Error('Merchant mode ត្រូវការ Merchant ID និង Acquiring Bank/BIC។');
        }

        const merchantInfo = new MerchantInfo(
          accountId,
          merchantName,
          merchantCity,
          paySettings.merchant_id,
          paySettings.acquiring_bank,
          optionalData
        );

        response = khqr.generateMerchant(merchantInfo);
      } else {
        const individualInfo = new IndividualInfo(
          accountId,
          khqrData.currency.khr,
          merchantName,
          merchantCity,
          optionalData
        );

        response = khqr.generateIndividual(individualInfo);
      }

      const qr = response?.data?.qr;
      const md5 = response?.data?.md5;

      if (!qr || !md5) throw new Error('Bakong KHQR SDK មិនអាចបង្កើត QR បាន។');

      const box = $('qrBox');
      box.innerHTML = '<div id="dynamicKhqr" style="background:#fff;padding:10px;border-radius:16px"></div>';

      if (!window.QRCode) throw new Error('QR renderer មិនទាន់ផ្ទុក។');

      new window.QRCode($('dynamicKhqr'), {
        text: qr,
        width: 280,
        height: 280,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });

      khqrKey = key;
      await attachKhqr(md5, qr);
    } catch (error) {
      console.error('Auto KHQR error:', error);
      staticQrFallback(error.message || 'Auto KHQR error');
    }
  }

  async function loadSettings() {
    const { data, error } = await db
      .from('payment_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      paySettings = null;
      return;
    }

    paySettings = data;
    $('providerName').textContent = data.provider_name || 'KHQR';
    $('accountLabel').textContent = [data.merchant_name, data.account_label].filter(Boolean).join(' • ');
    $('instructions').textContent = data.instructions || 'សូមបង់តាមចំនួនទឹកប្រាក់ដែលបានបង្ហាញ។';
  }

  async function checkBakongStatus(silent = true) {
    if (!currentOrder || currentOrder.status !== 'pending') return;

    try {
      const { data, error } = await db.functions.invoke('bakong-order', {
        body: {
          action: 'status',
          orderId,
          accessToken: token
        }
      });

      if (error) throw error;
      if (!data) return;

      if (data.status === 'paid') {
        currentOrder.status = 'paid';
        currentOrder.paid_at = data.paid_at || new Date().toISOString();
        currentOrder.watch_url = data.watch_url || null;
        renderStatus(currentOrder);
        clearInterval(poller);
        return;
      }

      if (data.status === 'expired' || data.status === 'cancelled') {
        currentOrder.status = data.status;
        renderStatus(currentOrder);
        clearInterval(poller);
      }
    } catch (error) {
      if (!silent) {
        alert(error?.message || 'មិនអាចពិនិត្យការទូទាត់បានទេ។');
      }
      console.warn('Bakong status check:', error);
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

      if (order.poster_url) {
        $('poster').style.backgroundImage = `url('${String(order.poster_url).replaceAll("'", "%27")}')`;
      }

      renderStatus(order);
      startCountdown(order.expires_at);

      if (order.status === 'pending') {
        await renderAutoKhqr();
      } else {
        clearInterval(poller);
      }
    } catch (e) {
      if (!silent) fail(e.message || 'មិនអាចផ្ទុក Order បានទេ។');
    }
  }

  $('copyOrder')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentOrder?.order_code || '');
      $('copyOrder').textContent = 'Copied ✓';
      setTimeout(() => ($('copyOrder').textContent = 'Copy'), 1200);
    } catch (_) {}
  });

  $('refreshBtn')?.addEventListener('click', () => checkBakongStatus(false));

  if (!db) return fail('Supabase មិនទាន់ភ្ជាប់។');
  if (!parseHash()) return fail('Payment link មិនត្រឹមត្រូវ។');

  Promise.all([loadSettings(), loadOrder(false)]).then(renderAutoKhqr);

  poller = setInterval(() => {
    if (currentOrder?.status === 'pending') checkBakongStatus(true);
  }, 5000);
})();