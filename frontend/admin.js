// Mostrar sección
function showSection(id){
    document.querySelectorAll('.admin-section').forEach(sec=>{
        sec.style.display = sec.id === id ? 'block' : 'none';
    });
}

// Formulario agregar producto
const form = document.getElementById('productForm');
const msg = document.getElementById('message');

form.addEventListener('submit', async e=>{
    e.preventDefault();
    const data = new FormData(form);

    const res = await fetch('http://localhost:4000/api/products',{
        method:'POST',
        body:data
    });
    const result = await res.json();
    msg.textContent = result.message;
    form.reset();
    loadProducts();
});

// Cargar productos existentes
async function loadProducts(){
    const res = await fetch('http://localhost:4000/api/menu');
    const products = await res.json();
    const container = document.getElementById('productList');
    container.innerHTML = '';
    products.forEach(p=>{
        const div = document.createElement('div');
        div.style.display="flex";
        div.style.justifyContent="space-between";
        div.style.alignItems="center";
        div.style.marginBottom="10px";

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="http://localhost:4000/uploads/${p.image}" alt="${p.name}" width="50" height="50" style="object-fit:cover; border-radius:5px;">
                <span>${p.name} - $${p.price} (${p.category})</span>
            </div>
            <button onclick="deleteProduct('${p.id}')">Eliminar</button>
        `;
        container.appendChild(div);
    });
}

// Eliminar producto
async function deleteProduct(id){
    if(!confirm("¿Seguro que deseas eliminar este producto?")) return;
    const res = await fetch(`http://localhost:4000/api/products/${id}`,{ method:'DELETE' });
    const result = await res.json();
    alert(result.message);
    loadProducts();
}

// Cargar al inicio
loadProducts();
