//// OBJECTS ////

var GLOBAL = {
    textureManager: null,
    client: null
}

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

var NetworkGateEntity = (initObject = {}) => {
    var self = SpriteEntity(initObject);

    self.inactiveTextureId = 8;
    self.activeTextureId = 12;

    if (self.gateType == 'AND') {
        self.inactiveTextureId += 0
        self.activeTextureId += 0
    } else if (self.gateType == 'XOR') {
        self.inactiveTextureId += 1
        self.activeTextureId += 1
    } else if (self.gateType == 'OR') {
        self.inactiveTextureId += 2
        self.activeTextureId += 2
    }


    self.render = (ctx, camera) => {
        self.renderSprite(ctx, camera)
        if (self.active) {
            self.renderSprite(ctx, camera, GLOBAL.textureManager.getSprite('ioelements_spritesheet', self.activeTextureId))
        } else {
            self.renderSprite(ctx, camera, GLOBAL.textureManager.getSprite('ioelements_spritesheet', self.inactiveTextureId))
        }
    }

    return self;
}

var Wall = (initObject = {}) => {
    var self = SpriteEntity(initObject);

    self.isInBounds = (ctx, camera, tx, ty) => {
        var x = self.x
        var y = self.y
        var width = self.width;
        var height = self.height;

        if (self.clientOffsetX) {
            x -= self.clientOffsetX
        } else {
            x -= self.width / 2
        }
        if (self.clientOffsetY) {
            y += self.clientOffsetY
        } else {
            y += self.height / 2
        }
        if (self.clientWidth) {
            width = self.clientWidth;
        }
        if (self.clientHeight) {
            height = self.clientHeight
        }

        var offsetX = 500
        var offsetY = offsetX

        if (x - offsetX < tx && tx < x + width + offsetX) {
            if (y - height - offsetY < ty && ty < y + offsetY) {
                return true;
            }
        }

        return false;
    }

    self.render = (ctx, camera) => {



        if (false && !self.isInBounds(ctx, camera, client.clientObject.x, client.clientObject.y)) {
            self.renderSprite(ctx, camera);
        } else {
            self.renderSprite(ctx, camera, self.texture.sprites[self.textureId + 16])
            // ctx.globalAlpha = 0.5
            // self.renderSprite(ctx, camera);
            // ctx.globalAlpha = 1
        }
    }



    return self;
}

var LebacSpriteEntity = (initObject = {}) => {
    var self = SpriteEntity(initObject);

    var superSelf = {
        update: self.update
    }

    self.baseOffsetY = self.clientOffsetY

    self.update = (data) => {
        superSelf.update(data);

        self.clientOffsetY = self.baseOffsetY + self.z
    }

    return self;
}

var LebacAnimationEntity = (initObject = {}) => {
    var self = MovementAnimationEntity(initObject);

    var superSelf = {
        update: self.update
    }

    self.baseOffsetY = self.clientOffsetY

    self.update = (data) => {
        superSelf.update(data);

        self.clientOffsetY = self.baseOffsetY + self.z
    }

    return self;
}

var OBJECTS = {
    'PLAYER': {
        const: LebacAnimationEntity,
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
        const: Wall,
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
    'LOGIC_GATE': {
        const: NetworkGateEntity
    },
    'CUBE': {
        const: LebacSpriteEntity,
        defs: {
            clientWidth: 48,
            clientHeight: 76,
            clientOffsetX: 24,
            clientOffsetY: 60,
            showBounds: false
        }
    },
    'SEMIWALL': {
        const: NetworkTileEntity,
        defs: {
            clientWidth: 64,
            clientHeight: 128,
            clientOffsetX: 32,
            clientOffsetY: 96,
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
        r: 8,
        c: 4
    },
    'doors': {
        src: './textures/doors.png',
        c: 4,
        r: 8
    },
    'connectors': {
        src: './textures/connectors.png',
        c: 4,
        r: 4
    },
    'cube': {
        src: './textures/cube.png',
        c: 1,
        r: 1
    },
    'semiwall': {
        src: './textures/doors.png',
        c: 4,
        r: 8
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
        x: 1,
        y: 0,
        xx: 1,
        yy: 1
    },
    'WALL': {
        src: 'wall',
        x: 0,
        y: 0,
        xx: 3,
        yy: 7
    },
    'DOORS': {
        src: 'doors',
        x: 0,
        y: 0,
        xx: 3,
        yy: 7
    },
    'LOGIC_GATE': {
        src: 'connectors',
        x: 0,
        y: 0,
        xx: 3,
        yy: 3
    },
    'CUBE': {
        src: 'cube',
        x: 0,
        y: 0,
        xx: 0,
        yy: 0
    },
    'SEMIWALL': {
        src: 'semiwall',
        x: 0,
        y: 0,
        xx: 3,
        yy: 7
    },


})

GLOBAL.textureManager = (textureManager);
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
        } else if (event.keyCode === 81) {
            keyListener.socket.emit(MessageCodes.SM_KEY_PRESS, {
                inputId: 'throw',
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
        } else if (event.keyCode === 81) {
            keyListener.socket.emit(MessageCodes.SM_KEY_PRESS, {
                inputId: 'throw',
                value: false
            });
        }
    }
}

textureManager.onLoad = init;

textureManager.load();