const Admin = (function(){
  const PASSWORD = 'admin123'; // cámbiala
  let products = [];
  let editIndex = -1;

  // --- helpers
  const $ = id => document.getElementById(id);
  const val = id => { const el = $(id); return el ? el.value : ''; };
  const fmt = n => 'RD$ ' + Number(n||0).toLocaleString('es-DO',{minimumFractionDigits:2});

  // --- auth
  function login(){
    const pass = val('pass');
    if(pass===PASSWORD){ $('auth').style.display='none'; $('panel').style.display='block'; load(); }
    else alert('Contraseña incorrecta');
  }

  // --- data
  function load(){
    const local = localStorage.getItem('kg_products');
    if(local){ products = JSON.parse(local); render(); }
    else{
      fetch('products.json').then(r=>r.json()).then(d=>{ products=d; saveLocal(); render(); }).catch(()=>{ products=[]; render(); });
    }
  }
  function saveLocal(){ localStorage.setItem('kg_products', JSON.stringify(products)); }

  // --- UI tabla
  function tableHead(){
    const t = $('table');
    t.innerHTML = '<tr>'
      + '<th>ID</th><th>Nombre</th><th>Marca</th><th>Categoría</th>'
      + '<th>Precio</th><th>Costo</th><th>Margen/u</th><th>Margen %</th>'
      + '<th>Stock</th><th>Imagen</th><th>Acciones</th></tr>';
  }

  function render(){
    tableHead();
    const t = $('table');
    products.forEach((p,idx)=>{
      const margenU = (p.price||0) - (p.cost||0);
      const margenPct = p.price>0 ? (((p.price-(p.cost||0))/p.price)*100).toFixed(1)+'%' : '0%';
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${p.id||''}</td>
         <td>${p.name||''}</td>
         <td>${p.brand||''}</td>
         <td>${p.category||''}</td>
         <td>${fmt(p.price)}</td>
         <td>${fmt(p.cost)}</td>
         <td>${fmt(margenU)}</td>
         <td>${margenPct}</td>
         <td>${p.stock||0}</td>
         <td>${p.image?('<a target=_blank href="'+p.image+'">ver</a>'):''}</td>
         <td class="actions">
           <button class="btn" onclick="Admin.edit(${idx})">Editar</button>
           <button class="btn" onclick="Admin.remove(${idx})">Eliminar</button>
         </td>`;
      t.appendChild(tr);
    });
  }

  // --- form
  function openForm(){
    editIndex = -1;
    $('formTitle').textContent = 'Nuevo producto';
    ['f_id','f_name','f_brand','f_category','f_price','f_cost','f_stock','f_image','f_desc'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    const pv = $('f_preview'); if(pv){ pv.src=''; pv.style.display='none'; }
    $('formBox').style.display='block'; $('f_id').focus();
  }

  function edit(i){
    editIndex = i;
    const p = products[i];
    $('formTitle').textContent = 'Editar producto';
    $('f_id').value = p.id||'';
    $('f_name').value = p.name||'';
    $('f_brand').value = p.brand||'';
    $('f_category').value = p.category||'';
    $('f_price').value = p.price||0;
    $('f_cost').value  = p.cost||0;
    $('f_stock').value = p.stock||0;
    $('f_image').value = p.image||'';
    $('f_desc').value  = p.description||'';
    const pv = $('f_preview'); if(p.image){ pv.src=p.image; pv.style.display='block'; } else { pv.src=''; pv.style.display='none'; }
    $('formBox').style.display='block';
  }

  function previewImage(ev){
    const file = ev && ev.target && ev.target.files ? ev.target.files[0] : null;
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{ const pv=$('f_preview'); if(pv){ pv.src=reader.result; pv.style.display='block'; } };
    reader.readAsDataURL(file);
  }

  function remove(i){
    if(!confirm('Eliminar este producto?')) return;
    products.splice(i,1); saveLocal(); render();
  }

  function save(){
    const fileEl = $('f_image_file');
    const file = fileEl && fileEl.files ? fileEl.files[0] : null;

    const p = {
      id: val('f_id'),
      name: val('f_name'),
      brand: val('f_brand'),
      category: val('f_category'),
      price: parseFloat(val('f_price')||'0'),
      cost:  parseFloat(val('f_cost') ||'0'),
      stock: parseInt(val('f_stock')||'0',10),
      image: val('f_image'),
      description: val('f_desc')
    };
    if(!p.id || !p.name){ alert('ID y Nombre son requeridos'); return; }

    const finalize = ()=>{
      if(editIndex>-1){ products[editIndex]=p; editIndex=-1; }
      else{ products.unshift(p); }
      saveLocal(); render(); $('formBox').style.display='none';
    };
    if(file){
      const reader = new FileReader();
      reader.onload = ()=>{ p.image = reader.result; finalize(); };
      reader.readAsDataURL(file);
    }else{
      finalize();
    }
  }

  // --- pedidos (lee los generados por el checkout del carrito)
  function listOrders(){
    const orders = JSON.parse(localStorage.getItem('kg_orders')||'[]');
    let html = `<h3>Pedidos (${orders.length})</h3>
      <table class="table">
        <tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Teléfono</th><th>Total</th><th>Items</th></tr>`;
    orders.forEach(o=>{
      const items = (o.items||[]).map(i=>`${i.name} x${i.qty}`).join(', ');
      html += `<tr>
        <td>${o.id}</td>
        <td>${new Date(o.date).toLocaleString()}</td>
        <td>${o.name}</td>
        <td>${o.phone}</td>
        <td>${fmt(o.total)}</td>
        <td>${items}</td>
      </tr>`;
    });
    html += `</table>
      <div class="toolbar">
        <button class="btn" onclick="Admin.exportOrders()">Exportar CSV</button>
        <button class="btn" onclick="Admin.clearOrders()">Borrar pedidos</button>
      </div>`;
    $('ordersBox').innerHTML = `<div class="dialog">${html}</div>`;
  }

  function exportOrders(){
    const orders = JSON.parse(localStorage.getItem('kg_orders')||'[]');
    const header = ['id','date','name','phone','address','method','subtotal','itbis','envio','total','items'];
    const rows = [header.join(',')];
    orders.forEach(o=>{
      const items = (o.items||[]).map(i=>`${i.id} ${i.name} x${i.qty} @${i.price}`).join(' | ').replace(/,/g,';');
      rows.push([o.id,o.date,o.name,o.phone,String(o.address||'').replace(/,/g,';'),o.method,o.subtotal,o.itbis,o.envio,o.total,items].join(','));
    });
    const blob = new Blob([rows.join('\n')], {type:'text/csv'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='orders.csv'; a.click(); URL.revokeObjectURL(url);
  }
  function clearOrders(){ if(confirm('Borrar todos los pedidos?')){ localStorage.removeItem('kg_orders'); alert('Hecho'); listOrders(); } }

  // --- reportes (ingresos, ganancia y top vendidos)
  function showReports(){
    const orders = JSON.parse(localStorage.getItem('kg_orders')||'[]');
    const from = val('fromDate'), to = val('toDate');
    const fromD = from? new Date(from+'T00:00:00') : null;
    const toD   = to  ? new Date(to  +'T23:59:59') : null;

    const filtered = orders.filter(o=>{
      const d = new Date(o.date);
      if(fromD && d<fromD) return false;
      if(toD && d>toD) return false;
      return true;
    });
    if(filtered.length===0){ $('reportsBox').innerHTML = '<div class="dialog"><p class="muted">Sin ventas en el rango seleccionado.</p></div>'; return; }

    const costMap = {}; (products||[]).forEach(p=> costMap[p.id]=p.cost||0 );
    const agg = {}; let ingresos=0, ganancia=0, unidades=0;
    filtered.forEach(o=>{
      (o.items||[]).forEach(it=>{
        const venta = (it.price||0) * (it.qty||0);
        const costo = (costMap[it.id]||0) * (it.qty||0);
        const g = venta - costo;
        ingresos += venta; ganancia += g; unidades += (it.qty||0);
        if(!agg[it.id]) agg[it.id] = { id: it.id, name: it.name, qty:0, venta:0, ganancia:0 };
        agg[it.id].qty += (it.qty||0); agg[it.id].venta += venta; agg[it.id].ganancia += g;
      });
    });
    const top = Object.keys(agg).map(k=>agg[k]).sort((a,b)=>b.qty-a.qty);

    let html = `<div class="dialog"><h3>Reporte de Ventas</h3>
      <p><b>Ingresos:</b> ${fmt(ingresos)} — <b>Ganancia:</b> ${fmt(ganancia)} — <b>Unidades:</b> ${unidades}</p>
      <table class="table"><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th><th>Ganancia</th><th>Margen %</th></tr>`;
    top.forEach(r=>{
      const margenPct = r.venta>0? ((r.ganancia/r.venta)*100).toFixed(1)+'%' : '0%';
      html += `<tr><td>${r.name} (${r.id})</td><td>${r.qty}</td><td>${fmt(r.venta)}</td><td>${fmt(r.ganancia)}</td><td>${margenPct}</td></tr>`;
    });
    html += `</table>
      <div class="toolbar"><button class="btn" onclick="Admin.exportReport()">Exportar CSV</button></div></div>`;
    $('reportsBox').innerHTML = html;
  }

  function exportReport(){
    const orders = JSON.parse(localStorage.getItem('kg_orders')||'[]');
    const from = val('fromDate'), to = val('toDate');
    const fromD = from? new Date(from+'T00:00:00') : null;
    const toD   = to  ? new Date(to  +'T23:59:59') : null;

    const filtered = orders.filter(o=>{
      const d = new Date(o.date);
      if(fromD && d<fromD) return false;
      if(toD && d>toD) return false;
      return true;
    });

    const costMap = {}; (products||[]).forEach(p=> costMap[p.id]=p.cost||0 );
    const rows = [['fecha','orden_id','cliente','telefono','producto_id','producto_nombre','unidades','precio_unit','ingresos','costo_unit','costo_total','ganancia']];
    filtered.forEach(o=>{
      (o.items||[]).forEach(it=>{
        const venta  = (it.price||0) * (it.qty||0);
        const costoU = (costMap[it.id]||0);
        const costoT = costoU * (it.qty||0);
        const gan    = venta - costoT;
        rows.push([o.date, o.id, o.name, o.phone, it.id, it.name, it.qty, it.price, venta, costoU, costoT, gan]);
      });
    });
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='reporte-ventas.csv'; a.click(); URL.revokeObjectURL(url);
  }

  return { login, openForm, edit, remove, save, exportJSON, importJSON, previewImage, listOrders, exportOrders, clearOrders, showReports, exportReport };

  // export/import JSON (igual que tu versión)
  function exportJSON(){
    const blob = new Blob([JSON.stringify(products, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='products-export.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function importJSON(ev){
    const file = ev.target && ev.target.files ? ev.target.files[0] : null; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{ try{ products = JSON.parse(reader.result); saveLocal(); render(); alert('Importado ✔'); } catch(e){ alert('Archivo inválido'); } };
    reader.readAsText(file);
  }
})();
