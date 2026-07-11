import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Initialize Postgres Pool
let pool: any = null;
const dbUrl = process.env.DATABASE_URL || '';

if (dbUrl && !dbUrl.includes('base') && dbUrl.startsWith('postgres')) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
}

// Local JSON Database Fallback (for zero-config experience)
const LOCAL_DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'local_jobs.json')
  : path.join(process.cwd(), 'local_jobs.json');

const getLocalJobs = async () => {
  try {
    const data = await fs.promises.readFile(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const saveLocalJobs = async (jobs: any[]) => {
  await fs.promises.writeFile(LOCAL_DB_PATH, JSON.stringify(jobs, null, 2));
};

let pgAuthFailed = false;
let pgAuthErrorMessage = '';

const isDbAvailable = () => {
  return !!pool && !pgAuthFailed;
};

// Initialize database table if needed
async function initDb() {
  if (!pool) {
    console.log('[Database] Configuration incomplete. Using Local JSON Database.');
    if (!fs.existsSync(LOCAL_DB_PATH)) await saveLocalJobs([]);
    return;
  }
  
  // Check for clear placeholders
  const url = process.env.DATABASE_URL || '';
  if (url.includes('username:password') || url.includes('YOUR_POSTGRES_URL')) {
    console.log('[Database] Placeholder URL detected. Using Local JSON Database.');
    if (!fs.existsSync(LOCAL_DB_PATH)) await saveLocalJobs([]);
    return;
  }

  try {
    // Test connection immediately with a direct client
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('[Postgres] Neural Link Established');
    } finally {
      client.release();
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(255),
        firestore_id VARCHAR(255) UNIQUE,
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        summary TEXT,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'saved',
        captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        extra_data JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_uid ON jobs(uid);
      CREATE INDEX IF NOT EXISTS idx_jobs_firestore_id ON jobs(firestore_id);
    `);
    console.log('[Postgres] Database initialized successfully');
  } catch (err: any) {
    if (err.message.includes('authentication failed')) {
      pgAuthFailed = true;
      pgAuthErrorMessage = err.message;
      console.log('[Postgres] Credentials Invalid. Configure DATABASE_URL for Postgres mode.');
    } else if (err.message.includes('ECONNREFUSED')) {
      pgAuthFailed = true;
      pgAuthErrorMessage = "Database host unreachable";
      console.log('[Postgres] Host Unreachable. Falling back to local storage.');
    } else {
      console.error('[Postgres] Structural Error:', err.message);
    }
    if (!fs.existsSync(LOCAL_DB_PATH)) await saveLocalJobs([]);
  }
}

initDb();

app.use(express.json({ limit: '10mb' }));

// Global request logger
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.url}`);
  next();
});

// API Router
const apiRouter = express.Router();

// Force JSON for all API routes to prevent HTML fall-through
apiRouter.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health check
apiRouter.get('/health', async (req, res) => {
  const url = process.env.DATABASE_URL || '';
  const isConfigured = !!url && !url.includes('base');
  const isPlaceholder = url.includes('username:password') || url.includes('YOUR_POSTGRES_URL');
  
  let connectionStatus = isDbAvailable() ? 'ready' : (pgAuthFailed ? 'authentication_failed' : 'using_local_fallback');
  let connectionError = pgAuthErrorMessage || null;
  let actualDbType = isDbAvailable() ? 'postgres' : 'json_lite';

  if (isDbAvailable() && pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        connectionStatus = 'connected';
      } finally {
        client.release();
      }
    } catch (err: any) {
      connectionStatus = 'connection_error';
      connectionError = err.message;
      actualDbType = 'json_lite_fallback';
    }
  }
  
  res.json({ 
    status: 'ok', 
    service: 'full-stack-bridge', 
    database: actualDbType,
    db_diagnostics: {
      present: isConfigured,
      is_placeholder: isPlaceholder,
      connection_status: connectionStatus,
      connection_error: connectionError,
      auth_failed: pgAuthFailed
    }
  });
});

// Web Scraping Endpoint
apiRouter.post('/fetch-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    console.log(`[Scraper] Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Site returned ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, footer, header, aside, form, svg, noscript, iframe').remove();

    const text = $('body').text().replace(/\s+/g, ' ').trim();
    res.json({ content: text.substring(0, 30000) });
  } catch (error: any) {
    console.error('[Scraper Error]:', error);
    res.status(500).json({ 
      error: 'Failed to fetch job page', 
      detail: error.message
    });
  }
});

