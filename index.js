const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;

// middlewire
app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pdx5h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const menuCollections = client.db('bistroDB').collection('menu')
        const usersCollections = client.db('bistroDB').collection('users')
        const reviewsCollections = client.db('bistroDB').collection('reviews')
        const cartsCollections = client.db('bistroDB').collection('carts')
        
        // db operation

        // user related api
        app.post('/users', async(req,res)=>{
            const user = req.body;
            const result = await usersCollections.insertOne(user)
            res.send(result)
        })


        // get menu data 
        app.get('/menu', async(req,res)=>{
            const result = await menuCollections.find().toArray();
            res.send(result)
        })
        // reviews 
        app.get('/reviews', async(req,res)=>{
            const result = await reviewsCollections.find().toArray();
            res.send(result)
        })

           // all carts
        app.get('/carts',async (req,res)=>{
            const email = req.query.email;
            const query = {email : email}
            const result = await cartsCollections.find(query).toArray()
            res.send(result)
        })

        // carts collection
        app.post('/carts',async(req,res)=>{
            const cartItem = req.body;
            const result = await cartsCollections.insertOne(cartItem)
            res.send(result)
        })
        // delete cart item 
        app.delete('/carts/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id : new ObjectId(id)}
            const result = await cartsCollections.deleteOne(query)
            res.send(result)
        })

     

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('I om Bistro   ')

})

app.listen(port, () => {
    console.log(`port is running oon ${port}`);
})