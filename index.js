const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 5000

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    console.log(token)
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iz3dvmk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})

async function run() {
    try {
        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })
        // Logout
        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })

        const medicineCollection = client.db('medzone').collection('medicine');
        const medicineCategory = client.db('medzone').collection('category');
        const usersCollection = client.db('medzone').collection('users')

        //This is the api for the banner and other components

        app.get('/medicine', async (req, res) => {
            try {
                const featuredMedicines = await medicineCollection.find().toArray();
                res.send(featuredMedicines);
            } catch (error) {
                console.error("Error fetching featured medicines:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });

        // getting individual category

        app.get('/category', async (req, res) => {

            try {
                const result = await medicineCategory.find().toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching featured medicines:", error);
                res.status(500).json({ error: "Internal server error" });
            }

        })

        //Save user in data base
        app.put('/user', async (req, res) => {
            const user = req.body
            const query = { email: user?.email }
            // check if user already exists in db
            const isExist = await usersCollection.findOne(query)
            if (isExist) {
                if (user.status === 'Requested') {
                    // if existing user try to change his role
                    const result = await usersCollection.updateOne(query, {
                        $set: { status: user?.status },
                    })
                    return res.send(result)
                } else {
                    // if existing user login again
                    return res.send(isExist)
                }
            }

            // save user for the first time
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...user,
                    timestamp: Date.now(),
                },
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        //Getting all the user info for admin only

        // get all users data from db
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        // Getting individual element from a certain category

        app.get('/UniqueCategory/:category', async (req, res) => {
            const category = req.params.category;

            try {

                const results = await medicineCollection.find({
                    category: category
                }).toArray();

                if (results.length === 0) {
                    res.status(404).send('No documents found');
                } else {
                    res.json(results);
                }
            } catch (error) {
                console.error('Error finding documents:', error);
                res.status(500).send('Internal Server Error');
            }
        })

        app.get('/allMedicines', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);

            const result = await medicineCollection.find()
                .skip(page * size)
                .limit(size)
                .toArray();
            res.send(result);
        })

        app.get('/productCount', async (req, res) => {
            const count = await medicineCollection.estimatedDocumentCount();
            res.send({ count });
        })


        // Send a ping to confirm a successful connection
        await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello from multi vendor server')
})

app.listen(port, () => {
    console.log(`multi vendor is running on port ${port}`)
})
