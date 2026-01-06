const hamburguesasDiv = document.getElementById('hamburguesas');
const especialesDiv = document.getElementById('especiales');
const comboCerdoDiv = document.getElementById('combo-cerdo');
const cartDiv = document.getElementById('cart');
const totalDiv = document.getElementById('total');
const placeOrderBtn = document.getElementById('placeOrder');

let cart = [];

// --- Cargar menú automáticamente ---
async function loadMenu(){
    const res = await fetch('http://localhost:4000/api/menu');
    const menu = await res.json();

    hamburguesasDiv.innerHTML = '';
    especialesDiv.innerHTML = '';
    comboCerdoDiv.innerHTML = '';

    menu.forEach(item=>{
        const div = document.createElement('div');
        div.className="menu-item";
        div.innerHTML=`
            <img src="http://localhost:4000/uploads/${item.image}" alt="${item.name}">
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <p>$${item.price}</p>
            <button>Agregar</button>
        `;
        div.querySelector('button').addEventListener('click',()=>addToCart(item));

        if(item.category==="Hamburguesas") hamburguesasDiv.appendChild(div);
        else if(item.category==="Especiales") especialesDiv.appendChild(div);
        else if(item.category==="Combo Cerdo") comboCerdoDiv.appendChild(div);
    });
}

// --- Carrito ---
function addToCart(item){
    const existing = cart.find(i=>i.id===item.id);
    if(existing) existing.quantity +=1;
    else cart.push({...item, quantity:1});
    renderCart();
}

function renderCart(){
    cartDiv.innerHTML='';
    cart.forEach(item=>{
        const div = document.createElement('div');
        div.innerHTML = `<span>${item.name} x ${item.quantity} - $${item.price*item.quantity}</span> <button onclick="removeFromCart('${item.id}')">Eliminar</button>`;
        cartDiv.appendChild(div);
    });
    const total = cart.reduce((a,b)=>a+b.price*b.quantity,0);
    totalDiv.textContent = `Total: $${total}`;
}

function removeFromCart(id){
    cart = cart.filter(i=>i.id!==id);
    renderCart();
}

// --- Enviar pedido por correo ---
placeOrderBtn.addEventListener('click',()=>{
    if(cart.length===0) return alert("Agrega productos al carrito primero.");

    const customer = prompt("Ingrese su nombre:");
    const phone = prompt("Ingrese su teléfono:");
    const address = prompt("Ingrese su dirección:");
    if(!customer || !phone || !address) return alert("Datos incompletos.");

    let body=`Hola, soy ${customer}.\nMi pedido:\n`;
    cart.forEach(item=>body+=`- ${item.name} x ${item.quantity} = $${item.price*item.quantity}\n`);
    body+=`Total: $${cart.reduce((a,b)=>a+b.price*b.quantity,0)}\nDirección: ${address}\nTel: ${phone}`;

    const email = "dueno@brazasmar.com"; // Cambiar al correo real
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent("Nuevo pedido Brazas$Mar")}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
});

// --- Ejecutar al cargar la página ---
loadMenu();
