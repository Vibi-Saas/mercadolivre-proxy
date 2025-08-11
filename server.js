import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// Rota raiz para saber se o servidor está no ar
app.get('/', (_req, res) => {
  res.send('Servidor de Diagnóstico está funcionando.');
});

// Rota para buscar produtos (versão mais simples possível, sem token)
app.get('/api/search', async (req, res) => {
  try {
    const params = new URLSearchParams(req.query);
    const category = params.get('category') || 'MLB1000';
    const limit = params.get('limit') || '10';
    const sort = params.get('sort') || 'sold_quantity_desc';

    const mlURL = `https://api.mercadolibre.com/sites/MLB/search?category=${category}&limit=${limit}&sort=${sort}`;

    // Chamada pública, sem token, simulando um navegador
    const response = await fetch(mlURL);
    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro em /api/search:', error);
    res.status(500).json({ error: 'Erro interno no servidor proxy.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de Diagnóstico rodando na porta ${PORT}`);
});
