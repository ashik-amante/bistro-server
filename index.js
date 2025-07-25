const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRETKEY)

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
        const paymentCollections = client.db('bistroDB').collection('payment')

        // db operation
        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' })
            res.send({ token })

        })
        // middle wire
        // varify token 
        const varifyToken = (req, res, next) => {
            console.log('inside varify token ', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' })
                }
                req.decoded = decoded
                next()
            })
        }

        // verify admin 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded?.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next()
        }

        // user related api
        app.get('/users', varifyToken,verifyAdmin, async (req, res) => {

            const result = await usersCollections.find().toArray()
            res.send(result)
        })

        app.get('/users/admin/:email', varifyToken, async (req, res) => {
            const email = req.params.email;
            if (email != req.decoded.email) {
                return res.status(401).send({ message: 'unauthorize access' })
            }
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            let admin = false
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })

        app.delete('/users/:id',varifyToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await usersCollections.deleteOne(filter)
            res.send(result)
        })
        app.patch('/users/admin/:id',varifyToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollections.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnot exist
            const query = { email: user.email }
            const existUser = await usersCollections.findOne(query);
            if (existUser) {
                return res.send({ message: 'User already Exsit', insertedId: null })
            }
            const result = await usersCollections.insertOne(user)
            res.send(result)
        })


        // get menu data 
        app.get('/menu', async (req, res) => {
            const result = await menuCollections.find().toArray();
            res.send(result)
        })

        app.get('/menu/:id',async(req,res)=>{
            const id  = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await menuCollections.findOne(query)
            res.send(result)
        })


        app.post('/menu',varifyToken,verifyAdmin, async(req,res)=>{
            const item = req.body;
            const result = await menuCollections.insertOne(item)
            res.send(result)
        })

        app.patch('/menu/:id',async(req,res)=>{
            const id  = req.params.id;
            const item = req.body;
            const filter = { _id : new ObjectId(id)}
            const updatedDoc = {
                $set: {
                    name: item.name,
                    price: item.price,
                    category: item.category,
                    recipe: item.recipe,
                    image: item.image
                }
            }
            const result = await menuCollections.updateOne(filter,updatedDoc);
            res.send(result)
        })

        app.delete('/menu/:id', varifyToken,verifyAdmin, async(req,res)=>{
            const id = req.params.id;
            const query = {_id :new ObjectId(id)}
            const result = await menuCollections.deleteOne(query)
            res.send(result)
        })
        // reviews 
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollections.find().toArray();
            res.send(result)
        })

        // all carts
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cartsCollections.find(query).toArray()
            res.send(result)
        })

        // carts collection
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartsCollections.insertOne(cartItem)
            res.send(result)
        })
        // delete cart item 
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartsCollections.deleteOne(query)
            res.send(result)
        })

        // payment stripe
        // paynent intent

        app.post('/create-payment-intent', async (req,res)=>{
            const {price} = req.body;
            const amount = parseInt(price*100)
            console.log('amount' , amount);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency : 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret : paymentIntent.client_secret
            })
        })

        app.post('/payments', async(req,res)=>{
            const payment = req.body;
            const paymentResult = await paymentCollections.insertOne(payment)

            // care fully de;ete cart item
            const query = {_id: {
                $in: payment.cartIds.map(id=> new ObjectId(id))
            }}
            const deletResult = await cartsCollections.deleteMany(query)

            res.send({paymentResult,deletResult})
        })

        app.get('/payments/:email', varifyToken, async(req,res)=>{
            const email = req.params.email;
            const query = {email : email}
            if(email !== req.decoded.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const result = await paymentCollections.find(query).toArray()
            res.send(result)
        })

        // statistics
        app.get('/admin-stats',varifyToken,verifyAdmin, async(req,res)=>{
            const users = await usersCollections.estimatedDocumentCount()
            const menuItem = await menuCollections.estimatedDocumentCount()
            const orders = await paymentCollections.estimatedDocumentCount()
            // have better way
            // const payments = await paymentCollections.find().toArray()
            // const revinue = payments.reduce((total, payment)=> total+ payment.price ,0)
            

            // using group
            const result = await paymentCollections.aggregate([{
                 $group: {
                    _id: null,
                    totalRevinue: {
                        $sum : '$price'
                    }
                }
            }]).toArray()

            const revinue = result.length > 0 ? result[0].totalRevinue : 0;


            res.send({ users ,menuItem , orders, revinue})
        })

        // stats visualization using aggregate pipeline
        app.get('/order-stats',varifyToken,verifyAdmin, async(req,res)=>{
            const result = await paymentCollections.aggregate([
                {
                    $addFields:{
                        menuItemIds:{
                            $map:{
                                input: '$menuItemIds',
                                as: 'id',
                                in: {$toObjectId : '$$id'}
                            }
                        }
                    }
                },
                {
                    $unwind: "$menuItemIds"
                },

                {
                    $lookup: {
                        from: 'menu',
                        localField: 'menuItemIds',
                        foreignField: '_id',
                        as: 'menuItems'
                    }
                },
                {
                    $unwind: '$menuItems'
                },
                {
                    $group: {
                        _id: '$menuItems.category',
                        quantity: { $sum: 1},
                        revenue: {$sum: '$menuItems.price'}
                    }
                },
                {
                    $project:{
                        _id: 0,
                        category: '$_id',
                        quantity: '$quantity',
                        revenue: '$revenue'
                    }
                }
            ]).toArray()
            res.send(result)
        })




        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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

// const port = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;