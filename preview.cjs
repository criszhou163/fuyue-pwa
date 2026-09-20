const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname;
http.createServer((req,res)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
}).listen(8765,'127.0.0.1',()=>console.log('Preview: http://localhost:8765'));
