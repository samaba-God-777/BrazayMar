const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Carpeta data y uploads
const dataDir = path.join(__dirname,'data');
if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const uploadsDir = path.join(__dirname,'uploads');
if(!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const menuPath = path.join(dataDir,'menu.json');
if(!fs.existsSync(menuPath)) fs.writeFileSync(menuPath, "[]");

// Multer configuración
const storage = multer.diskStorage({
    destination: function(req,file,cb){
        cb(null, uploadsDir);
    },
    filename: function(req,file,cb){
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: storage });

// Servir imágenes
app.use('/uploads', express.static(uploadsDir));

// --- GET menú ---
app.get('/api/menu', (req,res)=>{
    const menu = JSON.parse(fs.readFileSync(menuPath,'utf-8'));
    res.json(menu);
});

// --- POST agregar producto ---
app.post('/api/products', upload.single('image'), (req,res)=>{
    const { name, description, price, category } = req.body;
    if(!name || !description || !price || !category)
        return res.status(400).json({error:"Faltan datos"});

    const menu = JSON.parse(fs.readFileSync(menuPath,'utf-8'));
    const newProduct = {
        id: uuidv4(),
        name,
        description,
        price: parseFloat(price),
        category,
        image: req.file ? req.file.filename : ""
    };
    menu.push(newProduct);
    fs.writeFileSync(menuPath, JSON.stringify(menu,null,2));
    res.json({message:"Producto agregado", product:newProduct});
});

// --- DELETE producto ---
app.delete('/api/products/:id', (req,res)=>{
    const { id } = req.params;
    let menu = JSON.parse(fs.readFileSync(menuPath,'utf-8'));
    const product = menu.find(p=>p.id===id);
    if(!product) return res.status(404).json({error:"Producto no encontrado"});

    if(product.image){
        const imgPath = path.join(uploadsDir, product.image);
        if(fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    menu = menu.filter(p=>p.id!==id);
    fs.writeFileSync(menuPath, JSON.stringify(menu,null,2));
    res.json({message:"Producto eliminado"});
});

const PORT = 4000;
app.listen(PORT,()=>console.log(`Servidor corriendo en http://localhost:${PORT}`));
