////// CLIENT //////

var RPGEntity = (initObject) => {
    var self = SpriteEntity(initObject);



    self.superRenderSprite = self.renderSprite;
    self.renderSprite = (ctx, camera, sprite = self.sprite, hardBounds = null) => {
        var bounds = self.superRenderSprite(ctx, camera, sprite, hardBounds);

        // var y = camera.transformDimension(self.clientOffsetY);
        // var h = camera.transformDimension(self.clientHeight);
        // bounds.y += 2 * y - h;
        // self.superRenderSprite(ctx, camera, self.shadowSprite, bounds);
    }

    return self;
}

var RPGMovementEntity = (initObject) => {
    var self = MovementAnimationEntity(initObject);

    self.superRenderMovementAnimation = self.renderMovementAnimation;
    self.renderMovementAnimation = (ctx, camera) => {
        var res = self.superRenderMovementAnimation(ctx, camera);
        // res[0].y += camera.transformDimension(self.clientOffsetY);
        // res[0].height /= 2;
        // self.renderSprite(ctx, camera, self.texture.shadowSprites[res[1]], res[0]);
    }

    return self;
}

var Fireball = (initObject) => {
    var self = RPGEntity(initObject);
    self.render = (ctx, camera) => {
        self.clientOffsetY = self.z;
        self.renderSprite(ctx, camera)
    }
    return self;
}

var client = Client({
    keyToConstructor: {
        'PLAYER': {
            const: RPGMovementEntity,
            defs: {
                clientWidth: 52,
                clientHeight: 78,
                clientOffsetY: 78,
                clientOffsetX: 26,
                animationTime: 2
            }
        },
        'ANIMAL': {
            const: RPGEntity
        },
        'WALL': {
            const: RPGEntity,
            defs: {
                clientWidth: 96,
                clientHeight: 144,
                clientOffsetY: 96
            }
        },
        'GROUND': {
            const: SpriteEntity,
            defs: {
                layer: 0,
                bakeIn: true
            },
        },
        'FENCE': {
            const: RPGEntity,
            defs: {
                clientWidth: 96,
                clientHeight: 144,
                clientOffsetY: 96
            }
        },
        'GROUND_SAND': {
            const: SpriteEntity,
            defs: {
                layer: 0,
                bakeIn: true
            }
        },
        'TREE': {
            const: RPGEntity,
            defs: {
                clientWidth: 128,
                clientHeight: 256,
                clientOffsetY: 250,
                clientOffsetX: 70
            }
        },
        'FIREBALL': {
            const: Fireball
        }
    },
    chunkSize: 960
})

client.camera.lerp = true;
client.preHandler = () => {
    if (!client.a) {
        client.a = client.handler.getObject('PLAYER', client.clientId)
    }
}
client.postHandler = () => {}

///// TEXTURE MANAGER //////
textureManager = TextureManager({
    'player': {
        src: '/textures/player.png',
        c: 8,
        r: 9
    },
    'wall': {
        src: '/textures/wall.png',
        c: 4,
        r: 4
    },
    'silverfish': {
        src: '/textures/silverfish.png',
    },
    'chunk': {
        src: '/textures/chunk.png',
    },
    'tree': {
        src: '/textures/tree.png',
    },
    'ground': {
        src: '/textures/ground.png',
        c: 2,
        r: 1
    },
    'fence': {
        src: '/textures/fence.png',
        c: 4,
        r: 4
    },
    'fireball': {
        src: '/textures/fireball.png'
    },
    'buttons': {
        src: '/textures/buttons.png',
        r: 1,
        c: 4
    }
}, {
    'PLAYER': {
        src: 'player',
    },
    'WALL': {
        src: 'wall',
    },
    'ANIMAL': {
        src: 'silverfish',
    },
    'SPL_CHUNK': {
        src: 'chunk',
    },
    'TREE': {
        src: 'tree',
    },
    'GROUND': {
        src: 'ground',
        x: 0,
        y: 0
    },
    'GROUND_SAND': {
        src: 'ground',
        x: 1,
        y: 0
    },
    'FENCE': {
        src: 'fence'
    },
    'FIREBALL': {
        src: 'fireball'
    }
})

client.handler.textureManager = (textureManager);

///// START CLIENT //////

textureManager.onLoad = () => {
    console.log('onload');
    client.socketInit()
    client.startGameLoop()


    ///// INPUT LISTENER //////

    mouseListener = MouseListener(client)
    mouseListener.mouseEvent = mouseListener.cameraMouseEvent;
    mouseListener.initListener()

    client.uiHandler.add(
        SpoolUIButtonList({
            x: client.gameArea.width - 30,
            y: 30,
            columns: 1,
            rows: 3,
            offsetX: 1,
            offsetY: 0
        }, [{
            sprite: textureManager.getSprite('buttons', 1, 0),
            bindedMouseEvent: (event) => {
                console.log('inventory');
            }
        }, {
            sprite: textureManager.getSprite('buttons', 2, 0),
            bindedMouseEvent: (event) => {
                console.log('character');
            }
        }, {
            sprite: textureManager.getSprite('buttons', 3, 0),
            bindedMouseEvent: (event) => {
                console.log('map');
            }
        }])
    )

    var hotbar = []
    for (var i = 0; i < 10; i++) {
        hotbar.push({
            sprite: textureManager.getSprite('buttons', 0, 0),
            bindedMouseEvent: (event) => {
                console.log(i);
            }
        })
    }

    client.uiHandler.add(
        SpoolUIButtonList({
            x: client.gameArea.width / 2,
            y: client.gameArea.height - 30,
            columns: 10,
            rows: 1,
            offsetX: 0.5,
            offsetY: 1,
        }, hotbar)
    )

    keyListener = KeyboardListener(client.socket)
    keyListener.initListener()
}

textureManager.load();