require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')


const port = process.env.PORT || 5000
const app = express()
// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())


const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token

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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nnldx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})
async function run() {
    try {


        const userCollection = client.db('MangeMate').collection('users');
        const assetCollection = client.db('MangeMate').collection('assets');
        const requestCollection = client.db('MangeMate').collection('requests');








        // Generate jwt token
        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
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
            } catch (err) {
                res.status(500).send(err)
            }
        })





        // User------------------------------------------------>
        app.post('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = req.body;

            // Hash password before saving (if provided)
            if (user.password) {
                const hashedPassword = await bcrypt.hash(user.password, 10);
                user.password = hashedPassword;
            }

            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send(isExist); // Return the existing user
            }

            const result = await userCollection.insertOne({
                ...user,
                timestamp: Date.now(),
            });
            res.send(result);
        });
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email
            const result = await userCollection.findOne({ email })
            res.send({ role: result?.role })
        })
        // Get user by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send(user);
        });
        app.get('/my-hr-email/:email', async (req, res) => {
            const email = req.params.email;

            try {
                const user = await userCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({
                        success: false,
                        message: 'User not found',
                    });
                }

                res.send({
                    success: true,
                    hrEmail: user.hrEmail || "", // যদি না থাকে তাহলে খালি স্ট্রিং দিবে
                });
            } catch (error) {
                console.error("Error fetching hrEmail:", error);
                res.status(500).send({
                    success: false,
                    message: 'Failed to fetch hrEmail',
                    error: error.message,
                });
            }
        });


        app.get('/team-members/:hrEmail', async (req, res) => {
            const hrEmail = req.params.hrEmail;

            try {
                // HR email দিয়ে ইউজারদের খুঁজুন
                const users = await userCollection.find({ hrEmail }).toArray();

                if (!users || users.length === 0) {
                    return res.status(404).send({
                        success: false,
                        message: 'No team members found for this HR email',
                    });
                }

                res.send({
                    success: true,
                    members: users.map(user => ({
                        name: user.name,
                        email: user.email,
                        dob: user.dob,
                        role: user.role,
                        status: user.status,
                    })),
                });
            } catch (error) {
                console.error("Error fetching team members:", error);
                res.status(500).send({
                    success: false,
                    message: 'Failed to fetch team members',
                    error: error.message,
                });
            }
        });







        // Example backend endpoint to check HR's allowed and current employees
        app.get('/hr-employee-limit/:email', async (req, res) => {
            const email = req.params.email;

            const hrUser = await userCollection.findOne({ email });

            if (!hrUser || hrUser.role !== 'hr') {
                return res.status(404).send({ message: 'HR user not found' });
            }

            const totalAllowed = parseInt(hrUser.packageType) || 0;

            // Count how many employees are approved by this HR
            const currentEmployees = await userCollection.countDocuments({
                hrEmail: email,
                role: 'employee',
            });

            res.send({ totalAllowed, currentEmployees });
        });
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })
        app.get('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.findOne(query)
            res.send(result)
        })
        app.get('/requested-user', async (req, res) => {
            try {
                // শুধু যাদের status 'requested' তাদেরই আনবে
                const query = { status: 'requested' };

                // MongoDB থেকে সেই ইউজারদের আনা
                const requestedUsers = await userCollection.find(query).toArray();

                // সফলভাবে পাঠানো
                res.send({
                    success: true,
                    message: 'Requested users fetched successfully',
                    data: requestedUsers,
                });
            } catch (error) {
                // কোনো সমস্যা হলে error পাঠানো
                res.status(500).send({
                    success: false,
                    message: 'Failed to fetch requested users',
                    error: error.message,
                });
            }
        });
        app.patch('/approve-user/:userId', async (req, res) => {
            const { userId } = req.params;
            const { hrEmail } = req.body;

            try {
                // Check if the user is already approved
                const existingUser = await userCollection.findOne({ _id: new ObjectId(userId) });

                if (!existingUser) {
                    return res.status(404).send({
                        success: false,
                        message: 'User not found',
                    });
                }

                if (existingUser.role === 'employee') {
                    return res.status(400).send({
                        success: false,
                        message: 'User is already approved by another HR',
                        hrEmail: existingUser.hrEmail, // Optional: Return who approved
                    });
                }

                // Approve the user now
                const updatedUser = await userCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    {
                        $set: {
                            role: 'employee',
                            hrEmail: hrEmail,
                        },
                    }
                );

                res.send({
                    success: true,
                    message: 'User approved successfully',
                });
            } catch (error) {
                console.error("Approve user error:", error);
                res.status(500).send({
                    success: false,
                    message: 'Failed to approve user',
                    error: error.message,
                });
            }
        });

        app.get('/my-employ', async (req, res) => {
            const { hrEmail } = req.query;
            const employees = await userCollection.find({ hrEmail }).toArray();
            res.send({ success: true, data: employees });
        });



        // CANCEL EMPLOY API
        app.patch('/cancel-employ/:id', async (req, res) => {
            const { id } = req.params;

            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            role: "",   // role ফাঁকা করে দিচ্ছি
                            hrEmail: "", // HR email ও ফাঁকা করে দিচ্ছি
                        },
                    }
                );

                res.send({
                    success: true,
                    message: "Employee role removed successfully.",
                });
            } catch (error) {
                console.error("Error cancelling employee:", error);
                res.status(500).send({
                    success: false,
                    message: "Failed to cancel employee.",
                    error: error.message,
                });
            }
        });









        // Assets ----------------------------------------------->

        app.get('/assets/hr', verifyToken, async (req, res) => {
            const email = req.user.email
            const result = await assetCollection.find({ 'hr.email': email }).toArray()
            res.send(result)
        })
        // delete a assets from db by hr
        app.delete('/assets/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assetCollection.deleteOne(query)
            res.send(result)
        })
        app.put("/assets/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;

            const filter = { _id: new ObjectId(id) };

            const updatedDoc = {
                $set: {
                    assetsName: updatedProduct.assetsName,
                    assetsType: updatedProduct.assetsType,
                    quantity: parseInt(updatedProduct.quantity),
                },
            };

            try {
                const result = await assetCollection.updateOne(filter, updatedDoc);

                if (result.modifiedCount > 0) {
                    res.status(200).json({ message: "Product updated successfully!" });
                } else {
                    res.status(400).json({ message: "No changes made to the product." });
                }
            } catch (error) {
                console.error("Error updating product:", error);
                res.status(500).json({ message: "An error occurred while updating the product." });
            }
        });

        app.post('/assets', verifyToken, async (req, res) => {
            const assets = req.body;
            const result = await assetCollection.insertOne(assets)
            res.send(result)
        })
        // get all assets data in db
        app.get('/assets', async (req, res) => {
            const result = await assetCollection.find().toArray()
            res.send(result)
        })
        app.get('/assets/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await assetCollection.findOne(query)
            res.send(result)
        })




        // Request -------------------------------------------------->




        app.post('/requests', verifyToken, async (req, res) => {
            const assets = req.body;
            assets.date = new Date();
            const result = await requestCollection.insertOne(assets);
            res.send(result);
        });

        app.get('/assets', async (req, res) => {
            const result = await assetCollection.find().toArray()
            res.send(result)
        })
        // Manage assets quantity
        app.patch('/assets/quantity/:id', async (req, res) => {
            const id = req.params.id;
            const { quantityToUpdate, status } = req.body;

            const event = await assetCollection.findOne({ _id: new ObjectId(id) });
            if (!event) {
                return res.status(404).send({ message: 'Event not found' });
            }

            let newQuantity = event.quantity;

            if (status === 'decrease') {
                if (newQuantity > 0) {
                    newQuantity -= quantityToUpdate;
                } else {
                    return res.send({ message: 'Quantity already 0' });
                }
            } else if (status === 'increase') {
                newQuantity += quantityToUpdate;
            }

            const result = await assetCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { quantity: newQuantity } }
            );

            if (result.modifiedCount > 0) {
                res.send({ message: 'Quantity updated successfully' });
            } else {
                res.send({ message: 'No change in quantity' });
            }
        });
        // Get all   Request  for a specific employ
        app.get('/employ-request/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { 'employ.email': email }
            const result = await requestCollection.aggregate([
                {
                    $match: query
                },
                {
                    $addFields: {

                        assetId: { $toObjectId: '$requestId' } // ✅ এটা ঠিক করা হয়েছে
                    }
                },
                {
                    $lookup: {
                        from: 'assets',
                        localField: 'assetId',
                        foreignField: '_id',
                        as: 'assets'
                    }
                },
                { $unwind: '$assets' },
                {
                    $addFields: {
                        name: '$assets.assetsName',
                        companyName: '$assets.companyName'
                    }
                },
                {
                    $project: {
                        assets: 0,
                    }
                }

            ]).toArray()

            res.send(result)
        })
        // // Get all   Request  for a specific hr
        app.get('/hr-request/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { assetsOwner: email };

            try {
                const result = await requestCollection.aggregate([
                    { $match: query },
                    {
                        $addFields: {
                            assetId: { $toObjectId: '$requestId' } // ✅ এটা ঠিক করা হয়েছে
                        }
                    },
                    {
                        $lookup: {
                            from: 'assets',
                            localField: 'assetId',
                            foreignField: '_id',
                            as: 'assets'
                        }
                    },
                    { $unwind: '$assets' }, // slots অ্যারে খুলে ফেলা
                    {
                        $addFields: {
                            name: '$assets.assetsName',
                            companyName: '$assets.companyName'
                        }
                    },
                    {
                        $project: {
                            assets: 0,
                        }
                    }
                ]).toArray();

                res.send(result);
            } catch (error) {
                console.error("Error fetching customer bookings:", error);
                res.status(500).send({ message: "Server error" });
            }
        });
        // status update
        app.patch('/request/approve/:id', async (req, res) => {
            const id = req.params.id;
            const { approvalDate } = req.body;

            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        status: "approved",
                        approvalDate: approvalDate,
                    },
                };

                const result = await requestCollection.updateOne(filter, updateDoc);

                res.send(result);
            } catch (error) {
                console.error("Error approving request:", error);
                res.status(500).send({ message: "Failed to approve request" });
            }
        });
        // delete assets
        app.delete('/request/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const orders = await requestCollection.findOne(query)
            if (orders.status === 'approved') {
                res.status(409).send('Cannot cancel once the product is approved')
            }
            const result = await requestCollection.deleteOne(query)
            res.send(result)
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
    res.send('Hello from Mange Mate Server..')
})

app.listen(port, () => {
    console.log(`Mange Mate is running on port ${port}`)
})
