//// OBJECTS ////

var OBJECTS = {
    'PLAYER': {
        const: RectangleEntity
    },
    'BLOCK': {
        const: SpriteEntity,
        defs: {
            bakeIn: true
        }
    }
}

//// CLIENT ////

var client = Client({
    keyToConstructor: OBJECTS,
    chunkSize: 500,
    FPS: 60,

    onFirstLoad: (self) => {
        self.handler.preBake();
        self.startGameLoop()
    }
})

////// TEXTURE MANAGER //////

textureManager = TextureManager({
    'block': {
        src: './block.png',
        r: 4,
        c: 4
    },
    'player': {
        src: './player.png',
        c: 8,
        r: 9
    }
}, {
    'BLOCK': {
        src: 'block',
        x: 0,
        y: 0,
        xx: 3,
        yy: 3
    },
    'PLAYER': {
        src: 'player',
        x: 0,
        y: 0,
        xx: 7,
        yy: 8
    }
})

client.handler.textureManager = (textureManager);

////// CAMERA //////

client.camera.lerp = true;

client.camera.onUpdate = (self) => {
    if (client.clientObject) {
        self.followObject = client.clientObject;
    }
}

////// TEXTURE MANAGER //////

var init = () => {
    client.socketInit()

    keyListener = KeyboardListener(client.socket)
    keyListener.initListener()

    var background = textureManager.getSprite('sky')

    client.background = (ctx, camera) => {
        ctx.imageSmoothingEnabled = false;

        var coef = client.gameArea.height / background.height

        ctx.drawImage(background, -camera.x / 2, 0, coef * background.width, coef * background.height)
    }
}

textureManager.onLoad = init;

textureManager.load();