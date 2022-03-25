const express = require('express')
const { MongoClient } = require('mongodb');
const cors = require('cors')
const admin = require("firebase-admin");
const ObjectId = require('mongodb').ObjectId;
const { json } = require('express');
const fileUpload = require('express-fileupload');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
var serviceAccount = require("./egypt-food-firebase-adminsdk.json")

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)

});

app.use(cors())
app.use(express.json())
app.use(fileUpload());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h7wek.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//verify token 
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}


async function run() {

    try {
        await client.connect()
        const database = client.db('egypt-foods')
        const foodsCollection = database.collection('foods')
        const booksCollection = database.collection('books')
        const usersCollection = database.collection('users')
        const orderCollection = database.collection('orders');
        // .sort({ _id: -1 })
        //Get foods API from here
        app.get('/foods', async (req, res) => {
            const cursor = foodsCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
        });

        app.post('/foods', async (req, res) => {
            const title = req.body.title;
            const description = req.body.description;
            const price = req.body.price;
            const image = req.body.image;
            const type = req.body.type;
            // const picData = pic.data;
            // const encodedPic = picData.toString('base64');
            // const imageBuffer = Buffer.from(encodedPic, 'base64');
            const food = {
                title,
                description,
                price,
                image,
                type,
            }
            const result = await foodsCollection.insertOne(food);
            res.json(result);
        })

        //UPDATE API
        app.put('/foods/:id', async (req, res) => {
            const id = req.params.id;
            const updatedUser = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    title: updatedUser.name,
                    description: updatedUser.description,
                    price: updatedUser.price,
                    image: updatedUser.image,
                    type: updatedUser.type
                },
            };
            const result = await foodsCollection.updateOne(filter, updateDoc, options)
            console.log('updating', id)
            res.json(result)
        })

        // DELETE API
        app.delete('/foods/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await foodsCollection.deleteOne(query);

            console.log('deleting food with id ', result);

            res.json(result);
        })


        // Use POST to get data by keys
        app.post('/foods/byKeys', async (req, res) => {
            const keys = req.body;
            const query = { key: { $in: keys } }
            const books = await booksCollection.find(query).toArray();
            res.send(books);
        });


        // Add Orders API
        app.get('/orders', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.decodedUserEmail === email) {
                const query = { email: email };
                const cursor = orderCollection.find(query);
                const orders = await cursor.toArray();
                res.json(orders);
            }
            else {
                res.status(401).json({ message: 'User not authorized' })
            }

        });

        app.post('/orders', async (req, res) => {
            const order = req.body;
            order.createdAt = new Date();
            const result = await orderCollection.insertOne(order);
            res.json(result);
        })

        //useremail

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });


        app.put('/users/admin', verifyToken, async (req, res) => {
            console.log('admin hitted')
            const user = req.body;
            console.log('request email', user)
            const requester = req.decodedEmail;
            console.log('Admin Email:', requester)
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    console.log(updateDoc)
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                    console.log(result)
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })

    }
    finally {

    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('egypt-foods')
});

app.listen(port, () => {
    console.log('Server running at port', port)
})