// Tracking API
apiRouter.post('/tracking/jobs', async (req, res) => {
  const { uid, title, company, status, firestore_id, extra_data } = req.body;
  if (!uid || !title || !company) {
    return res.status(400).json({ error: 'uid, title, and company are required' });
  }

  const tryPostgres = async () => {
    const result = await pool.query(
      'INSERT INTO jobs (uid, title, company, status, firestore_id, extra_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [uid, title, company, status || 'saved', firestore_id, extra_data]
    );
    return result.rows[0];
  };

  const tryLocal = async () => {
    const jobs = await getLocalJobs();
    const newJob = {
      id: Date.now(),
      uid,
      title,
      company,
      status: status || 'saved',
      firestore_id,
      extra_data,
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    jobs.push(newJob);
    await saveLocalJobs(jobs);
    return newJob;
  };

  try {
    if (isDbAvailable()) {
      try {
        const record = await tryPostgres();
        return res.json(record);
      } catch (pgErr) {
        console.warn('[Postgres] Error, falling back to local:', pgErr);
        const record = await tryLocal();
        return res.json(record);
      }
    } else {
      const record = await tryLocal();
      return res.json(record);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

apiRouter.get('/tracking/jobs', async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: 'uid is required' });

  const tryPostgres = async () => {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE uid = $1 ORDER BY captured_at DESC',
      [uid]
    );
    return result.rows;
  };

  const tryLocal = async () => {
    const jobs = await getLocalJobs();
    return jobs.filter((j: any) => j.uid === uid)
      .sort((a: any, b: any) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
  };

  try {
    if (isDbAvailable()) {
      try {
        const records = await tryPostgres();
        return res.json(records);
      } catch (pgErr) {
        console.warn('[Postgres] Error, falling back to local:', pgErr);
        const records = await tryLocal();
        return res.json(records);
      }
    } else {
      const records = await tryLocal();
      return res.json(records);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

apiRouter.patch('/tracking/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const { status, firestore_id } = req.body;

  const tryPostgres = async () => {
    const result = await pool.query(
      'UPDATE jobs SET status = $1, firestore_id = COALESCE($2, firestore_id), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, firestore_id, id]
    );
    return result.rows[0];
  };

  const tryLocal = async () => {
    const jobs = await getLocalJobs();
    const index = jobs.findIndex((j: any) => String(j.id) === id);
    if (index === -1) return null;
    
    jobs[index] = {
      ...jobs[index],
      status: status || jobs[index].status,
      firestore_id: firestore_id || jobs[index].firestore_id,
      updated_at: new Date().toISOString()
    };
    await saveLocalJobs(jobs);
    return jobs[index];
  };

  try {
    if (isDbAvailable()) {
      try {
        const record = await tryPostgres();
        if (!record) return res.status(404).json({ error: 'Job not found' });
        return res.json(record);
      } catch (pgErr) {
        console.warn('[Postgres] Error, falling back to local:', pgErr);
        const record = await tryLocal();
        if (!record) return res.status(404).json({ error: 'Job not found' });
        return res.json(record);
      }
    } else {
      const record = await tryLocal();
      if (!record) return res.status(404).json({ error: 'Job not found' });
      return res.json(record);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

apiRouter.delete('/tracking/jobs/:id', async (req, res) => {
  const { id } = req.params;

  const tryPostgres = async () => {
    await pool.query('DELETE FROM jobs WHERE id = $1', [id]);
  };

  const tryLocal = async () => {
    const jobs = await getLocalJobs();
    const filtered = jobs.filter((j: any) => String(j.id) !== id);
    await saveLocalJobs(filtered);
  };

  try {
    if (isDbAvailable()) {
      try {
        await tryPostgres();
        return res.json({ message: 'Job deleted successfully' });
      } catch (pgErr) {
        console.warn('[Postgres] Error, falling back to local:', pgErr);
        await tryLocal();
        return res.json({ message: 'Job deleted successfully' });
      }
    } else {
      await tryLocal();
      return res.json({ message: 'Job deleted successfully' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Mount entire API router
app.use('/backend-v2060', apiRouter);

// Catch-all for /backend-v2060 (must be after router)
app.all('/backend-v2060/*', (req, res) => {
  console.warn(`[Express] Unmatched API path: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: 'API Route Not Found', 
    detail: `The path ${req.url} was not matched by any internal tracking or scraping routes.`,
    path: req.url 
  });
});

async function startServer() {
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
    console.log(`API routes available at /backend-v2060/tracking`);
  });
}

if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
