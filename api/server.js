const http = require("http");
const url = require("url");
const proxy = require("./proxy");

const PORT = process.env.PORT || 3000;

// Create a server that uses our proxy function
const server = http.createServer(async (req, res) => {
  // Parse the URL to get query parameters
  const parsedUrl = url.parse(req.url, true);

  // Check if this is a request to our proxy endpoint
  if (parsedUrl.pathname === "/api/proxy") {
    // Pass the request to our proxy handler
    await proxy(
      {
        method: req.method,
        headers: req.headers,
        query: parsedUrl.query,
        connection: req.connection,
      },
      res
    );
  } else if (parsedUrl.pathname === "/") {
    // Send a simple HTML page for testing
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Image Proxy Tester</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            .container { margin-top: 20px; }
            img { max-width: 100%; border: 1px solid #ddd; margin-top: 10px; }
            input { width: 80%; padding: 8px; }
            button { padding: 8px 15px; background: #4CAF50; color: white; border: none; cursor: pointer; }
          </style>
        </head>
        <body>
          <h1>Image Proxy Tester</h1>
          <div class="container">
            <p>Enter an image URL from artsco202525.speedgabia.com:</p>
            <input type="text" id="imageUrl" placeholder="http://artsco202525.speedgabia.com/your-image-path.jpg">
            <button onclick="testProxy()">Test Proxy</button>
            <div id="result"></div>
          </div>
          
          <script>
            function testProxy() {
              const imageUrl = document.getElementById('imageUrl').value;
              if (!imageUrl) {
                alert('Please enter an image URL');
                return;
              }
              
              const resultDiv = document.getElementById('result');
              resultDiv.innerHTML = 'Loading...';
              
              const proxyUrl = '/api/proxy?url=' + encodeURIComponent(imageUrl);
              
              const img = new Image();
              img.onload = function() {
                resultDiv.innerHTML = '<p>Success! Image loaded via proxy:</p>';
                resultDiv.appendChild(img);
              };
              
              img.onerror = function() {
                resultDiv.innerHTML = '<p>Error loading image via proxy.</p>';
              };
              
              img.src = proxyUrl;
            }
          </script>
        </body>
      </html>
    `);
  } else {
    // Handle 404 for all other routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Test your proxy at http://localhost:${PORT}`);
});
