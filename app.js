const Shop = (() => {
  const API = window.KG_CONFIG.apiBase;
  const WHATSAPP = window.KG_CONFIG?.whatsappNumber || "";
  const $ = id => document.getElementById(id);
  const fmt = n => 'RD$ ' + Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 });

  const state = {
    products: [],
    cart: JSON.parse(localStorage.getItem('kg_cart') || '[]'),
    categoryActive: 'all',
    priceRange: { min: null, max: null }
  };

  // ================== CARGA INICIAL ==================
async function load() {
  try {
    const r = await fetch(`${API}/api/products`);
    if (!r.ok) {
      console.error('Error cargando productos:', r.status, await r.text());
      alert('No se pudo cargar la lista de productos.');
      return;
    }

    state.products = await r.json();
    buildCats();       // categorías
    render();          // pinta productos
    updateCartCount(); // carrito
    const y = $('year'); 
    if (y) y.textContent = new Date().getFullYear();
  } catch (err) {
    console.error('Error de conexión al cargar productos:', err);
    alert('No se pudo conectar con el servidor de productos.');
  }
}

// ================== AUTO-REFRESH DE PRODUCTOS ==================
async function refreshProductsIfChanged() {
  try {
    const r = await fetch(`${API}/api/products`);
    if (!r.ok) return;

    const newList = await r.json();

    // Comparación sencilla (para tu catálogo está bien)
    const changed = JSON.stringify(newList) !== JSON.stringify(state.products);
    if (changed) {
      console.log('Productos cambiaron, actualizando vista...');
      state.products = newList;
      buildCats();   // por si hay nuevas categorías o productos
      render();      // vuelve a pintar la lista de productos
    }
  } catch (e) {
    console.error('Error refrescando productos', e);
  }
}

// refrescar cada 30 segundos (puedes bajar a 10–15 si quieres algo más “en vivo”)
setInterval(refreshProductsIfChanged, 10000);


