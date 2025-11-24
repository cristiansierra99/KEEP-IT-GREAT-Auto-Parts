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
    const tabs = ['dashboard', 'products', 'orders', 'reports'];
    const titles = {
      dashboard: '📊 Dashboard',
      products: '📦 Productos',
      orders: '🛒 Órdenes',
      reports: '📈 Reportes'
    };
    const subtitles = {
      dashboard: 'Resumen y estadísticas',
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

    if (tab === 'dashboard') {
      loadDashboard();
    } else if (tab === 'orders') {
      loadOrders();
    }
  }

  // =============== DASHBOARD ===============
  async function loadDashboard() {
    try {
      await Promise.all([
        loadDashboardStats(),
        loadSalesChart(),
        loadTopProducts(),
        loadRecentOrders(),
        loadStockAlerts()
      ]);
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    }
  }

  async function loadDashboardStats() {
    try {
      // Obtener estadísticas del mes actual
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const statsUrl = `${API}/api/reports/sales?from=${firstDay.toISOString()}&to=${lastDay.toISOString()}`;
      const ordersUrl = `${API}/api/orders`;
      const productsUrl = `${API}/api/products/all`;

      const [statsRes, ordersRes, productsRes] = await Promise.all([
        fetch(statsUrl).catch(() => null),
        fetch(ordersUrl).catch(() => null),
        fetch(productsUrl).catch(() => null)
      ]);

      let totalSales = 0;
      if (statsRes && statsRes.ok) {
        const stats = await statsRes.json();
        totalSales = stats.ingresos || 0;
      }

      let ordersData = [];
      let pendingOrders = 0;
      let uniqueCustomers = new Set();
      if (ordersRes && ordersRes.ok) {
        ordersData = await ordersRes.json();
        pendingOrders = ordersData.filter(o => (o.status || o.Status) === 'PENDIENTE').length;
        ordersData.forEach(o => {
          const phone = o.phone || o.Phone;
          if (phone) uniqueCustomers.add(phone);
        });
      }

      let productsData = [];
      let lowStock = 0;
      if (productsRes && productsRes.ok) {
        productsData = await productsRes.json();
        lowStock = productsData.filter(p => (p.stock || 0) < 5 && (p.stock || 0) > 0).length;
      }

      // Actualizar UI
      const statSales = $('stat-sales');
      if (statSales) statSales.textContent = fmt(totalSales);

      const statOrders = $('stat-orders');
      if (statOrders) statOrders.textContent = ordersData.length;

      const statOrdersStatus = $('stat-orders-status');
      if (statOrdersStatus) statOrdersStatus.textContent = `${pendingOrders} pendientes`;

      const statProducts = $('stat-products');
      if (statProducts) statProducts.textContent = productsData.filter(p => p.active).length;

      const statStockAlert = $('stat-stock-alert');
      if (statStockAlert) {
        statStockAlert.textContent = `${lowStock} con stock bajo`;
        statStockAlert.className = lowStock > 0 ? 'stat-change warning' : 'stat-change';
      }

      const statCustomers = $('stat-customers');
      if (statCustomers) statCustomers.textContent = uniqueCustomers.size;

    } catch (err) {
      console.error('Error cargando stats:', err);
    }
  }

 // async function loadSalesChart() {
    const canvas = $('salesChart');
    if (!canvas) return;

    try {
      const now = new Date();
      const days = 7;
      const labels = [];
      const data = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric' }));
        
        // Simular datos (en producción obtener del API)
        data.push(Math.floor(Math.random() * 50000) + 10000);
      }

      const ctx = canvas.getContext('2d');
      
      // Limpiar canvas anterior
      if (window.salesChartInstance) {
        window.salesChartInstance.destroy();
      }

      // Crear gradiente
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(255, 186, 8, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 186, 8, 0.05)');

      window.salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Ventas (RD$)',
            data: data,
            borderColor: '#ffba08',
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#ffba08',
            pointBorderColor: '#111',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleColor: '#ffba08',
              bodyColor: '#e5e7eb',
              borderColor: '#ffba08',
              borderWidth: 1,
              padding: 12,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return 'Ventas: ' + fmt(context.parsed.y);
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(255, 186, 8, 0.1)',
                drawBorder: false
              },
              ticks: {
                color: '#9ca3af',
                callback: function(value) {
                  return 'RD$ ' + (value / 1000).toFixed(0) + 'K';
                }
              }
            },
            x: {
              grid: {
                display: false,
                drawBorder: false
              },
              ticks: {
                color: '#9ca3af'
              }
            }
          }
        }
      });

    } catch (err) {
      console.error('Error cargando gráfico:', err);
    }
  //}
  async function loadSalesChart() {
  const canvas = $('salesChart');
  if (!canvas) return;

  try {
    const now = new Date();
    const days = parseInt($('sales-period')?.value || '7');
    const labels = [];
    const salesData = [];

    // Obtener ventas de los últimos N días
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Label para el gráfico
      if (days === 7) {
        labels.push(date.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric' }));
      } else if (days === 30) {
        labels.push(date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }));
      } else {
        labels.push(date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }));
      }

      // Obtener ventas del día desde el API
      try {
        const url = `${API}/api/reports/sales?from=${dayStart.toISOString()}&to=${dayEnd.toISOString()}`;
        const r = await fetch(url);
        if (r.ok) {
          const dayData = await r.json();
          salesData.push(dayData.ingresos || 0);
        } else {
          salesData.push(0);
        }
      } catch {
        salesData.push(0);
      }
    }

    const ctx = canvas.getContext('2d');
    
    // Limpiar canvas anterior
    if (window.salesChartInstance) {
      window.salesChartInstance.destroy();
    }

    // Crear gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(255, 186, 8, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 186, 8, 0.05)');

    window.salesChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventas (RD$)',
          data: salesData,
          borderColor: '#ffba08',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ffba08',
          pointBorderColor: '#111',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffba08',
            bodyColor: '#e5e7eb',
            borderColor: '#ffba08',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return 'Ventas: ' + fmt(context.parsed.y);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 186, 8, 0.1)',
              drawBorder: false
            },
            ticks: {
              color: '#9ca3af',
              callback: function(value) {
                if (value >= 1000) {
                  return 'RD$ ' + (value / 1000).toFixed(0) + 'K';
                }
                return 'RD$ ' + value;
              }
            }
          },
          x: {
            grid: {
              display: false,
              drawBorder: false
            },
            ticks: {
              color: '#9ca3af'
            }
          }
        }
      }
    });

  } catch (err) {
    console.error('Error cargando gráfico:', err);
  }
}

  //async function loadTopProducts() {
    const container = $('topProducts');
    if (!container) return;

    try {
      // En producción, obtener del API de reportes
      // Por ahora simular datos
      const topProducts = [
        { id: 'P001', name: 'Filtro de Aceite Premium', qty: 45, revenue: 22500 },
        { id: 'P002', name: 'Pastillas de Freno Delanteras', qty: 32, revenue: 19200 },
        { id: 'P003', name: 'Batería 12V 75Ah', qty: 28, revenue: 16800 },
        { id: 'P004', name: 'Aceite Motor 5W-30', qty: 25, revenue: 12500 },
        { id: 'P005', name: 'Bujías Iridium', qty: 20, revenue: 8000 }
      ];

      container.innerHTML = topProducts.map((p, idx) => `
        <div class="top-product-item">
          <div class="top-product-rank">${idx + 1}</div>
          <div class="top-product-info">
            <div class="top-product-name">${p.name}</div>
            <div class="top-product-sales">${p.qty} unidades vendidas</div>
          </div>
          <div class="top-product-revenue">${fmt(p.revenue)}</div>
        </div>
      `).join('');

    } catch (err) {
      console.error('Error cargando top productos:', err);
    }
 // }
