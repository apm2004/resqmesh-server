require('dotenv').config({path:'.env'});
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async()=>{
  console.log('=== DATABASE ===');
  console.log('Name:', mongoose.connection.db.databaseName);
  const cols = await mongoose.connection.db.listCollections().toArray();
  console.log('\n=== COLLECTIONS ===');
  for(const c of cols){
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log('  -', c.name, ':', count, 'docs');
  }
  await mongoose.disconnect();
}).catch(e=>console.error(e.message));
