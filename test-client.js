////// CLIENT //////

var client = Client({
    keyToConstructor: {
        'PLAYER': {
            const: MovementAnimationEntity,
            defs: {
                clientWidth: 52,
                clientHeight: 78,
                clientOffsetY: 78,
                clientOffsetX: 26,
            }
        },
        'ANIMAL': {
            const: SpriteEntity
        },
        'WALL': {
            const: SpriteEntity,
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
            }
        },
        'FENCE': {
            const: SpriteEntity,
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
            }
        },
        'TREE': {
            const: SpriteEntity,
            defs: {
                clientWidth: 128,
                clientHeight: 256,
                clientOffsetY: 250,
                clientOffsetX: 70
            }
        }
    }
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
    'PLAYER': {
        src: '/player.png',
        c: 9,
        r: 5
    },
    'WALL': {
        src: '/wall.png',
        c: 4,
        r: 4
    },
    'ANIMAL': {
        src: '/silverfish.png',
        c: 1,
        r: 1
    },
    'SPL_CHUNK': {
        src: '/chunk.png',
        c: 1,
        r: 1
    },
    'TREE': {
        src: '/tree.png',
        c: 1,
        r: 1
    },
    'GROUND': {
        src: '/ground.png',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        c: 2,
        r: 1
    },
    'GROUND_SAND': {
        src: '/ground.png',
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        c: 2,
        r: 1
    },
    'FENCE': {
        src: '/fence.png',
        c: 4,
        r: 4
    },
})

client.handler.textureManager = (textureManager);

///// INPUT LISTENER //////



///// START CLIENT //////

textureManager.onLoad = () => {
    console.log('onload');
    client.socketInit()
    client.startGameLoop()

    keyListener = KeyboardListener(client.socket)
    keyListener.initListener()
}

textureManager.load();