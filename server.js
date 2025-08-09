import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 10000;

// variáveis de ambiente do Render
const {
  ML_ACCESS_TOKEN,       // access_token inicial (APP_USR-...)
  ML_REFRESH_TOKEN,      // refresh token (TG-...)
  ML_CLIENT_ID,          // 6265601993393948
  ML_CLIENT_SECRET       // sua chave secreta
} = process.env;

// vamos manter o token em memória e atualizar quando renovar
let accessToken = ML_ACCESS_TOKEN;

app.use(cors());

/**
 * Renova o access_token usando o refresh_token
 */
async function refreshAccessToken() {
  const url = 'https://api.mercadolibre.com/oauth/token';
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    refresh_token: ML_REFRESH_TOKEN
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Falha ao renovar token: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  accessToken = data.access_token;            // atualiza o token em memória
  return accessToken;
}

/**
 * Faz busca no ML, tentando renovar o token se necessário (401)
 */
async function mlSearch(params) {
  const base = 'https://api.mercadolibre.com/sites/MLB/search';
  const url = `${base}?${params.toString()}`;

  // 1ª tentativa com token atual
  let resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  // se o token estiver inválido/expirado, renova e tenta outra vez
  if (resp.status === 401) {
    await refreshAccessToken();
    resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }

  return resp;
}

/**
 * Endpoint de busca:
 * /api/search?q=celular&category=MLB1000&limit=10&sort=sold_quantity_desc
 */
app.get('/api/search', async (req, res) => {
  try {
    const { q, category, limit = '20', sort = 'sold_quantity_desc' } = req.query;

    const params = new URLSearchParams();
    if (q)        params.set('q', q);
    if (category) params.set('category', category);
    params.set('limit', String(limit));
    params.set('sort', String(sort));

    const resp = await mlSearch(params);

    if (!resp.ok) {
      const errorText = await resp.text();
      return res.status(resp.status).json({
        error: 'Erro ao buscar produtos',
        status: resp.status,
        details: errorText
      });
    }

    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('Erro /api/search:', err);
    res.status(500).json({ error: 'Falha interna' });
  }
});

/**
 * Callback OAuth: recebe ?code=... e troca por tokens (mostra na tela)
 * Use apenas para obter tokens inicialmente.
 */
app.get('/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      code,
      redirect_uri: 'https://mercadolivre-proxy.onrender.com/callback'
    });

    const tokenResp = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const tokens = await tokenResp.json();
    if (tokens.access_token) accessToken = tokens.access_token;

    res
      .status(200)
      .send(
        `<pre>Tokens recebidos

access_token (salve em ML_ACCESS_TOKEN no Render):
${tokens.access_token || ''}

refresh_token (salve em ML_REFRESH_TOKEN):
${tokens.refresh_token || ''}

Depois de salvar, teste: /api/search?q=celular&limit=5
</pre>`
      );
  } catch (e) {
    res.status(500).send(`Erro no /callback: ${e.message}`);
  }
});

// raiz
app.get('/', (_, res) => {
  res.send('Servidor proxy do Mercado Livre funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
feat: add Authorization header to /api/search
