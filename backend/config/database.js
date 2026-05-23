const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brazasmar';

async function connectDatabase() {
    mongoose.set('strictQuery', true);

    await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000
    });

    console.log(`🍃 MongoDB conectado: ${mongoose.connection.name}`);
}

module.exports = { connectDatabase, MONGODB_URI };
