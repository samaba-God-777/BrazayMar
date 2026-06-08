const mongoose = require('mongoose');

const daySchema = new mongoose.Schema(
    {
        day: { type: String, required: true },
        open: { type: String, default: '' },
        close: { type: String, default: '' },
        closed: { type: Boolean, default: false }
    },
    { _id: false }
);

const contactSchema = new mongoose.Schema(
    {
        singleton: { type: String, default: 'main', unique: true, index: true },
        businessName: { type: String, default: 'Brazas$Mar' },
        tagline: { type: String, default: 'Sabor auténtico a la brasa, directo a tu puerta.' },
        phone: { type: String, default: '+507 6978-8286' },
        whatsapp: { type: String, default: '50769788286' },
        email: { type: String, default: 'contacto@brazasmar.local' },
        address: { type: String, default: 'Darién, Metetí' },
        mapsUrl: { type: String, default: '' },
        hours: { type: [daySchema], default: () => ([
            { day: 'Lunes', open: '11:00', close: '22:00' },
            { day: 'Martes', open: '11:00', close: '22:00' },
            { day: 'Miércoles', open: '11:00', close: '22:00' },
            { day: 'Jueves', open: '11:00', close: '22:00' },
            { day: 'Viernes', open: '11:00', close: '23:00' },
            { day: 'Sábado', open: '11:00', close: '23:00' },
            { day: 'Domingo', open: '11:00', close: '22:00' }
        ])},
        facebook: { type: String, default: '' },
        instagram: { type: String, default: '' },
        tiktok: { type: String, default: '' },
        updatedAt: { type: Date, default: Date.now }
    },
    { versionKey: false }
);

const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

module.exports = { Contact };
