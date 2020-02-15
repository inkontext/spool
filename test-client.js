var Player = (initPack) => {
    var self = Entity(initPack);



    self.superRender = self.render
    self.render = (ctx, camera) => {
        self.superRender(ctx, camera);

        ctx.font = '15px Arial';
        ctx.textAlign = "center";
        textPoint = camera.transformPoint(self.x, self.y + self.radius + 10)
        ctx.fillText(self.name, textPoint.x, textPoint.y)
    }

    return self;
}

var client = Client({
    keyToConstructor: {
        'PLAYER': ObjRectangle,
        'ANIMAL': Player,
        'WALL': ObjRectangle
    }
})

client.camera.lerp = true;

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