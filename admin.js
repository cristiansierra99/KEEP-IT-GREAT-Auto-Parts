
const Admin = (()=>{
  const PASSWORD = 'admin123'; // <-- cámbiala
  let products = [];

  function login(){
    const pass = document.getElementById('pass').value;
    if(pass===PASSWORD){
      document.getElementById('auth').style.display='none';
      document.getElementById('panel').style.display='block';
      load();
    }else{
      alert('Contraseña incorrecta');
    }
  }

  function load(){
    const local = localStorage.getItem('kg_products');
    if(local){ products = JSON.parse(local); }
    else{
      fetch('products.json').then(r=>r.json()).then(d=>{ products=d; saveLocal(); render(); });
      return;
    }
    render();
  }

  function saveLocal(){
    localStorage.setItem('kg_products', JSON.stringify(products));
  }

  function tableHead(){
    const t = document.getElementById('table');
    t.innerHTML = `<tr>
      <th>ID</th><th>Nombre</th><th>Marca</th><th>Categoría</th>
      <th>Precio</th><th>Stock</th><th>Imagen</th><th>Acciones</th></tr>`;
  }

  function render(){
    tableHead();
    const t = document.getElementById('table');
    products.forEach((p,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.id||''}</td>
        <td>${p.name||''}</td>
        <td>${p.brand||''}</td>
        <td>${p.category||''}</td>
        <td>RD$ ${(p.price||0).toLocaleString('es-DO')}</td>
        <td>${p.stock||0}</td>
        <td>${p.image?'<a target=_blank href='+p.image+'>ver</a>':''}</td>
        <td class='actions'>
          <button class='btn' onclick='Admin.edit(${idx})'>Editar</button>
          <button class='btn' onclick='Admin.remove(${idx})'>Eliminar</button>
        </td>`;
      t.appendChild(tr);
    });
  }

  function openForm(){
    document.getElementById('formTitle').textContent = 'Nuevo producto';
    ['f_id','f_name','f_brand','f_category','f_price','f_stock','f_image','f_tags','f_desc'].forEach(id=>{
      const el = document.getElementById(id); el.value='';
    });
    document.getElementById('formBox').style.display='block';
    document.getElementById('f_id').focus();
  }

  let editIndex = -1;
  function edit(i){
    editIndex = i;
    const p = products[i];
    document.getElementById('formTitle').textContent = 'Editar producto';
    document.getElementById('f_id').value = p.id||'';
    document.getElementById('f_name').value = p.name||'';
    document.getElementById('f_brand').value = p.brand||'';
    document.getElementById('f_category').value = p.category||'';
    document.getElementById('f_price').value = p.price||0;
    document.getElementById('f_stock').value = p.stock||0;
    document.getElementById('f_image').value = p.image||'';
    document.getElementById('f_tags').value = (p.tags||[]).join(', ');
    document.getElementById('f_desc').value = p.description||'';
    document.getElementById('formBox').style.display='block';
  }

  function remove(i){
    if(!confirm('Eliminar este producto?')) return;
    products.splice(i,1);
    saveLocal(); render();
  }

  function save(){
    const p = {
      id: val('f_id'),
      name: val('f_name'),
      brand: val('f_brand'),
      category: val('f_category'),
      price: parseFloat(val('f_price')||'0'),
      stock: parseInt(val('f_stock')||'0',10),
      image: val('f_image'),
      tags: (val('f_tags')||'').split(',').map(s=>s.trim()).filter(Boolean),
      description: val('f_desc')
    };
    if(!p.id || !p.name){ alert('ID y Nombre son requeridos'); return; }
    if(editIndex>-1){ products[editIndex]=p; editIndex=-1; }
    else{ products.unshift(p); }
    saveLocal();
    render();
    document.getElementById('formBox').style.display='none';
  }

  function exportJSON(){
    const blob = new Blob([JSON.stringify(products, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products-export.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(ev){
    const file = ev.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{ products = JSON.parse(reader.result); saveLocal(); render(); alert('Importado ✔'); }
      catch(e){ alert('Archivo inválido'); }
    };
    reader.readAsText(file);
  }

  const val = id => document.getElementById(id).value;

  return { login, openForm, edit, remove, save, exportJSON, importJSON };
})();
