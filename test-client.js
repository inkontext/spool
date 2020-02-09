var Player = (initPack) => {
    var self = Entity(initPack);
    self.velocity = 0;
    self.lastX = 0;
    self.lastY = 0;

    return self;
}

var client = Client({
    keyToConstructor: {
        'PLAYER': Player,
        'ANIMAL': Player
    }
})

client.preHandler = () => {
    if (!client.a) {
        client.a = client.handler.getObject('PLAYER', client.clientId)
    }
}

client.postHandler = () => {

}

keyListener = KeyboardListener(client.socket)
keyListener.initListener()

client.socketInit()
client.startGameLoop()