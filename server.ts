import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const BACKEND_PORT = 8000;

  app.use(express.json({ limit: '10mb' }));

  // Global request logger
  app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    next();
  });

  // Web Scraping Endpoint
  app.post('/api/fetch-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
      console.log(`[Scraper] Fetching: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Site returned ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove noise
      $('script, style, nav, footer, header, aside, form, svg, noscript, iframe, .cookie-banner, #cookie-consent, [role="dialog"]').remove();

      // Try to find common job board containers first to get cleaner text
      let contentElement: any = $('body');
      const jobContainers = [
        '.job-description', '#job-description', '.description', '#description',
        '.job-details', '#job-details', '[data-automation-id="jobPostingDescription"]',
        '.job-info', '.posting-description', '.job-post-content', '.job-content'
      ];

      for (const selector of jobContainers) {
        const found = $(selector);
        if (found.length > 0) {
          contentElement = found;
          break;
        }
      }

      // Extract text
      const text = contentElement.text();
      const cleanText = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      if (cleanText.length < 100) {
        // If we didn't find much in the container, fall back to body but with more aggressive cleaning
        const bodyText = $('body').text()
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .trim();
        
        if (bodyText.length < 100) {
          throw new Error('Could not extract meaningful text from this page. It might be protected or require JavaScript.');
        }
        
        return res.json({ content: bodyText.substring(0, 30000) });
      }

      res.json({ content: cleanText.substring(0, 30000) });
    } catch (error: any) {
      console.error('[Scraper Error]:', error);
      res.status(500).json({ 
        error: 'Failed to fetch job page', 
        detail: error.message,
        hint: 'Some sites block automated access. Try copying and pasting the text directly.'
      });
    }
  });

  console.log('Starting Python backend on port ' + BACKEND_PORT + '...');
  
  let pythonLogs = '';
  const startPython = (cmd: string) => {
    console.log(`Attempting to start Python backend with ${cmd} on port ${BACKEND_PORT}...`);
    const proc = spawn(cmd, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', BACKEND_PORT.toString(), '--log-level', 'debug'], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() }
    });

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Python] ${output}`);
      pythonLogs += `[STDOUT] ${output}\n`;
      if (pythonLogs.length > 10000) pythonLogs = pythonLogs.slice(-10000);
    });

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[Python Error] ${output}`);
      pythonLogs += `[STDERR] ${output}\n`;
      if (pythonLogs.length > 10000) pythonLogs = pythonLogs.slice(-10000);
    });

    proc.on('error', (err: any) => {
      console.error(`[Python Process Error with ${cmd}]`, err);
      console.error(`[Python Process Error Detail]`, JSON.stringify(err, null, 2));
      if (cmd === 'python3') {
        startPython('python');
      }
    });

    proc.on('exit', (code, signal) => {
      console.log(`[Python Exit with ${cmd}] Code: ${code}, Signal: ${signal}`);
    });

    return proc;
  };

  let pythonBackend = startPython('python3');

  // Express health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'full-stack-bridge' });
  });

  app.get('/health/logs', (req, res) => {
    res.type('text/plain').send(pythonLogs || 'No logs yet.');
  });

  app.get('/health/app-backend-v1', async (req, res) => {
    try {
      const response = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health`);
      const data = await response.json();
      res.json({ backend: data });
    } catch (err: any) {
      res.status(502).json({ error: 'Backend unreachable', detail: err.message });
    }
  });

  // Test endpoint to verify Express is reachable
  app.get('/test-proxy', (req, res) => {
    res.json({ status: 'ok', message: 'Express is reachable' });
  });

  // Proxy API requests to FastAPI
  app.use('/app-backend-v1', createProxyMiddleware({
    target: `http://127.0.0.1:${BACKEND_PORT}`,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Forwarding ${req.method} ${req.url} -> http://127.0.0.1:${BACKEND_PORT}${proxyReq.path}`);
        console.log(`[Proxy] Request Headers:`, JSON.stringify(req.headers, null, 2));
      },
      proxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] Received ${proxyRes.statusCode} from ${req.url}`);
        if (proxyRes.statusCode === 401) {
          console.error(`[Proxy 401] Headers:`, JSON.stringify(proxyRes.headers, null, 2));
        }
      },
      error: (err, req, res) => {
        console.error('[Proxy Error]', err);
        if (res && 'status' in res && typeof res.status === 'function') {
          res.status(502).json({ 
            error: 'Proxy Error', 
            detail: err.message,
            path: (req as any).originalUrl || req.url 
          });
        }
      },
    },
  }));

  // Catch-all for /app-backend-v1 to prevent fallthrough to Vite
  app.all('/app-backend-v1/*', (req, res) => {
    res.status(404).json({ 
      error: 'API Route Not Found', 
      detail: `The requested path ${req.url} was not handled by the backend proxy.`,
      path: req.url 
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-stack server running on http://localhost:${PORT}`);
    console.log(`Proxying /app-backend-v1 to http://localhost:${BACKEND_PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
