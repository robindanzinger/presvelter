const express = require('express')
const app = express()
const websocket = require('./src/websocket')
const port = 3000

app.use(express.static('public'))

app.get('/presentation/:topic/:slide', function (req, res) {
  const basicpage = `
   <!DOCTYPE HTML>
    <html>
      <head>
        <link rel='stylesheet' href='/bundle.css'>
      </head>
      <style>
        html, body {
          height: 100%;
          margin: 0px;
        }
      </style>
      <body>
        <script src='/bundle.js'></script>
      </body>
    </html>
  `
  res.send(basicpage)
})

app.get('/administration/:topic/:slide', function (req, res) {
  const basicpage = `
   <!DOCTYPE HTML>
    <html>
      <head>
        <link rel='stylesheet' href='/adminbundle.css'>
      </head>
      <style>
        html, body {
          height: 100%;
          margin: 0px;
        }
      </style>
      <body>
        <script src='/adminbundle.js'></script> 
      </body>
    </html>
  `
  res.send(basicpage)
})

app.listen(port, () => console.log(`Server listening on port ${port}!`))
websocket()
