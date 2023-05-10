/// 获取在线设备列表
const message_request_app_list = 'request.app.list';
/// 绑定在线设备
const message_request_bind = 'request.bind.app';
/// 取消绑定
const message_request_unbind = 'request.unbind.app';
/// 注册在线设备
const message_request_register_app = 'request.register.app';
/// 注销在线设备
const message_request_unregister_app = 'request.unregister.app';
/// 转发设备消息
const message_forward_app_msg = 'forward.app.message';


// 载入 ws 库
const WebSocketServer = require('ws')
const port = 9988
// 创建一个 websocket 服务
const wss = new WebSocketServer.Server({ port: port })

let appClientSocketMap = new Map() // ip:socket
let webClientSocketMap = new Map() //ip:socket
let bindMap = new Map() //sender ip:receiver_ip1,receiver_ip2

function getClientId(socket) {
    return socket.remoteAddress
}

function onReceiveData(ws, clientId, data) {
    var obj = JSON.parse(data);
    console.log(`onReceiveData from ${clientId}: name=${obj.name}`)

    if (obj.name == message_request_register_app) {
        registerApp(ws, clientId, obj)
    } else if (obj.name == message_request_unregister_app) {
        unregisterApp(ws, clientId, obj)
    } else if (obj.name == message_request_bind) {
        bindApp(ws, clientId, obj)
    } else if (obj.name == message_request_unbind) {
        unbindApp(ws, clientId, obj)
    } else if (obj.name == message_request_app_list) {
        getAppClientList(ws, clientId, obj)
    } else if (obj.name == message_forward_app_msg) {
        forwardAppMessage(ws, clientId, obj)
    }
}

function registerApp(ws, clientId, obj) {
    appClientSocketMap.set(clientId, ws)
    var hasRegisterd = bindMap.has(clientId);
    console.log(`registerApp: ${clientId} hasRegisterd=${hasRegisterd}`)
    if (!hasRegisterd) {
        bindMap.set(clientId, new Set())
        console.log(`registerApp: ${clientId} success`)
        obj.success = true
        sendMessageToClient(ws, obj)
    }
}

function unregisterApp(ws, clientId, obj) {
    console.log(`unregisterApp : ${clientId}`)
    deleteAppClient(clientId, true)
    obj.success = true
    sendMessageToClient(ws, obj)
}


function bindApp(ws, clientId, obj) {
    var appClientId = obj.data.app
    console.log(`bindApp: appClientId=${appClientId} webClientId=${clientId}`)
    webClientSocketMap.set(clientId, ws)
    if (bindMap.has(appClientId)) {
        var set = bindMap.get(appClientId);
        set.add(clientId)
        console.log(`bindApp: ${clientId} success`)
        obj.success = true
        sendMessageToClient(ws, obj)
    }
}

function unbindApp(ws, clientId, obj) {
    console.log(`unbindApp: ${clientId}`)
    deleteWebClient(clientId, true)
    obj.success = true
    sendMessageToClient(ws, obj)
}

function getAppClientList(ws, clientId, obj) {
    var set = new Set()
    appClientSocketMap.forEach(function (value, key) {
        set.add(key)
    })
    obj.data = set
    obj.success = true
    sendMessageToClient(ws, obj)
}

function forwardAppMessage(ws, clientId, obj) {
    if (bindMap.has(clientId)) {
        var set = bindMap.get(clientId)
        for (var id of set) {
            // console.log(`forwardAppMessage: ${id}`)
            if (webClientSocketMap.has(id)) {
                // console.log(`sendMessageToWeb: ${id}`)
                var clientSocket = webClientSocketMap.get(id)
                sendMessageToClient(clientSocket, obj)
            }
        }
    }
}

function sendMessageToClient(ws, map) {
    var message = JSON.stringify(
        map,
        (_key, value) => (value instanceof Set ? [...value] : value),
    )
    ws.send(message)
}

function onClientClose(clientId) {
    console.log(`client close: ${clientId}`)
    if (appClientSocketMap.has(clientId)) {
        deleteAppClient(clientId, false)
    } else if (webClientSocketMap.has(clientId)) {
        deleteWebClient(clientId, false)
    }
}

function deleteAppClient(clientId, unbind) {
    console.log(`deleteApp: ${clientId}`)
    appClientSocketMap.delete(clientId)
    if (unbind) {
        bindMap.delete(clientId)
    }
}

function deleteWebClient(clientId, unbind) {
    console.log(`deleteWebClient: ${clientId}`)
    webClientSocketMap.delete(clientId)
    if (unbind) {
        bindMap.forEach(function (value, key) {
            value.delete(clientId)
        })
    }

}

function onClientError(clientId, error) {
    console.log(`client error: ${clientId} error=${error}`)
}

// 创建连接
wss.on("connection", (ws, req) => {
    const clientId = getClientId(req.socket)
    console.log(`client connected: ${clientId}`);
    ws.on("message", (data) => {
        onReceiveData(ws, clientId, data)
    })
    ws.on("close", () => {
        onClientClose(clientId)
    })
    ws.on("error", (error) => {
        onClientError(clientId, error)
    })
})

console.log(`server start success at port: ${port}`)