async function loadTopProducts() {
  const container = $('topProducts');
  if (!container) return;

  try {
    // Obtener datos reales del mes actual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const url = `${API}/api/reports/sales?from=${firstDay.toISOString()}&to=${lastDay.toISOString()}`;
    const r = await fetch(url);
    
    if (!r.ok) {
      container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">No hay datos disponibles</p>';
      return;
    }

    const data = await r.json();
    const topProducts = data.top || [];

    if (topProducts.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">📦 No hay ventas este mes</p>';
      return;
    }

    // Tomar solo los top 5
    const top5 = topProducts.slice(0, 5);

    container.innerHTML = top5.map((p, idx) => `
      <div class="top-product-item">
        <div class="top-product-rank">${idx + 1}</div>
        <div class="top-product-info">
          <div class="top-product-name">${p.name}</div>
          <div class="top-product-sales">${p.qty || 0} unidades vendidas</div>
        </div>
        <div class="top-product-revenue">${fmt(p.venta || 0)}</div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error cargando top productos:', err);
    container.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;">❌ Error al cargar productos</p>';
  }
}
  async function loadRecentOrders() {
    const container = $('recentOrders');
    if (!container) return;

    try {
      const r = await fetch(`${API}/api/orders`);
      if (!r.ok) return;

      const allOrders = await r.json();
      const recentOrders = allOrders
        .map(o => ({
          id: o.id || o.Id,
          orderNumber: o.orderNumber || o.OrderNumber || '',
          customer_Name: o.customer_Name || o.Customer_Name || 'Cliente',
          total: o.total ?? o.Total ?? 0,
          status: o.status || o.Status || 'PENDIENTE',
          created_At: o.created_At || o.Created_At
        }))
        .sort((a, b) => new Date(b.created_At) - new Date(a.created_At))
        .slice(0, 5);

      if (recentOrders.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">No hay órdenes recientes</p>';
        return;
      }

      container.innerHTML = recentOrders.map(o => {
        const date = o.created_At ? new Date(o.created_At) : null;
        const timeAgo = date ? getTimeAgo(date) : '';
        const badgeClass = o.status === 'CONFIRMADA' ? 'badge-success' : 
                          o.status === 'CANCELADA' ? 'badge-danger' : 'badge-warning';

        return `
          <div class="recent-order-item" onclick="Admin.showOrderDetail('${o.id}')">
            <div class="order-info">
              <h4>#${o.orderNumber || o.id} - ${o.customer_Name}</h4>
              <p><span class="badge ${badgeClass}">${o.status}</span></p>
            </div>
            <div class="order-amount">
              <div class="order-total">${fmt(o.total)}</div>
              <div class="order-time">${timeAgo}</div>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Error cargando órdenes recientes:', err);
    }
  }

  async function loadStockAlerts() {
    const container = $('stockAlerts');
    if (!container) return;

    try {
      const lowStockProducts = products.filter(p => {
        const stock = p.stock || 0;
        return stock > 0 && stock < 5;
      }).slice(0, 8);

      if (lowStockProducts.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">✅ Todo el stock está bien</p>';
        return;
      }

      container.innerHTML = lowStockProducts.map(p => `
        <div class="alert-item">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <div class="alert-title">${p.name}</div>
            <div class="alert-desc">Stock actual: ${p.stock} unidades - ID: ${p.id}</div>
          </div>
        </div>
      `).join('');

    } catch (err) {
      console.error('Error cargando alertas:', err);
    }
  }

  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Hace un momento';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)} días`;
    return date.toLocaleDateString('es-DO');
  }

  function updateSalesChart() {
    loadSalesChart();
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