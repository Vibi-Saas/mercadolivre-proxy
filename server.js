import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const ML_BASE = 'https://api.mercadolibre.com';
const REDIRECT_URI =
  process.env.ML_REDIRECT_URI || 'https://mercadolivre-proxy.onrender.com/callback';

// Ping
app.get('/', (_, res) => {
  res.json({ ok: true, service: 'mercadolivre-proxy', time: new Date().toISOString() });
});

/**
 * Troca `code` por tokens e exibe na tela
 * URL que você usa no navegador após logar no ML:
 * https://mercadolivre-proxy.onrender.com/callback?code=XXXXXXXX
 */
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).send('Faltou o parâmetro ?code=...');
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    });

    const r = await fetch(`${ML_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await r.json();

    if (!r.ok) {
      res
        .status(r.status)
        .send(
          `<pre>Falha ao trocar code por token\nStatus: ${r.status}\n${JSON.stringify(
            data,
            null,
            2
          )}</pre>`
        );
      return;
    }

    const html = `
      <pre>Tokens recebidos

access_token (salve em ML_ACCESS_TOKEN no Render):
${data.access_token}

refresh_token (salve em ML_REFRESH_TOKEN):
${data.refresh_token || '(não veio)'}

Depois de salvar, teste: /api/me  e /api/search?q=celular&limit=5
</pre>
    `;
    res.type('html').send(html);
  } catch (e) {
    res.status(500).send(`<pre>Erro em /callback:\n${String(e)}</pre>`);
  }
});

/**
 * Valida o token atual (mostra dados da conta se estiver válido)
 * Abra: https://mercadolivre-proxy.onrender.com/api/me
 */
app.get('/api/me', async (_req, res) => {
  try {
    const r = await fetch(`${ML_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${process.env.ML_ACCESS_TOKEN}`,
      },
    });

    const text = await r.text();
    res.status(r.status).type('application/json').send(text);
  } catch (e) {
    res.status(500).json({ error: 'Falha em /api/me', details: String(e) });
  }
});

/**
 * Busca de produtos com token no header
 * Exemplo: /api/search?q=celular&limit=5
 * Também aceita: category=MLB1000, sort=sold_quantity_desc
 */
app.get('/api/search', async (req, res) => {
  try {
    const { q, category, limit = '10', sort = 'sold_quantity_desc' } = req.query;

    const params = new URLSearchParams();
    if (q) params.set('q', String(q));
    if (category) params.set('category', String(category));
    params.set('limit', String(limit));
    params.set('sort', String(sort));

    const url = `${ML_BASE}/sites/MLB/search?${params.toString()}`;

    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.ML_ACCESS_TOKEN}`,
      },
    });

    const data = await r.json();

    if (!r.ok) {
      // retorna status real do ML (403/401) para ficar claro
      res.status(r.status).json({ error: 'Erro ao buscar produtos', status: r.status, details: data });
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos', details: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
