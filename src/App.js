import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThreeDots } from 'react-loader-spinner'; // Import the specific loader component

function App() {
  const [url, setUrl] = useState(''); // State for URL input
  const [images, setImages] = useState([]); // State for scraped images
  const [loading, setLoading] = useState(false); // State for loading spinner
  const [downloading, setDownloading] = useState(false); // State for downloading status

  // Function to handle scraping images from the provided URL
  const handleScrape = async () => {
    if (!url) {
      toast.error('Please enter a URL.');
      return;
    }

    setLoading(true); // Show loading spinner
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/scrape`,
        { url }
      );
      setImages(response.data.images); // Set scraped images
      toast.success('Images scraped successfully!');
    } catch (error) {
      console.error('Error scraping images:', error.message);
      toast.error('Failed to scrape images.');
    } finally {
      setLoading(false); // Hide loading spinner
    }
  };

  // Function to handle downloading images as a zip file
  const handleDownload = async () => {
    if (!images.length) {
      toast.error('No images available to download.');
      return;
    }

    setDownloading(true); // Show downloading state and change button text to 'Zipping...'
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/download`,
        { imageUrls: images },
        { responseType: 'blob' } // Important to receive the response as a blob
      );

      // Create a URL for the zip file blob and trigger download
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'images.zip'); // Set download file name
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Images downloaded successfully as a zip file!');
    } catch (error) {
      console.error('Error downloading images:', error.message);
      toast.error('Failed to download images.');
    } finally {
      setDownloading(false); // Reset downloading state and change button text back
    }
  };

  return (
    <div className="App">
      <ToastContainer position="top-center" autoClose={5000} />
      <h1>Photo Scraper</h1>
      <input
        type="text"
        placeholder="Enter website URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button onClick={handleScrape} disabled={loading}>
        {loading ? 'Scraping...' : 'Scrape Images'}
      </button>
      <button onClick={handleDownload} disabled={!images.length || downloading}>
        {downloading ? 'Zipping...' : 'Download Images as Zip'}
      </button>
      <div className="loader-container">
        {loading && (
          <ThreeDots color="#00BFFF" height={80} width={80} /> // Using ThreeDots loader component
        )}
      </div>
      <div className="image-grid">
        {images.map((image, index) => (
          <img key={index} src={image} alt={`Scraped ${index}`} />
        ))}
      </div>
    </div>
  );
}

export default App;
