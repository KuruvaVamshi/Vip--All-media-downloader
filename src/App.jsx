import { useState, useRef, useEffect } from 'react';
import { Download, Link as LinkIcon, Music, Video, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import './index.css';

function App() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4'); // 'mp4' or 'mp3'
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [speed, setSpeed] = useState('');
  const [eta, setEta] = useState('');
  
  const [resultUrl, setResultUrl] = useState(null);
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleDownload = (e) => {
    e.preventDefault();
    if (!url) return;

    // Reset state
    setIsProcessing(true);
    setProgress(0);
    setStatusMessage('Initializing download...');
    setSpeed('');
    setEta('');
    setResultUrl(null);
    setError(null);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiUrl = import.meta.env.PROD 
      ? '/api/download-stream' 
      : 'http://localhost:3000/api/download-stream';
      
    const streamUrl = `${apiUrl}?url=${encodeURIComponent(url)}&format=${format}`;
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.status === 'starting' || data.status === 'processing' || data.status === 'merging') {
          setStatusMessage(data.message);
          if (data.progress) setProgress(data.progress);
        } else if (data.status === 'downloading') {
          setStatusMessage('Downloading...');
          setProgress(data.progress);
          if (data.speed) setSpeed(data.speed);
          if (data.eta) setEta(data.eta);
        } else if (data.status === 'completed') {
          setStatusMessage('Complete!');
          setProgress(100);
          setResultUrl(data.fileUrl);
          setIsProcessing(false);
          es.close();
          
          // Trigger the download automatically
          triggerDownload(data.fileUrl);
        } else if (data.status === 'error') {
          setError(data.details ? `${data.message}\n\nDetails: ${data.details}` : data.message || 'An error occurred.');
          setIsProcessing(false);
          es.close();
        }
      } catch (err) {
        console.error('Error parsing SSE:', err);
      }
    };

    es.onerror = () => {
      setError('Connection lost. Please try again.');
      setIsProcessing(false);
      es.close();
    };
  };

  const triggerDownload = (fileUrl) => {
    const backendUrl = import.meta.env.PROD ? '' : 'http://localhost:3000';
    const a = document.createElement('a');
    a.href = `${backendUrl}${fileUrl}`;
    a.download = ''; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <div className="app-background">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <main className="glass-panel main-container">
        <div className="header-section">
          <h1 className="title-gradient">VIP-Any Media</h1>
          <p className="subtitle">
            Download highest quality video (1080p+) and audio from YouTube, Instagram, Twitter & more. Free, fast, deployable.
          </p>
        </div>

        <form onSubmit={handleDownload} className="download-form">
          <div className="input-group">
            <div className="input-wrapper">
              <LinkIcon className="input-icon" size={20} />
              <input
                type="url"
                className="url-input"
                placeholder="Paste any media link here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isProcessing}
                required
              />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={isProcessing || !url}>
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing
                </>
              ) : (
                <>
                  <Download size={20} />
                  Fetch
                </>
              )}
            </button>
          </div>

          <div className="toggle-container">
            <button
              type="button"
              className={`btn toggle-btn ${format === 'mp4' ? 'active' : ''}`}
              onClick={() => setFormat('mp4')}
              disabled={isProcessing}
            >
              <Video size={18} /> MP4 Video
            </button>
            <button
              type="button"
              className={`btn toggle-btn ${format === 'mp3' ? 'active' : ''}`}
              onClick={() => setFormat('mp3')}
              disabled={isProcessing}
            >
              <Music size={18} /> MP3 Audio
            </button>
          </div>
        </form>

        {error && (
          <div className="error-message fade-in">
            <AlertCircle size={20} className="error-icon" />
            <p>{error}</p>
          </div>
        )}

        {isProcessing && (
          <div className="progress-container fade-in">
            <div className="progress-header">
              <span className="progress-status">{statusMessage}</span>
              <span className="progress-percentage">{progress.toFixed(1)}%</span>
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            {(speed || eta) && (
              <div className="progress-stats">
                {speed && <span>Speed: {speed}</span>}
                {eta && <span>ETA: {eta}</span>}
              </div>
            )}
          </div>
        )}

        {resultUrl && !isProcessing && (
          <div className="success-container fade-in">
            <CheckCircle2 size={48} className="success-icon" />
            <h3>Download Ready!</h3>
            <p>Your download should have started automatically.</p>
            <button 
              type="button" 
              className="btn btn-secondary mt-4" 
              onClick={() => triggerDownload(resultUrl)}
            >
              <Download size={18} /> Click here to download again
            </button>
          </div>
        )}
      </main>
    </>
  );
}

export default App;
