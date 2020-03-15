//// OBJECTS ////

var NetworkTileEntity = (initObject = {}) => {
    var self = SpriteEntity(initObject);

    self.render = (ctx, camera) => {
        var tid = self.textureId;

        if (self.active) {
            tid += 16
        }
        self.renderSprite(ctx, camera, sprite = self.texture.sprites[tid]);

    }

    return self;
}

var NetworkSpriteEntity = (initObject = {}) => {
    var self = SpriteEntity(initObject);

    self.render = (ctx, camera) => {
        var tid = 0;

        if (self.active) {
            tid = 1
        }
        self.renderSprite(ctx, camera, sprite = self.texture.sprites[tid]);

    }

    return self;
}

var OBJECTS = {
    'PLAYER': {
        const: MovementAnimationEntity,
        defs: {
            clientWidth: 45,
            clientHeight: 78,

            clientOffsetX: 22.5,
            clientOffsetY: 78,
            showBounds: false
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
            clientWidth: 64,
            clientHeight: 128,
            clientOffsetX: 32,
            clientOffsetY: 96
        }
    },
    'CABLE': {
        const: NetworkTileEntity,
        defs: {
            layer: 8
        }
    },
    'BUTTON': {
        const: NetworkSpriteEntity,
        defs: {
            layer: 9
        }
    },
    'DOORS': {
        const: NetworkTileEntity,
        defs: {
            clientWidth: 64,
            clientHeight: 128,
            clientOffsetX: 32,
            clientOffsetY: 96
        }
    },
    'CUBE': {
        const: SpriteEntity,
        defs: {
            clientWidth: 48,
            clientHeight: 76,
            clientOffsetX: 24,
            clientOffsetY: 60,
            showBounds: false
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
    'cables_spritesheet': {
        src: './textures/cables.png',
        c: 4,
        r: 8,
    },
    'ioelements_spritesheet': {
        src: './textures/ioelements.png',
        c: 4,
        r: 4
    },
    'wall': {
        src: './textures/walls.png',
        r: 4,
        c: 4
    },
    'doors': {
        src: './textures/doors.png',
        c: 4,
        r: 8
    },
    'cube': {
        src: './textures/cube.png',
        c: 1,
        r: 1
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
    'CABLE': {
        src: 'cables_spritesheet',
        x: 0,
        y: 0,
        xx: 3,
        yy: 7
    },
    'BUTTON': {
        src: 'ioelements_spritesheet',
        x: 0,
        y: 0,
        xx: 0,
        yy: 1
    },
    'WALL': {
        src: 'wall',
        x: 0,
        y: 0,
        xx: 3,
        yy: 3
    },
    'DOORS': {
        src: 'doors',
        x: 0,
        y: 0,
        xx: 3,
        yy: 7
    },
    'CUBE': {
        src: 'cube',
        x: 0,
        y: 0,
        xx: 0,
        yy: 0
    },


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

    keyListener.onKeyDown = (event) => {
        if (event.keyCode === 69) {
            keyListener.socket.emit(MessageCodes.SM_KEY_PRESS, {
                inputId: 'use',
                value: true
            });
        }

    }

    keyListener.onKeyUp = (event) => {
        if (event.keyCode === 69) {
            keyListener.socket.emit(MessageCodes.SM_KEY_PRESS, {
                inputId: 'use',
                value: false
            });
        }
    }
}

textureManager.onLoad = init;

textureManager.load();