import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.get('/api/download-stream', (req, res) => {
  const { url, format } = req.query;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const jobId = crypto.randomUUID();
  const ext = format === 'mp3' ? 'mp3' : 'mp4';
  const outputPath = path.join(downloadsDir, `${jobId}.${ext}`);

  const ffmpegRelative = path.relative(process.cwd(), ffmpegStatic);
  const outputRelative = path.relative(process.cwd(), outputPath);

  const ytDlpPath = path.join(
    __dirname, 
    'node_modules', 
    'youtube-dl-exec', 
    'bin', 
    process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  );

  const args = [
    url,
    '--ffmpeg-location', ffmpegRelative,
    '--output', outputRelative,
    '--no-warnings'
  ];

  if (format === 'mp3') {
    args.push('--extract-audio', '--audio-format', 'mp3', '--format', 'bestaudio');
  } else {
    args.push('--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4');
  }

  sendEvent({ status: 'starting', message: 'Initializing download...', progress: 0 });

  const subprocess = spawn(ytDlpPath, args);

  subprocess.stdout.on('data', (data) => {
    const output = data.toString();
    // Try to parse progress from yt-dlp output
    // Example: [download]  45.3% of ~ 50.00MiB at  1.20MiB/s ETA 00:30
    const progressMatch = output.match(/\[download\]\s+([\d.]+)%/);
    const speedMatch = output.match(/at\s+([\d.]+)([a-zA-Z]+\/s)/);
    const etaMatch = output.match(/ETA\s+([\d:]+)/);

    if (progressMatch) {
      sendEvent({
        status: 'downloading',
        progress: parseFloat(progressMatch[1]),
        speed: speedMatch ? speedMatch[0].replace('at ', '').trim() : '',
        eta: etaMatch ? etaMatch[1] : '',
      });
    } else if (output.includes('[Merger]') || output.includes('Merging formats')) {
      sendEvent({ status: 'merging', message: 'Merging video and audio (this may take a moment)...', progress: 100 });
    } else if (output.includes('[ExtractAudio]')) {
      sendEvent({ status: 'processing', message: 'Extracting audio...', progress: 100 });
    }
  });

  subprocess.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  subprocess.on('close', (code) => {
    if (code === 0) {
      sendEvent({
        status: 'completed',
        message: 'Processing complete!',
        progress: 100,
        fileUrl: `/api/file/${jobId}.${ext}`,
      });
      res.end();
      
      // Cleanup file after 1 hour
      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      }, 60 * 60 * 1000);
    } else {
      console.error('Download error: yt-dlp exited with code', code);
      sendEvent({
        status: 'error',
        message: 'Failed to process media. The link might be unsupported, private, or rate-limited.',
        details: `Process exited with code ${code}`
      });
      res.end();
    }
  });

  subprocess.on('error', (err) => {
    console.error('Spawn error:', err.message);
    sendEvent({
      status: 'error',
      message: 'Failed to start download process.',
      details: err.message
    });
    res.end();
  });

  req.on('close', () => {
    // If client disconnects, kill the process to save resources
    if (!subprocess.killed) {
      subprocess.kill('SIGINT');
    }
  });
});

app.get('/api/file/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(downloadsDir, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, `VIP_Media_${filename}`, (err) => {
      if (err) console.error("Error sending file:", err);
    });
  } else {
    res.status(404).send('File not found or expired.');
  }
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, 'dist'))) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
