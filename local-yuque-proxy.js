const http = require('http');
const https = require('https');

const PORT = 3030;

const server = http.createServer((req, res) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}/`);

  // 只处理 /yuque/ 路径
  if (!url.pathname.startsWith('/yuque/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  const remainPath = url.pathname.slice('/yuque'.length) || '/';
  const targetUrl = 'https://pi2star.yuque.com' + remainPath + (url.search || '');

  const token = url.searchParams.get('token') || req.headers['x-auth-token'] || '';

  const options = {
    method: req.method,
    headers: {
      'X-Auth-Token': token,
      'User-Agent': 'Mozilla/5.0 (compatible; Proxy/1.0)',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  const proxy = https.request(targetUrl, options, (proxyRes) => {
    let data = [];
    proxyRes.on('data', chunk => data.push(chunk));
    proxyRes.on('end', () => {
      const body = Buffer.concat(data);
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      });
      res.end(body);
    });
  });

  proxy.on('error', (err) => {
    console.error('代理请求错误:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });

  // 转发请求体
  if (!['GET', 'HEAD'].includes(req.method)) {
    req.on('data', chunk => proxy.write(chunk));
    req.on('end', () => proxy.end());
  } else {
    proxy.end();
  }
});

server.listen(PORT, () => {
  console.log(`本地语雀代理服务已启动: http://localhost:${PORT}`);
  console.log(`直接请求语雀 API（国内可直连）`);
});