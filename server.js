const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const port = 3019;

const app = express();
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/Helpinghands')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

const db = mongoose.connection;
db.once('open', () => {
    console.log('Database connection opened.');
});

// Define user schema and model
const userSchema = new mongoose.Schema({
    Name: { type: String, required: true },
    Mobile: { type: String, required: true },
    donation: { type: String, required: true },
    Address: { type: String, required: true },
    Message: { type: String, required: true }
});

const Users = mongoose.model('donordetails', userSchema);

// Route to serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route to handle form submission
app.post('/submit', async (req, res) => {
    try {
        console.log('Received form data:', req.body); // Log received form data
        const { Name, Mobile, donation, Address, Message } = req.body;

        // Validate form data
        if (!Name || !Mobile || !donation || !Address || !Message) {
            console.log('Validation failed:', req.body);
            return res.status(400).send('All fields are required.');
        }

        // Create a new user instance
        const user = new Users({
            Name,
            Mobile,
            donation,
            Address,
            Message
        });

        // Save the user to the database
        await user.save();
        console.log('User saved:', user);

        // Send success response
        res.send('Your donation details have been submitted successfully. We will get in touch with you soon to collect your donation.');
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).send('There was an error processing your request. Please try again later.');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
