import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors()); // Libera o acesso para seu site na Hostinger

const PORT = process.env.PORT || 10000;
const ML_API_BASE = 'https://api.mercadolibre.com';

// Carrega as credenciais das variáveis de ambiente no Render
const {
  ML_CLIENT_ID,
  ML_CLIENT_SECRET,
  ML_REFRESH_TOKEN
} = process.env;

// O token de acesso será guardado em memória para ser reutilizado
let currentAccessToken = process.env.ML_ACCESS_TOKEN || null;

/**
 * Função para renovar o Access Token usando o Refresh Token.
 * Esta é a chave para o sistema funcionar a longo prazo.
 */
async function refreshAccessToken() {
  console.log('Tentando renovar o token de acesso...');
  if (!ML_REFRESH_TOKEN) {
    throw new Error('ML_REFRESH_TOKEN não está configurado no Render.');
  }

  const response = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      refresh_token: ML_REFRESH_TOKEN
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Falha ao renovar o token:', data);
    throw new Error('Não foi possível renovar o token de acesso.');
  }

  console.log('Token renovado com sucesso!');
  currentAccessToken = data.access_token; // Atualiza o token em memória
  return currentAccessToken;
}

/**
 * Função genérica para fazer chamadas à API do ML,
 * com tentativa de renovação automática do token.
 */
async function fetchMercadoLivre(endpoint) {
  if (!currentAccessToken) {
    await refreshAccessToken();
  }

  let response = await fetch(`${ML_API_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${currentAccessToken}` }
  });

  // Se o token expirou (401), renova e tenta de novo UMA vez.
  if (response.status === 401) {
    console.log('Token expirado. Tentando renovar e refazer a chamada.');
    await refreshAccessToken();
    response = await fetch(`${ML_API_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${currentAccessToken}` }
    });
  }

  return response;
}

// --- ROTAS DO PROXY ---

// Rota de diagnóstico para testar a validade do token
app.get('/api/me', async (_req, res) => {
  try {
    const response = await fetchMercadoLivre('/users/me');
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota principal para buscar produtos
app.get('/api/search', async (req, res) => {
  try {
    const params = new URLSearchParams(req.query);
    const response = await fetchMercadoLivre(`/sites/MLB/search?${params.toString()}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para o callback de autorização (você já usou, mantemos para o futuro)
app.get('/callback', (req, res) => {
    const code = req.query.code;
    res.send(`<h1>Callback Recebido</h1><p>Seu código de autorização é: <strong>${code}</strong></p><p>Use este código para obter o primeiro Refresh Token, se necessário.</p>`);
});

// Rota raiz para saber se o servidor está no ar
app.get('/', (_req, res) => {
  res.send('Servidor Proxy para Mercado Livre está funcionando. Use as rotas /api/me ou /api/search.');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
