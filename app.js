// Required dependencies
const createError = require('http-errors'); // For creating HTTP errors
const express = require('express'); // Express web framework
const path = require('path'); // Utility for handling file and directory paths
const cookieParser = require('cookie-parser'); // Parse Cookie header and populate req.cookies
const logger = require('morgan'); // HTTP request logger middleware
const multer = require('multer'); // Middleware for handling multipart/form-data (file uploads)
const vision = require('@google-cloud/vision'); // Google Cloud Vision API client library

const app = express(); // Create an Express application

// Middleware configuration
app.use(logger('dev')); // Log requests to the console
app.use(express.json()); // Parse incoming JSON requests
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded payloads
app.use(cookieParser()); // Parse cookies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from "public" folder

// Multer configuration - store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Route: Home page with upload form
app.get('/', (req, res) => {
  // Sends a basic HTML form for uploading an image
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Image Label Detection</title>
      <style>
        /* Embedded CSS for styling the form */
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(to right,rgb(202, 167, 183));
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #333;
        }
        .container {
          background-color: #FFB6C1;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          text-align: center;
          width: 100%;
          max-width: 500px;
        }
        h1 {
          margin-bottom: 20px;
          color: #355E3B;
        }
        form {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        input[type="file"] {
          margin-bottom: 20px;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 6px;
          width: 100%;
        }
        input[type="submit"] {
          background-color:rgb(95, 181, 136);
          border: none;
          color: white;
          padding: 12px 24px;
          font-size: 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }
        input[type="submit"]:hover {
          background-color:rgb(227, 243, 168);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Please Upload an Image to Process</h1>
        <form action="/uploadImage" method="POST" enctype="multipart/form-data">
          <input type="file" name="file" accept="image/*" required />
          <input type="submit" value="Click to Process" />
        </form>
      </div>
    </body>
    </html>
  `);
});

// Route: Handle image upload and label detection
app.post('/uploadImage', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.send({ success: false, message: 'No file uploaded' });
    }

    // Get image buffer from uploaded file
    const imageBuffer = req.file.buffer;

    // Call Google Cloud Vision to detect labels
    const labels = await detectLabels(imageBuffer);

    // Convert image to Base64 for embedding directly in HTML
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const imageSrc = `data:${mimeType};base64,${imageBase64}`;

    // Render result HTML page with labels and image
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Label Detection Results</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
          /* Styling the results page */
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
            background: rgb(202, 167, 183);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
          }
          .results {
            background: #fff;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            max-width: 600px;
            width: 90%;
            animation: fadeIn 0.4s ease-in-out;
          }
          h1 {
            margin-bottom: 24px;
            color: #333;
            font-size: 24px;
          }
          img {
            max-width: 100%;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          ul {
            list-style: none;
            padding: 0;
            margin: 0;
            text-align: left;
          }
          li {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
            font-size: 16px;
            color: #444;
          }
          a {
            display: inline-block;
            margin-top: 24px;
            text-decoration: none;
            background-color: #ff6f91;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            transition: background-color 0.3s ease;
          }
          a:hover {
            background-color: #e85c7a;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        </style>
      </head>
      <body>
        <div class="results">
          <h1>Detected Labels</h1>
          <img src="${imageSrc}" alt="Uploaded Image" />
          <ul>
          <pre style="font-family: monospace;">
          ${labels.map(label => {
            const desc = label.description.trim();
            const score = (label.score * 100).toFixed(2);
            return `${desc} -> ${score}%`;
          }).join('\n')}
          </pre>
          </ul>
          <a href="/">Upload Next Image</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    // Handle unexpected errors
    console.error(error);
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Google Cloud Vision API call
async function detectLabels(imageBuffer) {
  const client = new vision.ImageAnnotatorClient(); // Create a new Vision API client
  const request = {
    image: {
      content: imageBuffer.toString('base64') // Convert image to base64 format
    }
  };
  const [result] = await client.labelDetection(request); // Make label detection request
  return result.labelAnnotations || []; // Return the list of detected labels
}

// Catch-all route for 404 Not Found
app.use((req, res, next) => next(createError(404)));

// Error handler middleware
app.use((err, req, res, next) => {
  res.status(err.status || 500).send(`<h1>Error</h1><p>${err.message}</p>`);
});

// Start server on defined port (default: 8080)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Export app for external use (e.g., testing)
module.exports = app;