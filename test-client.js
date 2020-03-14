//// OBJECTS ////

var OBJECTS = {
    'PLAYER': {
        const: MovementAnimationEntity,
        defs: {
            showBounds: true,
            clientWidth: 45,
            clientHeight: 78,

            clientOffsetX: 22.5,
            clientOffsetY: 78
        }
    },
    'GROUND': {
        const: SpriteEntity,
        defs: {
            bakeIn: true
        }
    },
    'WALL': {
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
    'ground': {
        src: './textures/ground.png',
        r: 4,
        c: 4
    },
    'player': {
        src: './textures/player.png',
        c: 8,
        r: 9
    },
    'wall': {
        src: './textures/walls.png',
        r: 4,
        c: 4
    }
}, {
    'GROUND': {
        src: 'ground',
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
    },
    'WALL': {
        src: 'wall',
        x: 0,
        y: 0,
        xx: 3,
        yy: 3
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
}

textureManager.onLoad = init;

textureManager.load();