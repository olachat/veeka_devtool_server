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
/// 转发app消息到web端
const message_forward_app_msg = 'forward.app.message';
/// 转发web端消息到app端
const message_forward_web_msg = 'forward.web.message';


// 载入 ws 库
const WebSocketServer = require('ws')
const port = 9988
// 创建一个 websocket 服务
const wss = new WebSocketServer.Server({ port: port })

let appClientSocketMap = new Map() // app_clientId:socket
let webClientSocketMap = new Map() //web_clientId:socket
let bindMap = new Map() //app_clientId:web_clientId1,web_clientId2
let appInfoMap = new Map() //app_clientId:appinfo

function getClientId(socket) {
    return socket.remoteAddress
}

function onReceiveData(ws, clientId, data) {
    var obj = JSON.parse(data);
    // console.log(`onReceiveData from ${clientId}: name=${obj.name}`)

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
    } else if (obj.name == message_forward_web_msg) {
        forwardWebMessage(ws, clientId, obj)
    }
}

//手机端注册，注册后网页端可以查到该设备
function registerApp(ws, clientId, obj) {
    appClientSocketMap.set(clientId, ws)
    var hasRegisterd = bindMap.has(clientId);
    console.log(`registerApp: ${clientId} hasRegisterd=${hasRegisterd} obj=${obj}`)
    if (!hasRegisterd) {
        bindMap.set(clientId, new Set())
        if (obj.info) {
            appInfoMap.set(clientId, obj.info)
        }
        console.log(`registerApp: ${clientId} success`)
        obj.success = true
        sendMessageToClient(ws, obj)
    }
}

//手机端取消注册
function unregisterApp(ws, clientId, obj) {
    console.log(`unregisterApp : ${clientId}`)
    deleteAppClient(clientId, true)
    obj.success = true
    sendMessageToClient(ws, obj)
}


///web端绑定手机
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

///web端取消绑定
function unbindApp(ws, clientId, obj) {
    console.log(`unbindApp: ${clientId}`)
    deleteWebClient(clientId, true)
    obj.success = true
    sendMessageToClient(ws, obj)
}

///web端获取 app列表，用来选择一个绑定
function getAppClientList(ws, clientId, obj) {
    var set = new Set()
    appClientSocketMap.forEach(function (value, key) {
        var item = new Map()
        item.set('clientId', key)
        if (appInfoMap.has(key)) {
            var clientInfo = appInfoMap.get(key)
            item.set('clientInfo', clientInfo)
        }
        set.add(item)
    })
    obj.data = set
    obj.success = true
    sendMessageToClient(ws, obj)
}

///app端将数据传给web端
function forwardAppMessage(ws, clientId, obj) {
    if (bindMap.has(clientId)) {
        var set = bindMap.get(clientId)
        for (var id of set) {
            if (webClientSocketMap.has(id)) {
                var clientSocket = webClientSocketMap.get(id)
                sendMessageToClient(clientSocket, obj)
            }
        }
    }
}

///web端将数据传给app端
function forwardWebMessage(ws, clientId, obj) {
    bindMap.forEach(function (value, key) {
        if (value.has(clientId)) {
            if (appClientSocketMap.has(key)) {
                var clientSocket = appClientSocketMap.get(key)
                sendMessageToClient(clientSocket, obj)
            }
        }
    })
}


///将数据转发给指定的client socket 
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
    appInfoMap.delete(clientId)
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