// refrescar cada 30 segundos (ajusta a lo que quieras)
setInterval(refreshProductsIfChanged, 30000);

  function buildCats() {
    const set = new Set(state.products.map(p => p.category).filter(Boolean));
    const cats = ['all', ...set];
    const box = $('cats'); if (!box) return;
    box.innerHTML = '';
    cats.forEach(c => {
      const div = document.createElement('div');
      div.className = 'category' + (state.categoryActive === c ? ' active' : '');
      div.textContent = c === 'all' ? 'Todos' : c;
      div.onclick = () => { state.categoryActive = c; render(); };
      box.appendChild(div);
    });
  }

  // ================== LISTA DE PRODUCTOS ==================
  function render() {
    const q = ($('q')?.value || '').toLowerCase();
    let list = state.products.filter(p =>
      !q || [p.name, p.brand, p.id, p.description, (p.category || '')].join(' ').toLowerCase().includes(q)
    );
    if (state.categoryActive !== 'all') list = list.filter(p => p.category === state.categoryActive);
    if (state.priceRange.min != null) list = list.filter(p => (p.price || 0) >= state.priceRange.min);
    if (state.priceRange.max != null) list = list.filter(p => (p.price || 0) <= state.priceRange.max);

    const box = $('products'); if (!box) return;
    box.innerHTML = '';

    list.forEach(p => {
      const oos = (p.stock || 0) <= 0;

      // Resolver URL de imagen
      let imgSrc = 'https://placehold.co/600x400?text=Producto';
      if (p.image_Url) {
        if (p.image_Url.startsWith('http')) imgSrc = p.image_Url;
        else imgSrc = `${API}${p.image_Url}`;
      }

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${imgSrc}" alt="${p.name}">
        <div class="body">
          <div class="brand-line">
            <span>${p.brand || ''}</span>
            <span class="muted">${p.id || ''}</span>
          </div>
          <strong>${p.name}</strong>
          <div class="tags">${oos ? '<span class="badge-oos">Agotado</span>' : ''}</div>
          <div class="stock-left">${oos ? '' : 'Stock: ' + p.stock}</div>
          <strong>${p.description}</strong>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <div class="price">${fmt(p.price)}</div>
            <button class="btn btn-primary" ${oos ? 'disabled' : ''} onclick='Shop.addToCart("${p.id}")'>
              ${oos ? 'Agotado' : 'Agregar'}
            </button>
          </div>
        </div>`;
      box.appendChild(card);
    });
  }

  function applyPrice() {
    const min = parseFloat($('minPrice').value || '');
    const max = parseFloat($('maxPrice').value || '');
    state.priceRange.min = isNaN(min) ? null : min;
    state.priceRange.max = isNaN(max) ? null : max;
    render();
  }

  // ================== CARRITO ==================
  function updateCartCount() {
    const c = state.cart.reduce((s, x) => s + x.qty, 0);
    ['cart-count', 'cart-count-2'].forEach(id => {
      const el = $(id); if (el) el.textContent = c;
    });
  }

  function syncCart() {
    localStorage.setItem('kg_cart', JSON.stringify(state.cart));
    updateCartCount();
    renderCart();
  }

  function addToCart(id) {
    const p = state.products.find(x => x.id === id); if (!p) return;
    if ((p.stock || 0) <= 0) { alert('Agotado'); return; }
    const it = state.cart.find(x => x.id === id);
    if (it) {
      if (it.qty + 1 > p.stock) { alert('No hay suficiente stock'); return; }
      it.qty++;
    } else {
      state.cart.push({
        id: p.id,
        name: p.name,
        price: p.price,
        qty: 1,
        image: p.image_Url
      });
    }
    syncCart();
    openCart();
  }

  function incQty(id) {
    const p = state.products.find(x => x.id === id);
    const it = state.cart.find(x => x.id === id);
    if (!p || !it) return;
    if (it.qty >= p.stock) { alert('No hay más stock'); return; }
    it.qty++;
    syncCart();
  }

  function decQty(id) {
    const it = state.cart.find(x => x.id === id);
    if (!it) return;
    it.qty--;
    if (it.qty <= 0) state.cart = state.cart.filter(x => x.id !== id);
    syncCart();
  }

  function removeItem(id) {
    state.cart = state.cart.filter(x => x.id !== id);
    syncCart();
  }

  function openCart() {
    $('cart-backdrop').style.display = 'block';
    $('cart-drawer').style.display = 'flex';
    $('cart').style.display = '';
    renderCart();
  }

  function closeCart() {
    $('cart-backdrop').style.display = 'none';
    $('cart-drawer').style.display = 'none';
  }

  function renderCart() {
    const box = $('cart-items'); if (!box) return;
    box.innerHTML = '';
    if (state.cart.length === 0) {
      box.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
      $('cart-total').textContent = fmt(0);
      return;
    }
    let total = 0;
    state.cart.forEach(it => {
      const p = state.products.find(x => x.id === it.id);
      const max = p ? (p.stock || 0) : it.qty;
      const line = (it.price || 0) * (it.qty || 0);
      total += line;
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <img src="${it.image || 'https://placehold.co/100'}" alt="${it.name}">
        <div style="flex:1">
          <div><strong>${it.name}</strong></div>
          <div class="muted">Disponible: ${max}</div>
          <div class="qty" style="margin-top:6px">
            <button class="btn" onclick='Shop.decQty("${it.id}")'>-</button>
            <span>${it.qty}</span>
            <button class="btn" ${it.qty>=max?'disabled':''} onclick='Shop.incQty("${it.id}")'>+</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div>${fmt(line)}</div>
          <button class="btn" onclick='Shop.removeItem("${it.id}")'>Eliminar</button>
        </div>`;
      box.appendChild(div);
    });
    $('cart-total').textContent = fmt(total);
  }

  // ================== CHECKOUT + WHATSAPP ==================
  function showCheckout() {
    const subtotal = state.cart.reduce((s, x) => s + x.price * x.qty, 0);
    const itbis = subtotal * 0.18;
    const envio = subtotal >= 5000 ? 0 : 250;
    const total = subtotal + itbis + envio;
    const box = $('checkout-form');
    box.style.display = 'block';
    box.innerHTML = `
      <h3>Datos de pago y envío</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input id="c_name" placeholder="Nombre y Apellido">
        <input id="c_phone" placeholder="Teléfono">
        <input id="c_address" placeholder="Dirección" style="grid-column:span 2">
        <select id="c_method">
          <option value="contraentrega">Contraentrega</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Subtotal</span><span>${fmt(subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">ITBIS 18%</span><span>${fmt(itbis)}</span></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Envío</span><span>${fmt(envio)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:800;margin-top:4px"><span>Total</span><span>${fmt(total)}</span></div>
      <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="Shop.confirmCheckout()">Confirmar compra</button>
    `;
  }

 async function confirmCheckout() {
  const name = ($('c_name')?.value || '').trim();
  const phone = ($('c_phone')?.value || '').trim();
  const address = $('c_address')?.value || '';
  const method = $('c_method')?.value || 'contraentrega';

  if (!name || !phone) {
    alert('Completa nombre y teléfono');
    return;
  }

  const subtotal = state.cart.reduce((s, x) => s + x.price * x.qty, 0);
  const itbis = subtotal * 0.18;
  const envio = subtotal >= 5000 ? 0 : 250;
  const total = subtotal + itbis + envio;

  const body = {
    customer_Name: name,
    phone,
    address,
    method,
    subtotal,
    itbis,
    envio,
    total,
    items: state.cart.map(x => ({
      productId: x.id,  
      name: x.name,
      price: x.price,
      qty: x.qty
    }))
  };

  // 1) Registrar en API
  let orderNumber = '';
  let orderId = '';
  try {
    const r = await fetch(`${API}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.ok) {
      const data = await r.json().catch(() => null);
      
     orderId = data?.number || '';
    } else {
      console.error('Error /api/checkout:', r.status, await r.text());
    }
  } catch (err) {
    console.error('Error llamando /api/checkout', err);
  }

  // 2) Mensaje de WhatsApp
  const itemsLines = state.cart.map((x, i) => {
    const line = x.price * x.qty;
    return `${i + 1}. ${x.name} (ID: ${x.id}) x${x.qty} @ ${fmt(x.price)} = ${fmt(line)}`;
  }).join('\n');

  const msg =
`Nuevo pedido KEEP IT GREAT AUTO PARTS
 Nemero Pedido: ${orderId}
 Cliente: ${name}
 Teléfono: ${phone}
 Dirección: ${address || 'N/D'}
 Método de pago: ${method}

Artículos:
${itemsLines}

Subtotal: ${fmt(subtotal)}
ITBIS (18%): ${fmt(itbis)}
Envío: ${fmt(envio)}
TOTAL: ${fmt(total)}`;

 if (WHATSAPP) {
  const waPhone = WHATSAPP.replace(/\D/g, ''); // quita +, espacios, etc.

  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  console.log('WA URL:', waUrl);

  // En lugar de window.open
  window.location.href = waUrl;
} else {
  alert('No se ha configurado el número de WhatsApp.');
}

  // 3) Limpiar carrito y refrescar stock
  state.cart = [];
  localStorage.setItem('kg_cart', '[]');
  updateCartCount();
  closeCart();

  try {
    const rr = await fetch(`${API}/api/products`);
    if (rr.ok) {
      state.products = await rr.json();
      render();
    }
  } catch (e) {
    console.error('Error recargando productos:', e);
  }
}

  // Exponer funciones públicas
  return {
    load,
    render,
    applyPrice,
    addToCart,
    incQty,
    decQty,
    removeItem,
    openCart,
    closeCart,
    showCheckout,
    confirmCheckout
  };
})();

window.addEventListener('DOMContentLoaded', Shop.load);
