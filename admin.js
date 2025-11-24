const Admin = (() => {
  const API = window.KG_CONFIG.apiBase;
  const $ = id => document.getElementById(id);
  const fmt = n => 'RD$ ' + Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 });

  let products = [];
  let editIndex = -1;
  let orders = [];

  // =============== TABS ===============
  function showTab(tab) {
    const tabs = ['products', 'orders', 'reports'];
    tabs.forEach(t => {
      const sec = $(`section-${t}`);
      const btn = $(`tab-${t}`);
      if (sec) sec.style.display = (t === tab) ? 'block' : 'none';
      if (btn) btn.classList.toggle('active', t === tab);
    });

    if (tab === 'orders') {
      loadOrders();
    }
  }

  // =============== LOGIN ===============
  async function login() {
    const pass = $('pass')?.value || '';
    if (pass !== 'admin123') {
      alert('Contraseña incorrecta');
      return;
    }
    $('auth').style.display = 'none';
    $('panel').style.display = 'block';
    await load();        // carga productos
    await loadOrders();  // precarga órdenes
    initBulkUpload();
  }

  // =============== PRODUCTOS ===============
  async function load() {
    const r = await fetch(`${API}/api/products/all`);
    if (!r.ok) {
      console.error('Error cargando productos', r.status, await r.text());
      alert('No se pudieron cargar los productos');
      return;
    }
    products = await r.json();
    render();
  }

  function tableHead() {
    const t = $('table');
    t.innerHTML = `<tr>
      <th>ID</th><th>Nombre</th><th>Marca</th><th>Categoría</th>
      <th>Precio</th><th>Costo</th><th>Margen/u</th><th>Margen %</th>
      <th>Stock</th><th>Imagen</th><th>Activo</th><th>Acciones</th></tr>`;
  }

  function render() {
    tableHead();
    const t = $('table');
    t.innerHTML += products.map((p, idx) => {
      const margenU = (p.price || 0) - (p.cost || 0);
      const mp = p.price > 0 ? (((p.price - (p.cost || 0)) / p.price) * 100).toFixed(1) + '%' : '0%';
      return `<tr>
        <td>${p.id}</td>
        <td>${p.name || ''}</td>
        <td>${p.brand || ''}</td>
        <td>${p.category || ''}</td>
        <td>${fmt(p.price)}</td>
        <td>${fmt(p.cost)}</td>
        <td>${fmt(margenU)}</td>
        <td>${mp}</td>
        <td>${p.stock || 0}</td>
        <td>${p.image_Url ? `<a target="_blank" href="${p.image_Url}">ver</a>` : ''}</td>
        <td>${p.active ? 'Sí' : 'No'}</td>
        <td class="actions">
          <button class="btn" onclick="Admin.edit(${idx})">Editar</button>
          <button class="btn" onclick="Admin.remove('${p.id}')">Eliminar</button>
        </td>
      </tr>`;
    }).join('');
  }

   // =============== CARGA MASIVA (CSV) ===============
  async function initBulkUpload() {
    const form = document.getElementById('bulkForm');
    if (!form) return; // por si la página no tiene el formulario

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById('bulkFile');
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

        const txt = await r.text(); // para ver detalles si falla

        if (!r.ok) {
          console.error('Error /api/products/bulk', r.status, txt);
          alert(`Error cargando productos (${r.status}): ${txt}`);
          return;
        }

        let data = {};
        try { data = txt ? JSON.parse(txt) : {}; } catch { }

        alert(`Productos cargados correctamente. Registros procesados: ${data.count ?? 'N/D'}`);

        // recargar lista de productos
        await load();

      } catch (err) {
        console.error('Error de conexión al subir productos', err);
        alert('Error de conexión subiendo productos');
      }
    });
  }


  function openForm() {
    editIndex = -1;
    ['f_id', 'f_name', 'f_brand', 'f_category', 'f_price', 'f_cost', 'f_stock', 'f_image', 'f_desc'].forEach(id => {
      const el = $(id); if (el) el.value = '';
    });
    const chk = $('f_active'); if (chk) chk.checked = true;
    const pv = $('f_preview'); if (pv) { pv.src = ''; pv.style.display = 'none'; }
    $('formBox').style.display = 'block';
    $('f_id').focus();
  }

  function edit(i) {
    editIndex = i;
    const p = products[i];
    $('f_id').value = p.id;
    $('f_name').value = p.name || '';
    $('f_brand').value = p.brand || '';
    $('f_category').value = p.category || '';
    $('f_price').value = p.price || 0;
    $('f_cost').value = p.cost || 0;
    $('f_stock').value = p.stock || 0;
    $('f_image').value = p.image_Url || '';
    $('f_desc').value = p.description || '';
    const chk = $('f_active'); if (chk) chk.checked = !!p.active;
    const pv = $('f_preview');
    if (p.image_Url) { pv.src = p.image_Url; pv.style.display = 'block'; } else { pv.src = ''; pv.style.display = 'none'; }
    $('formBox').style.display = 'block';
  }

  function previewImage(ev) {
    const file = ev.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const pv = $('f_preview'); pv.src = reader.result; pv.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  async function remove(id) {
    if (!confirm('Eliminar este producto?')) return;
    const r = await fetch(`${API}/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) { alert('Error eliminando'); return; }
    await load();
  }

  async function save() {
    const fileEl = document.getElementById('f_image_file');
    const file = fileEl && fileEl.files ? fileEl.files[0] : null;
    let imageUrl = document.getElementById('f_image').value || '';

    // subir imagen
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
          alert('No se pudo subir la imagen, pero el producto se guardará sin imagen.');
        }
      } catch (err) {
        console.error('Error de conexión al subir imagen', err);
        alert('No se pudo subir la imagen (error de conexión). El producto se guardará sin imagen.');
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
      alert('ID y Nombre son requeridos');
      return;
    }

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
      alert('Error guardando el producto: ' + t);
      return;
    }

    $('formBox').style.display = 'none';
    await load();
  }


// =============== ÓRDENES ===============
async function loadOrders() {
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
}


 function renderOrders() {
  const t = $('ordersTable');
  if (!t) return;

  t.innerHTML = `<tr>
    <th>ID</th><th>Fecha</th><th>Cliente</th><th>Teléfono</th>
    <th>Total</th><th>Estado</th><th>Items</th><th>Acciones</th>
  </tr>`;

  t.innerHTML += orders.map(o => {
    const date = o.created_At ? new Date(o.created_At) : null;
    const d = date ? date.toLocaleString() : '';
    let badgeClass = 'badge';
    if (o.status === 'CONFIRMADA') badgeClass += ' badge-success';
    else if (o.status === 'CANCELADA') badgeClass += ' badge-danger';
    else badgeClass += ' badge-warning';

    return `<tr>
      <td>${o.orderNumber || o.id}</td>  <!-- mostramos bonito -->
      <td>${d}</td>
      <td>${o.customer_Name || ''}</td>
      <td>${o.phone || ''}</td>
      <td>${fmt(o.total)}</td>
      <td><span class="${badgeClass}">${o.status}</span></td>
      <td>${o.itemsCount || 0}</td>
      <td class="actions">
        <button class="btn" onclick="Admin.showOrderDetail('${o.id}')">Ver</button>
        <button class="btn" onclick="Admin.confirmOrder('${o.id}', '${o.orderNumber || ''}')"
                ${o.status === 'CONFIRMADA' ? 'disabled' : ''}>Confirmar</button>
        <button class="btn" onclick="Admin.cancelOrder('${o.id}', '${o.orderNumber || ''}')"
                ${o.status !== 'PENDIENTE' ? 'disabled' : ''}>Cancelar</button>
      </td>
    </tr>`;
  }).join('');
}

 async function showOrderDetail(id) {
  const ord = orders.find(o => o.id === id);
  if (!ord) return;

  const box = $('orderDetail');
  const content = $('orderDetailContent');

  content.innerHTML = `
    <h3>Orden ${ord.orderNumber || ord.id}</h3>
    <p><b>Cliente:</b> ${ord.customer_Name || ''}</p>
    <p><b>Teléfono:</b> ${ord.phone || ''}</p>
    <p><b>Total:</b> ${fmt(ord.total)}</p>
    <p><b>Estado:</b> ${ord.status}</p>
    <div class="dialog-actions">
      <button class="btn" onclick="document.getElementById('orderDetail').style.display='none'">Cerrar</button>
    </div>
  `;
  box.style.display = 'block';
}


 async function confirmOrder(id, orderNumber) {
  if (!confirm(`Confirmar la orden ${orderNumber || id}? Esto rebajará el inventario.`)) return;

  try {
    const r = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/confirm`, {
      method: 'POST'
    });

    const txt = await r.text();

    if (!r.ok) {
      console.error('Error confirmando orden', r.status, txt);
      alert(`Error confirmando (${r.status}): ${txt}`);
      return;
    }

    let data = {};
    try { data = txt ? JSON.parse(txt) : {}; } catch { }

    alert(`Orden ${orderNumber || id} confirmada (${data.status || 'OK'})`);

    await loadOrders();
    await load();
  } catch (err) {
    console.error('Error de red al confirmar', err);
    alert('No se pudo conectar con el servidor para confirmar la orden.');
  }
}

 async function cancelOrder(id, orderNumber) {
  if (!confirm(`Cancelar la orden ${orderNumber || id}?`)) return;
  const r = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST'
  });
  const txt = await r.text();
  if (!r.ok) {
    alert(`Error cancelando (${r.status}): ${txt}`);
    return;
  }
  alert(`Orden ${orderNumber || id} cancelada`);
  await loadOrders();
}

  // =============== REPORTES (si ya los tenías) ===============
  async function showReports() {
    const from = $('fromDate')?.value;
    const to = $('toDate')?.value;
    const url = new URL(`${API}/api/reports/sales`);
    if (from) url.searchParams.set('from', from + 'T00:00:00');
    if (to) url.searchParams.set('to', to + 'T23:59:59');

    const r = await fetch(url);
    if (!r.ok) { alert('Error cargando reporte'); return; }
    const js = await r.json();

    let html = `<div class="dialog"><h3>Reporte de Ventas</h3>
      <p><b>Ingresos:</b> ${fmt(js.ingresos)} — <b>Ganancia:</b> ${fmt(js.ganancia)} — <b>Unidades:</b> ${js.unidades}</p>
      <table class="table"><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th><th>Ganancia</th><th>Margen %</th></tr>`;
    (js.top || []).forEach(rp => {
      const pct = rp.venta > 0 ? ((rp.ganancia / rp.venta) * 100).toFixed(1) + '%' : '0%';
      html += `<tr>
        <td>${rp.name} (${rp.id})</td>
        <td>${rp.qty}</td>
        <td>${fmt(rp.venta)}</td>
        <td>${fmt(rp.ganancia)}</td>
        <td>${pct}</td>
      </tr>`;
    });
    html += `</table></div>`;
    $('reportsBox').innerHTML = html;
  }

  return {
    login,
    showTab,
    load,
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
