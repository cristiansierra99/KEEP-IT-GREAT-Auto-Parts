
const Shop = (()=>{
  const state = {
    products: [],
    filtered: [],
    categories: [],
    categoryActive: 'all',
    cart: JSON.parse(localStorage.getItem('kg_cart')||'[]')
  };

  function rd(amount){ return 'RD$ ' + Number(amount).toLocaleString('es-DO',{minimumFractionDigits:0}); }

  async function load(){
    // Try localStorage first (admin saves here)
    const local = localStorage.getItem('kg_products');
    if(local){
      state.products = JSON.parse(local);
    }else{
      // Fallback to products.json
      const res = await fetch('products.json');
      state.products = await res.json();
    }
    // Build categories
    const set = new Set(state.products.map(p=>p.category).filter(Boolean));
    state.categories = ['all',...Array.from(set)];
    renderCats();
    render();
    document.getElementById('year').textContent = new Date().getFullYear();
    updateCartCount();
  }

  function renderCats(){
    const box = document.getElementById('cats');
    box.innerHTML = '';
    state.categories.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'category'+(state.categoryActive===c?' active':'');
      div.textContent = c==='all' ? 'Todos' : c.charAt(0).toUpperCase()+c.slice(1);
      div.onclick = ()=>{ state.categoryActive=c; render(); };
      box.appendChild(div);
    });
  }

  function search(){
    state.categoryActive = 'all';
    render();
  }

  function render(){
    const q = (document.getElementById('q').value||'').toLowerCase();
    let list = state.products.filter(p=> !q || [p.name,p.brand,p.id,(p.tags||[]).join(' ')].join(' ').toLowerCase().includes(q));
    if(state.categoryActive!=='all'){
      list = list.filter(p=>p.category===state.categoryActive);
    }
    const sort = document.getElementById('sort').value;
    if(sort==='price_asc') list.sort((a,b)=>a.price-b.price);
    if(sort==='price_desc') list.sort((a,b)=>b.price-a.price);
    if(sort==='name_asc') list.sort((a,b)=>a.name.localeCompare(b.name));
    // Render
    const box = document.getElementById('products');
    box.innerHTML = '';
    list.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${p.image||'https://placehold.co/600x400?text=Producto'}" alt="${p.name}">
        <div class="body">
          <div class="brand">${p.brand||''} • <small>${p.id||''}</small></div>
          <strong>${p.name}</strong>
          <div class="tags">${(p.tags||[]).map(t=>`<span class='tag'>${t}</span>`).join('')}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <div class="price">${rd(p.price||0)}</div>
            <button class="btn btn-primary" onclick='Shop.addToCart("${p.id}")'>Agregar</button>
          </div>
        </div>`;
      box.appendChild(card);
    });
  }

  function addToCart(id){
    const p = state.products.find(x=>x.id===id);
    if(!p) return;
    const i = state.cart.findIndex(x=>x.id===id);
    if(i>-1) state.cart[i].qty += 1; else state.cart.push({id, name:p.name, price:p.price, qty:1});
    localStorage.setItem('kg_cart', JSON.stringify(state.cart));
    updateCartCount();
    openCart();
  }

  function updateCartCount(){
    const total = state.cart.reduce((s,x)=>s+x.qty,0);
    const el1 = document.getElementById('cart-count');
    const el2 = document.getElementById('cart-count-2');
    if(el1) el1.textContent = total;
    if(el2) el2.textContent = total;
  }

  function openCart(){ document.getElementById('cart').style.display='flex'; }
  function closeCart(){ document.getElementById('cart').style.display='none'; }
  function viewCart(){
    const lines = state.cart.map(x=>`• ${x.name} x${x.qty} — RD$ ${(x.price*x.qty).toLocaleString('es-DO')}`).join('\n');
    const total = state.cart.reduce((s,x)=>s+x.price*x.qty,0);
    alert(`Carrito:\n${lines}\n\nTOTAL: RD$ ${total.toLocaleString('es-DO')}`);
  }

  return { load, render, search, addToCart, openCart, closeCart, viewCart };
})();

window.addEventListener('DOMContentLoaded', Shop.load);
