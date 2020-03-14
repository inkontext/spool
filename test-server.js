var {
    Server,
    Entity,
    SpoolMath,
    CollisionManager,
    GravityManager,
    ObjectSpawner,
    RectangleBodyParameters,
    ServerObject,
    Line,

} = require('./spoolserver.js');

var {
    FileReader
} = require('./spoolfilereader.js');

////// SETTING UP SERVER //////

var GRID_SIZE = 60;



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
        width: 45,
        height: 20,

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

var Network = () => {
    self = {}
    self.cells = []

    self.init = (width, height) => {
        for (var y = 0; y < height; y++) {
            var temp = [];
            for (var x = 0; x < width; x++) {
                temp.push(NetworkCell({
                    x: x,
                    y: y,
                    network: self
                }))
            }
            self.cells.push(temp);
        }
    }

    self.getCell = (x, y) => {

        if (self.cells[y]) {
            if (self.cells[y][x]) {
                return self.cells[y][x]
            }
        }
        return null;
    }

    self.setValue = (x, y, object, value) => {
        var cell = self.getCell(x, y);
        if (cell) {
            cell.setValue(object, value);
        }
    }

    self.connect = (object) => {
        var cell = self.getCell(object.gridX, object.gridY)
        if (cell) {
            cell.connect(object);
            return cell;
        }
        return null;
    }

    return self;
}

var NetworkCell = (initPack = {}) => {
    var self = {
        x: 0,
        y: 0,
        network: 0,
        connectionLeft: false,
        connectionRight: false,
        connectionUp: false,
        connectionDown: false,
        activeObjects: {},
        active: false,
        connectedObjects: [],

        ...initPack
    }

    self.setValue = (object, value) => {

        var new_value = false;

        if (value) {
            if (!(object.id in self.activeObjects)) {
                self.activeObjects[object.id] = {
                    id: object.id,
                    valueUpdated: Date.now(),
                    value: true
                }
                new_value = true;
            }
            self.active = true;
        } else {
            if (object.id in self.activeObjects) {
                delete self.activeObjects[object.id]
                new_value = true
            }
            if (Object.keys(self.activeObjects).length == 0) {
                self.active = false;
            }
        }

        if (new_value) {
            for (var i = 0; i < self.connectedObjects.length; i++) {
                self.connectedObjects[i].active = value;
            }

            if (self.connectionLeft) {
                self.network.setValue(self.x - 1, self.y, object, value)
            }
            if (self.connectionRight) {
                self.network.setValue(self.x + 1, self.y, object, value)
            }
            if (self.connectionUp) {
                self.network.setValue(self.x, self.y - 1, object, value)
            }
            if (self.connectionDown) {
                self.network.setValue(self.x, self.y + 1, object, value)
            }

        }

    }

    self.update = () => {

    }

    self.connect = (object) => {
        self.connectedObjects.push(object)
    }

    self.disconnect = (object) => {
        for (var i = 0; i < self.connectedObjects.length; i++) {
            if (self.connectedObjects[i].id == object.id) {
                self.connectedObjects.splice(i, 1)
            }
        }
    }

    return self;
}

var Cable = (initPack = {}) => {
    var self = Entity({
        objectType: 'CABLE',
        connections: [
            [true, true, true, true],
            [true, false, true, false],
            [false, true, false, true],
            [false, true, true, true],

            [true, true, false, false],
            [false, true, false, false],
            [false, true, true, false],
            [true, false, true, true],

            [true, false, false, false],
            [false, false, false, false],
            [false, false, true, false],
            [true, true, false, true],

            [true, false, false, true],
            [false, false, false, true],
            [false, false, true, true],
            [true, true, true, false]
        ],
        ...initPack
    });

    var superSelf = {
        updatePack: self.updatePack
    }

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;

    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);

    self.gridColRemoval = true;
    self.active = false;

    self.onGridColRemoval = () => {
        var cell = NETWORK.connect(self)
        cell.connectionLeft = !self.connections[self.textureId][0]
        cell.connectionUp = !self.connections[self.textureId][1]
        cell.connectionRight = !self.connections[self.textureId][2]
        cell.connectionDown = !self.connections[self.textureId][3]
    }


    self.updatePack = () => {
        return {
            ...superSelf.updatePack(),
            active: self.active
        }
    }

    return self;
}

var Button = (initPack = {}) => {
    var self = Entity({
        objectType: 'BUTTON',
        ...initPack
    });

    var superSelf = {
        update: self.update
    }

    self.width = GRID_SIZE;
    self.height = GRID_SIZE;

    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = false;

    self.active = false;
    self.lastSent = false;

    self.gridColRemoval = true;

    self.send = () => {
        if (self.active != self.lastSent) {
            self.cell.setValue(self, self.active);
            self.lastSent = self.active;
        }
    }


    self.update = () => {
        superSelf.update()
        if (self.active) {
            self.active = false;
        } else {
            self.send()
        }
    }

    self.activate = () => {
        if (self.cell) {
            self.active = true;
            self.send()
        }
    }

    self.cell = NETWORK.connect(self)


    return self;
}

////// COLLISION MANAGER ///////

var collisionManager = CollisionManager({
    colPairs: [{
        a: ['PLAYER'],
        b: ['BLOCK'],
        func: (a, b, col) => {

            if (col.direction == 'top' || col.direction == 'bottom') {
                a.velY = 0;
            }

            if (col.direction == 'bottom') {
                a.jumpCounter = 0;
                a.gravityIgnore = true;
            }
        }
    }, {
        a: ['PLAYER'],
        b: ['BUTTON'],
        notSolid: true,
        func: (a, b, col) => {
            b.activate()
        }
    }]
}, server.handler);
server.handler.addManager(collisionManager);

var objSpawner = ObjectSpawner(server.handler, {
    'BLOCK': {
        const: Block
    },
    'CABLE': {
        const: Cable
    },
    'BUTTON': {
        const: Button
    }
})

objSpawner.gx = GRID_SIZE;
objSpawner.gy = GRID_SIZE;

NETWORK = Network()

FileReader.readImage('./maps/smash-cables.png', (data) => {

    NETWORK.init(data.shape[0], data.shape[1])

    objSpawner.spawnFromImageMap('./maps/smash-cables.png', {
        'ffffff': 'BLOCK',
        'ff0000': 'CABLE',
        '0000ff': 'BUTTON'
    })

    objSpawner.spawnFromImageMap('./maps/smash-objects.png', {
        'ffffff': 'BLOCK',
        'ff0000': 'CABLE',
        '0000ff': 'BUTTON'
    })
});


server.fullStart(Player);