import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Home: só pra ver que está vivo
app.get('/', (_req, res) => {
  res.send('Servidor proxy do Mercado Livre funcionando!');
});

/**
 * Rota de busca:
 * Ex.: /api/search?q=celular&limit=5
 *      /api/search?category=MLB1000&sort=sold_quantity_desc&limit=10
 */
app.get('/api/search', async (req, res) => {
  try {
    const { q, category, limit = '20', sort = 'sold_quantity_desc' } = req.query;

    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', String(category));
    params.set('limit', String(limit));
    params.set('sort', String(sort));

    const url = `https://api.mercadolibre.com/sites/MLB/search?${params.toString()}`;

    // *** AQUI ESTÁ O AJUSTE: envia o access token no header ***
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.ML_ACCESS_TOKEN}` }
    });

    if (!response.ok) {
      const details = await response.text();
      return res.status(response.status).json({
        error: 'Erro ao buscar produtos',
        status: response.status,
        details
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Erro /api/search:', err);
    res.status(500).json({ error: 'Falha ao buscar produtos' });
  }
});

/**
 * Callback OAuth:
 * Recebe ?code=... e mostra o access_token e refresh_token
 * (copie-os para as variáveis ML_ACCESS_TOKEN e ML_REFRESH_TOKEN no Render)
 */
app.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('code não informado');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code,
      redirect_uri: 'https://mercadolivre-proxy.onrender.com/callback'
    });

    const tokenResp = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const tokens = await tokenResp.json();

    res.type('text/plain').send(
`Tokens recebidos

access_token (salve em ML_ACCESS_TOKEN no Render):
${tokens.access_token || '(sem access_token)'}

refresh_token (salve em ML_REFRESH_TOKEN):
${tokens.refresh_token || '(sem refresh_token)'}

Depois de salvar, teste: /api/search?q=celular&limit=5`
    );
  } catch (e) {
    console.error('Erro /callback:', e);
    res.status(500).send('Erro ao processar callback');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
