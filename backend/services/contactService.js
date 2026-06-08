const { Contact } = require('../models/Contact');

function toClient(c) {
    if (!c) return null;
    return {
        businessName: c.businessName,
        tagline: c.tagline,
        phone: c.phone,
        whatsapp: c.whatsapp,
        email: c.email,
        address: c.address,
        mapsUrl: c.mapsUrl,
        hours: c.hours || [],
        facebook: c.facebook,
        instagram: c.instagram,
        tiktok: c.tiktok,
        updatedAt: c.updatedAt
    };
}

async function getContact() {
    let contact = await Contact.findOne({ singleton: 'main' }).lean();
    if (!contact) {
        const created = await Contact.create({ singleton: 'main' });
        contact = created.toObject();
    }
    return toClient(contact);
}

async function updateContact(data) {
    const fields = ['businessName', 'tagline', 'phone', 'whatsapp', 'email', 'address', 'mapsUrl', 'facebook', 'instagram', 'tiktok'];
    const update = { updatedAt: new Date() };
    for (const f of fields) {
        if (typeof data[f] === 'string') update[f] = data[f].trim();
    }
    if (Array.isArray(data.hours)) {
        update.hours = data.hours
            .filter((h) => h && typeof h === 'object' && h.day)
            .map((h) => ({
                day: String(h.day).trim(),
                open: h.open ? String(h.open).trim() : '',
                close: h.close ? String(h.close).trim() : '',
                closed: Boolean(h.closed)
            }));
    }
    const contact = await Contact.findOneAndUpdate(
        { singleton: 'main' },
        { $set: update, $setOnInsert: { singleton: 'main' } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return toClient(contact);
}

module.exports = { getContact, updateContact };
