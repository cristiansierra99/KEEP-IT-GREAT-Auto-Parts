const Shop = (()=>{
  const state = {
    priceRange: {min:null, max:null},
    viewing: null,
    checkoutOpen: false,
    orders: JSON.parse(localStorage.getItem('kg_orders')||'[]'),
    products: [],
    categories: [],
    categoryActive: 'all',
    cart: JSON.parse(localStorage.getItem('kg_cart')||'[]')
  };

  const fmtRD = n => 'RD$ ' + Number(n||0).toLocaleString('es-DO',{minimumFractionDigits:2});

  async function load(){
    const local = localStorage.getItem('kg_products');
    if(local){ state.products = JSON.parse(local); }
    else{
      const res = await fetch('products.json'); state.products = await res.json();
    }
    buildCats();
    render();
    const y = document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();
    updateCartCount();
  }

  function buildCats(){
    const set = new Set(state.products.map(p=>p.category).filter(Boolean));
    state.categories = ['all',...Array.from(set)];
    const box = document.getElementById('cats'); if(!box) return;
    box.innerHTML='';
    state.categories.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'category'+(state.categoryActive===c?' active':''); 
      div.textContent = c==='all'?'Todos':(c?.charAt(0).toUpperCase()+c?.slice(1));
      div.onclick = ()=>{ state.categoryActive=c; render(); };
      box.appendChild(div);
    });

    const brandSel = document.getElementById('brandFilter');
    if(brandSel){
      const brands = Array.from(new Set(state.products.map(p=>p.brand).filter(Boolean))).sort();
      brandSel.innerHTML = '<option value="all">Todas las marcas</option>' + brands.map(b=>`<option value="${b}">${b}</option>`).join('');
    }
  }

  function search(){ state.categoryActive='all'; render(); }
  function applyPrice(){
    const min = parseFloat(document.getElementById('minPrice')?.value||'');
    const max = parseFloat(document.getElementById('maxPrice')?.value||'');
    state.priceRange.min = isNaN(min)? null : min;
    state.priceRange.max = isNaN(max)? null : max;
    render();
  }

  function render(){
    const q = (document.getElementById('q')?.value||'').toLowerCase();
    let list = state.products.filter(p=> !q || [p.name,p.brand,p.id,(p.tags||[]).join(' ')].join(' ').toLowerCase().includes(q));
    if(state.categoryActive!=='all') list = list.filter(p=>p.category===state.categoryActive);

    const brandSel = document.getElementById('brandFilter');
    const brandVal = brandSel? brandSel.value : 'all';
    if(brandVal && brandVal!=='all'){ list = list.filter(p=>p.brand===brandVal); }
    if(state.priceRange.min!=null){ list = list.filter(p=> (p.price||0) >= state.priceRange.min ); }
    if(state.priceRange.max!=null){ list = list.filter(p=> (p.price||0) <= state.priceRange.max ); }

    const sortSel = document.getElementById('sort'); const sort = sortSel? sortSel.value: 'pop';
    if(sort==='price_asc') list.sort((a,b)=>a.price-b.price);
    if(sort==='price_desc') list.sort((a,b)=>b.price-a.price);
    if(sort==='name_asc') list.sort((a,b)=>a.name.localeCompare(b.name));

    const box = document.getElementById('products'); if(!box) return; box.innerHTML='';
    list.forEach(p=>{
      const oos = (p.stock||0) <= 0;
      const card = document.createElement('div');
      card.className = 'card';
      card.onclick = ()=>Shop.openProduct(p.id);
      card.innerHTML = `
        <img src="${p.image||'https://placehold.co/600x400?text=Producto'}" alt="${p.name}">
        <div class="body">
          <div class="brand">${p.brand||''} • <small>${p.id||''}</small></div>
          <strong>${p.name}</strong>
          <div class="tags">
            ${(p.tags||[]).map(t=>`<span class='tag'>${t}</span>`).join('')}
            ${oos ? `<span class="badge-oos">Agotado</span>`: ''}
          </div>
          <div class="stock-left">${oos? '': `Stock: ${p.stock}`}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <div class="price">${fmtRD(p.price)}</div>
            <button class="btn btn-primary" ${oos?'disabled':''} onclick='event.stopPropagation();Shop.addToCart("${p.id}")'>${oos?'Agotado':'Agregar'}</button>
          </div>
        </div>`;
      box.appendChild(card);
    });
  }

  function syncCart(){ localStorage.setItem('kg_cart', JSON.stringify(state.cart)); updateCartCount(); renderCart(); }
  function updateCartCount(){
    const total = state.cart.reduce((s,x)=>s+x.qty,0);
    const a = document.getElementById('cart-count'); if(a) a.textContent = total;
    const b = document.getElementById('cart-count-2'); if(b) b.textContent = total;
  }

  function addToCart(id){
    const p = state.products.find(x=>x.id===id); if(!p) return;
    if((p.stock||0) <= 0){ alert('Producto agotado'); return; }
    const item = state.cart.find(x=>x.id===id);
    const qty = (item?.qty||0) + 1;
    if(qty > (p.stock||0)){ alert('No hay suficiente stock'); return; }
    if(item){ item.qty += 1; } else { state.cart.push({id, name:p.name, price:p.price, qty:1, image:p.image}); }
    syncCart(); openCart();
  }

  function openCart(){ const b=document.getElementById('cart-backdrop'); const d=document.getElementById('cart-drawer'); if(b) b.style.display='block'; if(d) d.style.display='flex'; const f=document.getElementById('cart'); if(f) f.style.display='none'; renderCart(); }
  function closeCart(){ const b=document.getElementById('cart-backdrop'); const d=document.getElementById('cart-drawer'); if(b) b.style.display='none'; if(d) d.style.display='none'; const f=document.getElementById('cart'); if(f) f.style.display=''; }

  function renderCart(){
    const cf=document.getElementById('checkout-form'); if(cf) { cf.style.display='none'; cf.innerHTML=''; }
    const box = document.getElementById('cart-items'); if(!box) return;
    box.innerHTML='';
    if(state.cart.length===0){ box.innerHTML='<p class="muted">Tu carrito está vacío.</p>'; const ct=document.getElementById('cart-total'); if(ct) ct.textContent=fmtRD(0); return; }
    let total = 0;
    state.cart.forEach(it=>{
      const p = state.products.find(x=>x.id===it.id);
      const max = p ? (p.stock||0) : it.qty;
      const line = (it.price||0) * (it.qty||0);
      total += line;
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        <img src="${it.image||'https://placehold.co/100'}" alt="${it.name}">
        <div>
          <div><strong>${it.name}</strong></div>
          <div class="muted">ID: ${it.id}</div>
          <div class="muted">Disponible: ${max}</div>
          <div class="qty" style="margin-top:6px">
            <button class="btn" onclick='Shop.decQty("${it.id}")'>-</button>
            <span>${it.qty}</span>
            <button class="btn" onclick='Shop.incQty("${it.id}")' ${it.qty>=max?'disabled':''}>+</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div>${fmtRD(line)}</div>
          <button class="btn" onclick='Shop.removeItem("${it.id}")'>Eliminar</button>
        </div>`;
      box.appendChild(div);
    });
    const ct=document.getElementById('cart-total'); if(ct) ct.textContent = fmtRD(total);
  }

  function incQty(id){
    const p = state.products.find(x=>x.id===id); const it = state.cart.find(x=>x.id===id);
    if(!p || !it) return;
    if(it.qty >= (p.stock||0)){ alert('No hay más stock'); return; }
    it.qty += 1; syncCart();
  }
  function decQty(id){
    const it = state.cart.find(x=>x.id===id); if(!it) return;
    it.qty -= 1; if(it.qty<=0){ state.cart = state.cart.filter(x=>x.id!==id); } syncCart();
  }
  function removeItem(id){ state.cart = state.cart.filter(x=>x.id!==id); syncCart(); }

  function viewCart(){ openCart(); }

  function openProduct(id){
    const p = state.products.find(x=>x.id===id); if(!p) return;
    state.viewing = p;
    const b = document.getElementById('product-backdrop'); const d = document.getElementById('product-modal');
    if(b) b.style.display='block'; if(d) d.style.display='flex';
    const body = document.getElementById('pd-body'); const foot = document.getElementById('pd-foot'); const title = document.getElementById('pd-title');
    if(title) title.textContent = p.name;
    if(body) body.innerHTML = `
      <div class="pd-grid">
        <img class="pd-img" src="${p.image||'https://placehold.co/800x600?text=Producto'}" alt="${p.name}"/>
        <div>
          <div class="brand">${p.brand||''} • <small>${p.id||''}</small></div>
          <h3 style="margin:6px 0">${p.name}</h3>
          <div>${p.description||''}</div>
          <div style="margin:8px 0" class="stock-left">${(p.stock||0)<=0?'<span class="badge-oos">Agotado</span>':'Stock: '+p.stock}</div>
          <div class="price" style="font-size:22px">${fmtRD(p.price)}</div>
        </div>
      </div>`;
    if(foot) foot.innerHTML = `<button class="btn" onclick="Shop.closeProduct()">Cerrar</button>
      <button class="btn btn-primary" ${ (p.stock||0)<=0 ? 'disabled' : '' } onclick="Shop.addToCart('${p.id}')">${ (p.stock||0)<=0 ? 'Agotado' : 'Agregar al carrito'}</button>`;
  }
  function closeProduct(){ const b=document.getElementById('product-backdrop'); const d=document.getElementById('product-modal'); if(b) b.style.display='none'; if(d) d.style.display='none'; state.viewing=null; }

  function showCheckout(){
    const form = document.getElementById('checkout-form'); if(!form) return;
    const subtotal = state.cart.reduce((s,x)=>s+x.price*x.qty,0);
    const itbis = subtotal * 0.18;
    const envio = subtotal >= 5000 ? 0 : 250;
    const total = subtotal + itbis + envio;
    form.style.display = 'block';
    form.innerHTML = `
      <h3>Datos de pago y envío</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <input id="c_name" placeholder="Nombre y Apellido"/>
        <input id="c_phone" placeholder="Teléfono"/>
        <input id="c_address" placeholder="Dirección de envío" style="grid-column:span 2"/>
        <select id="c_method">
          <option value="contraentrega">Contraentrega</option>
          <option value="transferencia">Transferencia</option>
        </select>
        <select id="c_envio">
          <option value="${envio}">${envio===0?'Envío gratis':'Envío: '+fmtRD(envio)}</option>
        </select>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px">
        <div class="muted">Subtotal</div><div>${fmtRD(subtotal)}</div>
      </div>
      <div style="display:flex;justify-content:space-between">
        <div class="muted">ITBIS 18%</div><div>${fmtRD(itbis)}</div>
      </div>
      <div style="display:flex;justify-content:space-between">
        <div class="muted">Envío</div><div>${fmtRD(envio)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:800">
        <div>Total</div><div>${fmtRD(total)}</div>
      </div>
      <button class="btn btn-primary" style="margin-top:8px" onclick="Shop.confirmCheckout()">Confirmar compra</button>
    `;
  }

  function confirmCheckout(){
    const name = document.getElementById('c_name')?.value?.trim();
    const phone = document.getElementById('c_phone')?.value?.trim();
    if(!name || !phone){ alert('Completa nombre y teléfono'); return; }
    const subtotal = state.cart.reduce((s,x)=>s+x.price*x.qty,0);
    const itbis = subtotal * 0.18;
    const envio = parseFloat(document.getElementById('c_envio')?.value||'0');
    const total = subtotal + itbis + envio;

    for(const it of state.cart){
      const p = state.products.find(x=>x.id===it.id);
      if(it.qty > (p.stock||0)){ alert('Stock insuficiente'); return; }
    }
    for(const it of state.cart){
      const p = state.products.find(x=>x.id===it.id);
      p.stock = (p.stock||0) - it.qty;
    }
    localStorage.setItem('kg_products', JSON.stringify(state.products));

    const order = { id:'KG-'+Math.floor(Math.random()*1e6).toString().padStart(6,'0'), date:new Date().toISOString(), name, phone, address:document.getElementById('c_address')?.value||'', method:document.getElementById('c_method')?.value||'contraentrega', items: state.cart.map(x=>({...x})), subtotal, itbis, envio, total };
    const orders = JSON.parse(localStorage.getItem('kg_orders')||'[]'); orders.push(order); localStorage.setItem('kg_orders', JSON.stringify(orders));

    state.cart = []; localStorage.setItem('kg_cart','[]'); updateCartCount(); render(); closeCart(); alert('¡Orden confirmada!\nID: '+order.id);
  }

  function checkout(){ showCheckout(); }

  return { load, render, search, addToCart, openCart, closeCart, viewCart, incQty, decQty, removeItem, checkout, applyPrice, openProduct, closeProduct, showCheckout, confirmCheckout };
})();

window.addEventListener('DOMContentLoaded', Shop.load);
