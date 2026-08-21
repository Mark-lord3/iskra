import mongoose from 'mongoose';

export async function connectDB(uri){
  if(!uri) throw new Error('MONGODB_URI is not set — copy server/.env.example to server/.env');
  const dbName = new URL(uri.replace('mongodb+srv://','https://')).pathname.replace('/','');
  if(!dbName) throw new Error('MONGODB_URI must end with a database name (e.g. /iskra_promo) so this app stays isolated from your other projects');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('  ✓ MongoDB connected → database "%s"', mongoose.connection.name);
  return mongoose.connection;
}
