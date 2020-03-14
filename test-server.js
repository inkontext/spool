var {
    Server,
    Entity,
    SpoolMath,
    CollisionManager,
    GravityManager,
    ObjectSpawner,
    RectangleBodyParameters,
    ServerObject,
    Line
} = require('./spoolserver.js');

////// SETTING UP SERVER //////

var GRID_SIZE = 40;

var server = Server({
    port: 3000,
    TPS: 55,
    chunkSize: 400,
}, ['/', '/textures'])

var SmashEntity = (initPack = {}) => {
    var self = Entity({
        ...RectangleBodyParameters,
        ...initPack
    });
    return self;
}

var Player = (initPack = {}) => {
    var self = SmashEntity({

        maxAcc: 10,
        jumpAcc: 20,
        jumpCounter: 0,
        width: 40,
        height: 40,

        objectType: 'PLAYER',
        rotation: Math.PI / 2,
        color: SpoolMath.randomHsvColor(0.5, 0.8),
        ...initPack
    });

    var superSelf = {
        update: self.update
    }

    /**
     * Updates velocities from keyboard input
     */
    self.updateInputVel = () => {
            // setting the basic values
            if (!self.standStill) {
                xVelocity = 0;
                yVelocity = 0;

                if (self.pressedLeft || self.pressedRight || self.pressedUp || self.pressedDown) {
                    if (self.pressedLeft) {
                        xVelocity -= self.maxAcc;
                    }
                    if (self.pressedRight) {
                        xVelocity += self.maxAcc;
                    }
                    if (self.pressedUp) {
                        yVelocity += self.maxAcc;
                    }
                    if (self.pressedDown) {
                        yVelocity -= self.maxAcc;
                    }
                }

                self.setVelVector('x-movement', [xVelocity, yVelocity]);
            } else {
                self.setVelVector('x-movement', [0, 0]);
            }
        },
        self.update = () => {
            self.updateInputVel();
            superSelf.update();
        }

    return self;
}

var Block = (initPack = {}) => {
    var self = Entity({
        objectType: 'BLOCK',
        ...initPack
    });

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;

    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = true;

    self.gridColRemoval = true;

    return self;
}

////// COLLISION MANAGER ///////

var collisionManager = CollisionManager({
    colPairs: [{
        a: ['PLAYER'],
        b: ['WALL'],
        func: (a, b, col) => {

            if (col.direction == 'top' || col.direction == 'bottom') {
                a.velY = 0;
            }

            if (col.direction == 'bottom') {
                a.jumpCounter = 0;
                a.gravityIgnore = true;
            }
        }
    }]
}, server.handler);
server.handler.addManager(collisionManager);

var objSpawner = ObjectSpawner(server.handler, {
    'BLOCK': {
        const: Block
    }
})

objSpawner.gx = GRID_SIZE;
objSpawner.gy = GRID_SIZE;

objSpawner.spawnFromImageMap('./smash-map.png', {
    'ffffff': 'BLOCK'
})

server.fullStart(Player);