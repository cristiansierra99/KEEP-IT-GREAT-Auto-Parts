const Admin = (() => {
  const API = window.KG_CONFIG?.apiBase || "http://localhost:61169";
  const $ = id => document.getElementById(id);
  const fmt = n => 'RD$ ' + Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 });

  let products = [];
  let filteredProducts = [];
  let editIndex = -1;
  let orders = [];

  // =============== LOGIN ===============
  async function login() {
    const pass = $('pass')?.value || '';
    if (pass !== 'admin123') {
      alert('Contraseña incorrecta');
      return;
    }
    $('auth').style.display = 'none';
    $('panel').style.display = 'grid';
    await load();
    await loadOrders();
    initBulkUpload();
  }

  // =============== TABS ===============
  function showTab(tab) {
    const tabs = ['products', 'orders', 'reports'];
    const titles = {
      products: '📦 Productos',
      orders: '🛒 Órdenes',
      reports: '📊 Reportes'
    };
    const subtitles = {
      products: 'Gestiona tu inventario',
      orders: 'Revisa y confirma pedidos',
      reports: 'Análisis de ventas'
    };

    tabs.forEach(t => {
      const sec = $(`section-${t}`);
      const btn = $(`tab-${t}`);
      if (sec) sec.style.display = (t === tab) ? 'block' : 'none';
      if (btn) {
        if (t === tab) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    const pageTitle = $('page-title');
    const pageSubtitle = document.querySelector('.page-subtitle');
    if (pageTitle) pageTitle.textContent = titles[tab] || '';
    if (pageSubtitle) pageSubtitle.textContent = subtitles[tab] || '';

    if (tab === 'orders') {
      loadOrders();
    }
  }

  // =============== PRODUCTOS ===============
  async function load() {
    try {
      const r = await fetch(`${API}/api/products/all`);
      if (!r.ok) {
        console.error('Error cargando productos', r.status, await r.text());
        alert('No se pudieron cargar los productos');
        return;
      }
      products = await r.json();
      filteredProducts = [...products];
      render();
    } catch (err) {
      console.error('Error de conexión:', err);
      alert('Error de conexión al cargar productos');
    }
  }

  function filterProducts() {
    const search = ($('product-search')?.value || '').toLowerCase();
    if (!search) {
      filteredProducts = [...products];
    } else {
      filteredProducts = products.filter(p => {
        const searchText = [p.id, p.name, p.brand, p.category, p.description].join(' ').toLowerCase();
        return searchText.includes(search);
      });
    }
    render();
  }

  function render() {
    const t = $('table');
    if (!t) return;

    if (filteredProducts.length === 0) {
      t.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:60px 20px;color:#9ca3af;">📦 No hay productos para mostrar</td></tr>';
      return;
    }

    t.innerHTML = `
      <thead>
        <tr>
          <th>Imagen</th>
          <th>ID</th>
          <th>Nombre</th>
          <th>Marca</th>
          <th>Categoría</th>
          <th>Precio</th>
          <th>Costo</th>
          <th>Margen/u</th>
          <th>Margen %</th>
          <th>Stock</th>
          <th>Activo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${filteredProducts.map((p, idx) => {
          const margenU = (p.price || 0) - (p.cost || 0);
          const mp = p.price > 0 ? (((p.price - (p.cost || 0)) / p.price) * 100).toFixed(1) + '%' : '0%';
          
          let imgSrc = 'https://placehold.co/50x50?text=?';
          if (p.image_Url) {
            imgSrc = p.image_Url.startsWith('http') ? p.image_Url : `${API}${p.image_Url}`;
          }

          return `
            <tr>
              <td><img src="${imgSrc}" alt="${p.name}" onerror="this.src='https://placehold.co/50x50?text=?'"></td>
              <td><strong>${p.id}</strong></td>
              <td>${p.name || ''}</td>
              <td>${p.brand || '-'}</td>
              <td>${p.category || '-'}</td>
              <td><strong style="color:var(--primary)">${fmt(p.price)}</strong></td>
              <td>${fmt(p.cost)}</td>
              <td>${fmt(margenU)}</td>
              <td>${mp}</td>
              <td><strong>${p.stock || 0}</strong></td>
              <td><span class="badge ${p.active ? 'badge-success' : 'badge-danger'}">${p.active ? 'Sí' : 'No'}</span></td>
              <td class="actions">
                <button class="btn btn-small" onclick="Admin.edit(${idx})" title="Editar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn btn-small btn-danger" onclick="Admin.remove('${p.id}')" title="Eliminar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  }

  // =============== CARGA MASIVA ===============
  function initBulkUpload() {
    const form = $('bulkForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = $('bulkFile');
      if (!fileInput || !fileInput.files.length) {
        alert('Selecciona un archivo CSV');
        return;
      }

      const file = fileInput.files[0];
      const fd = new FormData();
      fd.append('file', file);

      try {
        const r = await fetch(`${API}/api/products/bulk`, {
          method: 'POST',
          body: fd
        });

        const txt = await r.text();
        if (!r.ok) {
          console.error('Error /api/products/bulk', r.status, txt);
          alert(`Error cargando productos (${r.status}): ${txt}`);
          return;
        }

        let data = {};
        try { data = txt ? JSON.parse(txt) : {}; } catch { }

        alert(`✅ Productos cargados correctamente. Procesados: ${data.count ?? 'N/D'}`);
        fileInput.value = '';
        await load();
      } catch (err) {
        console.error('Error de conexión:', err);
        alert('Error de conexión al subir productos');
      }
    });
  }

  // =============== FORMULARIO ===============
  function openForm() {
    editIndex = -1;
    ['f_id', 'f_name', 'f_brand', 'f_category', 'f_price', 'f_cost', 'f_stock', 'f_image', 'f_desc'].forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });
    const chk = $('f_active');
    if (chk) chk.checked = true;
    const pv = $('f_preview');
    if (pv) {
      pv.src = '';
      pv.style.display = 'none';
    }
    const fileInput = $('f_image_file');
    if (fileInput) fileInput.value = '';
    
    $('formBox').style.display = 'flex';
    setTimeout(() => $('f_id')?.focus(), 100);
  }

  function edit(i) {
    const p = filteredProducts[i];
    const originalIndex = products.findIndex(prod => prod.id === p.id);
    editIndex = originalIndex;

    $('f_id').value = p.id;
    $('f_name').value = p.name || '';
    $('f_brand').value = p.brand || '';
    $('f_category').value = p.category || '';
    $('f_price').value = p.price || 0;
    $('f_cost').value = p.cost || 0;
    $('f_stock').value = p.stock || 0;
    $('f_image').value = p.image_Url || '';
    $('f_desc').value = p.description || '';
    
    const chk = $('f_active');
    if (chk) chk.checked = !!p.active;

    const pv = $('f_preview');
    if (p.image_Url) {
      const imgSrc = p.image_Url.startsWith('http') ? p.image_Url : `${API}${p.image_Url}`;
      pv.src = imgSrc;
      pv.style.display = 'block';
    } else {
      pv.src = '';
      pv.style.display = 'none';
    }

    $('formBox').style.display = 'flex';
  }

  function previewImage(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const pv = $('f_preview');
      pv.src = reader.result;
      pv.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      const r = await fetch(`${API}/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) {
        alert('Error eliminando producto');
        return;
      }
      alert('✅ Producto eliminado');
      await load();
    } catch (err) {
      console.error('Error:', err);
      alert('Error de conexión');
    }
  }

  async function save() {
    const fileEl = $('f_image_file');
    const file = fileEl && fileEl.files ? fileEl.files[0] : null;
    let imageUrl = $('f_image').value || '';

    if (file) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const up = await fetch(`${API}/api/upload`, {
          method: 'POST',
          body: fd
        });

        if (up.ok) {
          const js = await up.json();
          imageUrl = js.url.startsWith('http') ? js.url : `${API}${js.url}`;
        } else {
          console.error('Error subiendo imagen', up.status, await up.text());
          alert('⚠️ No se pudo subir la imagen, pero el producto se guardará sin imagen.');
        }
      } catch (err) {
        console.error('Error de conexión:', err);
        alert('⚠️ No se pudo subir la imagen. El producto se guardará sin imagen.');
      }
    }

    const payload = {
      id: $('f_id').value.trim(),
      name: $('f_name').value.trim(),
      brand: $('f_brand').value.trim(),
      category: $('f_category').value.trim(),
      price: parseFloat($('f_price').value || '0'),
      cost: parseFloat($('f_cost').value || '0'),
      stock: parseInt($('f_stock').value || '0', 10),
      image_Url: imageUrl,
      description: $('f_desc').value || '',
      active: $('f_active') ? $('f_active').checked : true
    };

    if (!payload.id || !payload.name) {
      alert('⚠️ ID y Nombre son requeridos');
      return;
    }

    try {
      let resp;
      if (editIndex > -1) {
        resp = await fetch(`${API}/api/products/${encodeURIComponent(payload.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        resp = await fetch(`${API}/api/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!resp.ok) {
        const t = await resp.text();
        console.error('Error guardando producto', resp.status, t);
        alert('❌ Error guardando el producto: ' + t);
        return;
      }

      alert('✅ Producto guardado exitosamente');
      $('formBox').style.display = 'none';
      await load();
    } catch (err) {
      console.error('Error:', err);
      alert('❌ Error de conexión al guardar');
    }
  }

  // =============== ÓRDENES ===============
  async function loadOrders() {
    try {
      const r = await fetch(`${API}/api/orders`);
      if (!r.ok) {
        console.error('Error cargando órdenes', r.status, await r.text());
        alert('No se pudieron cargar las órdenes');
        return;
      }

      const data = await r.json();
      orders = data.map(o => ({
        id: o.id || o.Id,
        orderNumber: o.orderNumber || o.OrderNumber || '',
        customer_Name: o.customer_Name || o.Customer_Name,
        phone: o.phone || o.Phone,
        total: o.total ?? o.Total ?? 0,
        status: o.status || o.Status || 'PENDIENTE',
        created_At: o.created_At || o.Created_At,
        itemsCount: o.itemsCount ?? o.ItemsCount ?? 0
      }));

      renderOrders();
    } catch (err) {
      console.error('Error:', err);
      alert('Error de conexión al cargar órdenes');
    }
  }

  function renderOrders() {
    const t = $('ordersTable');
    if (!t) return;

    if (orders.length === 0) {
      t.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:60px 20px;color:#9ca3af;">🛒 No hay órdenes registradas</td></tr>';
      return;
    }

    t.innerHTML = `
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Teléfono</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Items</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => {
          const date = o.created_At ? new Date(o.created_At) : null;
          const d = date ? date.toLocaleString('es-DO') : '-';
          let badgeClass = o.status === 'CONFIRMADA' ? 'badge-success' : 
                          o.status === 'CANCELADA' ? 'badge-danger' : 'badge-warning';

          return `
            <tr>
              <td><strong>#${o.orderNumber || o.id}</strong></td>
              <td>${d}</td>
              <td>${o.customer_Name || '-'}</td>
              <td>${o.phone || '-'}</td>
              <td><strong style="color:var(--primary)">${fmt(o.total)}</strong></td>
              <td><span class="badge ${badgeClass}">${o.status}</span></td>
              <td>${o.itemsCount || 0}</td>
              <td class="actions">
                <button class="btn btn-small" onclick="Admin.showOrderDetail('${o.id}')" title="Ver detalles">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
                <button class="btn btn-small btn-primary" onclick="Admin.confirmOrder('${o.id}', '${o.orderNumber || ''}')" 
                        ${o.status === 'CONFIRMADA' ? 'disabled' : ''} title="Confirmar">
                  ✓
                </button>
                <button class="btn btn-small btn-danger" onclick="Admin.cancelOrder('${o.id}', '${o.orderNumber || ''}')" 
                        ${o.status !== 'PENDIENTE' ? 'disabled' : ''} title="Cancelar">
                  ✕
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  }

  async function showOrderDetail(id) {
    const ord = orders.find(o => o.id === id);
    if (!ord) return;

    const box = $('orderDetail');
    const content = $('orderDetailContent');

    content.innerHTML = `
      <div class="modal-header">
        <h3>📋 Orden #${ord.orderNumber || ord.id}</h3>
        <button class="btn-close" onclick="document.getElementById('orderDetail').style.display='none'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p><strong>Cliente:</strong> ${ord.customer_Name || '-'}</p>
        <p><strong>Teléfono:</strong> ${ord.phone || '-'}</p>
        <p><strong>Total:</strong> <span style="color:var(--primary);font-weight:700">${fmt(ord.total)}</span></p>
        <p><strong>Estado:</strong> <span class="badge ${ord.status === 'CONFIRMADA' ? 'badge-success' : ord.status === 'CANCELADA' ? 'badge-danger' : 'badge-warning'}">${ord.status}</span></p>
        <p><strong>Items:</strong> ${ord.itemsCount || 0} productos</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('orderDetail').style.display='none'">Cerrar</button>
      </div>
    `;
    box.style.display = 'flex';
  }

  async function confirmOrder(id, orderNumber) {
    if (!confirm(`¿Confirmar la orden #${orderNumber || id}? Esto rebajará el inventario.`)) return;

    try {
      const r = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/confirm`, {
        method: 'POST'
      });

      const txt = await r.text();
      if (!r.ok) {
        console.error('Error confirmando orden', r.status, txt);
        alert(`❌ Error confirmando (${r.status}): ${txt}`);
        return;
      }

      alert(`✅ Orden #${orderNumber || id} confirmada`);
      await loadOrders();
      await load();
    } catch (err) {
      console.error('Error:', err);
      alert('❌ Error de conexión');
    }
  }

  async function cancelOrder(id, orderNumber) {
    if (!confirm(`¿Cancelar la orden #${orderNumber || id}?`)) return;

    try {
      const r = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/cancel`, {
        method: 'POST'
      });

      const txt = await r.text();
      if (!r.ok) {
        alert(`❌ Error cancelando (${r.status}): ${txt}`);
        return;
      }

      alert(`✅ Orden #${orderNumber || id} cancelada`);
      await loadOrders();
    } catch (err) {
      console.error('Error:', err);
      alert('❌ Error de conexión');
    }
  }

  // =============== REPORTES ===============
  async function showReports() {
    const from = $('fromDate')?.value;
    const to = $('toDate')?.value;
    
    if (!from || !to) {
      alert('⚠️ Selecciona ambas fechas');
      return;
    }

    const url = new URL(`${API}/api/reports/sales`);
    url.searchParams.set('from', from + 'T00:00:00');
    url.searchParams.set('to', to + 'T23:59:59');

    try {
      const r = await fetch(url);
      if (!r.ok) {
        alert('Error cargando reporte');
        return;
      }
      const js = await r.json();

      let html = `
        <div style="background:rgba(255,186,8,0.1);padding:20px;border-radius:12px;margin-bottom:20px;">
          <h3 style="color:var(--primary);margin-bottom:12px;">📊 Resumen de Ventas</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
            <div>
              <p style="color:var(--muted);font-size:12px;">Ingresos</p>
              <p style="font-size:24px;font-weight:700;color:var(--primary)">${fmt(js.ingresos)}</p>
            </div>
            <div>
              <p style="color:var(--muted);font-size:12px;">Ganancia</p>
              <p style="font-size:24px;font-weight:700;color:#10b981">${fmt(js.ganancia)}</p>
            </div>
            <div>
              <p style="color:var(--muted);font-size:12px;">Unidades Vendidas</p>
              <p style="font-size:24px;font-weight:700">${js.unidades}</p>
            </div>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Unidades</th>
              <th>Ingresos</th>
              <th>Ganancia</th>
              <th>Margen %</th>
            </tr>
          </thead>
          <tbody>
            ${(js.top || []).map(rp => {
              const pct = rp.venta > 0 ? ((rp.ganancia / rp.venta) * 100).toFixed(1) + '%' : '0%';
              return `
                <tr>
                  <td><strong>${rp.name}</strong> <span style="color:var(--muted)">(${rp.id})</span></td>
                  <td>${rp.qty}</td>
                  <td style="color:var(--primary);font-weight:600">${fmt(rp.venta)}</td>
                  <td style="color:#10b981;font-weight:600">${fmt(rp.ganancia)}</td>
                  <td>${pct}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      $('reportsBox').innerHTML = html;
    } catch (err) {
      console.error('Error:', err);
      alert('❌ Error de conexión al cargar reporte');
    }
  }

  return {
    login,
    showTab,
    load,
    filterProducts,
    openForm,
    edit,
    save,
    remove,
    previewImage,
    loadOrders,
    showOrderDetail,
    confirmOrder,
    cancelOrder,
    showReports,
    initBulkUpload
  };
})();

// Auto-login en desarrollo (comentar en producción)
// window.addEventListener('DOMContentLoaded', () => {
//   document.getElementById('pass').value = 'admin123';
//   Admin.login();
// });