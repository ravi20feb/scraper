const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const archiver = require('archiver');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp'); // Import sharp for image conversion

const app = express();
const PORT = 3001;
const downloadDir = path.join(__dirname, 'downloads');

// Middleware
app.use(express.json());
app.use(cors());

// Helper function to sanitize file names
const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.]/g, '_');
};

// Helper function to download and save images locally
const downloadAndConvertImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(`Failed to download image: ${response.statusCode}`);
                return;
            }
            // Pipe the image data to a file
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    // Check if the file is a .webp image and convert it to .jpg
                    if (path.extname(filepath) === '.webp') {
                        const jpgFilePath = filepath.replace('.webp', '.jpg');
                        sharp(filepath)
                            .toFormat('jpeg')
                            .toFile(jpgFilePath, (err) => {
                                if (err) {
                                    reject(`Failed to convert image to JPG: ${err}`);
                                } else {
                                    // Delete the original .webp file after conversion
                                    fs.unlink(filepath, () => resolve(jpgFilePath));
                                }
                            });
                    } else {
                        resolve(filepath);
                    }
                });
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => reject(err.message));
        });
    });
};

// Scrape images from a website
app.post('/scrape', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    try {
        // Fetch the page content
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Find all image sources on the page
        const images = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !src.startsWith('data:')) {
                const absoluteUrl = src.startsWith('http') ? src : new URL(src, url).href;
                images.push(absoluteUrl);
            }
        });

        if (images.length === 0) {
            return res.status(404).json({ error: 'No images found on the page' });
        }

        res.json({ images });
    } catch (error) {
        console.error('Error scraping images:', error.message);
        res.status(500).json({ error: 'Failed to scrape images' });
    }
});

// Download images as a zip file
app.post('/download', async (req, res) => {
    const { imageUrls } = req.body;

    if (!imageUrls || !imageUrls.length) {
        return res.status(400).json({ error: 'No image URLs provided' });
    }

    try {
        // Create the downloads directory if it doesn't exist
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir);
        }

        // Download and convert all images locally
        const downloadPromises = imageUrls.map((url, index) => {
            let extension = path.extname(url);
            if (!extension || extension === '.webp') {
                extension = '.jpg'; // Save as .jpg by default
            }
            const fileName = sanitizeFilename(`image${index + 1}${extension}`);
            const filePath = path.join(downloadDir, fileName);
            return downloadAndConvertImage(url, filePath);
        });

        await Promise.all(downloadPromises);

        // Create a zip file of all downloaded images
        const zipFilePath = path.join(__dirname, 'images.zip');
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            res.download(zipFilePath, 'images.zip', (err) => {
                if (err) {
                    res.status(500).json({ error: 'Failed to download zip file.' });
                } else {
                    // Clean up: Delete the zip file and downloaded images after sending to client
                    fs.unlinkSync(zipFilePath);
                    fs.readdir(downloadDir, (err, files) => {
                        if (files && files.length > 0) {
                            files.forEach((file) => fs.unlinkSync(path.join(downloadDir, file)));
                        }
                    });
                }
            });
        });

        archive.on('error', (err) => {
            res.status(500).json({ error: 'Error creating zip file.' });
        });

        archive.pipe(output);

        // Append downloaded files to the zip archive
        fs.readdir(downloadDir, (err, files) => {
            files.forEach((file) => {
                archive.file(path.join(downloadDir, file), { name: file });
            });
            archive.finalize();
        });
    } catch (error) {
        console.error('Error downloading images:', error.message);
        res.status(500).json({ error: `Failed to download images. Reason: ${error.message}` });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
