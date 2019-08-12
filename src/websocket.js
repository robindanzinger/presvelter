const WSS = require('websocket').server
const http = require('http')

function init () {
  console.log('start websocket')
  const server = http.createServer()
  server.listen(3003)

  const wss = new WSS({
    httpServer: server,
    autoAcceptConnections: false
  })

  const connections = []

  wss.on('request', request => {
    const connection = request.accept('presentation', request.origin)
    connections.push(connection)

    connection.on('message', message => {
      const data = JSON.parse(message.utf8Data)

      switch (data.type) {
        case 'join':

          break
        case 'update':
          connections.forEach(c => {
            if (c === connection) {
              console.log('ignore', data)
            } else {
              console.log('send', data)
              c.send(JSON.stringify(data))
            }
          })
          break
      }
    })
  })
}

module.exports = init
