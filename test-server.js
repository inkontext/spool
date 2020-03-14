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

var GRID_SIZE = 64;



var server = Server({
    port: 3000,
    TPS: 55,
    chunkSize: 400,
}, ['/', '/textures'])

////// NETWORK //////

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
                if (self.connectedObjects[i].networkActivatable) {
                    self.connectedObjects[i].setActive(self.active);
                }
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

///// OBJECTS /////

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

var Ground = (initPack = {}) => {
    var self = Entity({
        objectType: 'GROUND',
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

var Wall = (initPack = {}) => {
    var self = Entity({
        objectType: 'WALL',
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

var NetworkEntity = (initPack = {}) => {
    var self = Entity({
        active: false,
        networkActivatable: true,
        width: GRID_SIZE,
        height: GRID_SIZE,
        rotation: Math.PI / 2,
        color: SpoolMath.randomHsvColor(0.5, 0.8),
        ...initPack
    })

    var superSelf = {
        updatePack: self.updatePack
    }

    self.updatePack = () => {
        return {
            active: self.active,
            ...superSelf.updatePack()
        }
    }

    self.setActive = (active) => {
        self.active = active

        if (self.onActiveChanged) {
            self.onActiveChanged(active)
        }
    }

    return self;
}

var Cable = (initPack = {}) => {
    var self = NetworkEntity({
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

    self.gridColRemoval = true;

    self.onGridColRemoval = () => {
        var cell = NETWORK.connect(self)
        cell.connectionLeft = !self.connections[self.textureId][0]
        cell.connectionUp = !self.connections[self.textureId][1]
        cell.connectionRight = !self.connections[self.textureId][2]
        cell.connectionDown = !self.connections[self.textureId][3]
    }

    return self;
}

var Button = (initPack = {}) => {
    var self = NetworkEntity({
        objectType: 'BUTTON',
        networkActivatable: false,
        ...initPack
    });

    var superSelf = {
        update: self.update
    }

    self.static = false;

    self.lastSent = false;

    self.send = () => {
        if (self.active != self.lastSent) {
            self.cell.setValue(self, self.active);
            self.lastSent = self.active;
        }
    }

    self.update = () => {
        superSelf.update()

        self.active = self.buttonActive;
        if (self.buttonActive) {
            self.buttonActive = false;
        } else {
            self.send()
        }
    }

    self.activate = () => {
        if (self.cell) {
            self.buttonActive = true;
            self.send()
        }
    }

    self.cell = NETWORK.connect(self)


    return self;
}

var Doors = (initPack = {}) => {
    var self = NetworkEntity({
        objectType: 'DOORS',
        ...initPack
    });

    self.static = false;

    self.onActiveChanged = (active) => {
        self.transparent = active;
        console.log(self.transparent)
    }

    self.gridColRemoval = true;

    self.cell = NETWORK.connect(self)

    return self;
}

////// COLLISION MANAGER ///////

var collisionManager = CollisionManager({
    colPairs: [{
        a: ['PLAYER'],
        b: ['WALL', 'DOORS'],
        solidException: (a, b) => {
            return b.transparent
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
    'GROUND': {
        const: Ground
    },
    'WALL': {
        const: Wall
    },
    'CABLE': {
        const: Cable
    },
    'BUTTON': {
        const: Button
    },
    'DOORS': {
        const: Doors
    }
})

objSpawner.gx = GRID_SIZE;
objSpawner.gy = GRID_SIZE;

NETWORK = Network()


FileReader.readImage('./maps/smash-cables.png', (data) => {

    NETWORK.init(data.shape[0], data.shape[1])

    objSpawner.spawnFromImageMap('./maps/smash-cables.png', {
        'ff0000': 'CABLE'
    })

    objSpawner.spawnFromImageMap('./maps/smash-objects.png', {
        '000000': 'GROUND',
        'ffffff': 'WALL',
        'ff0000': 'CABLE',
        '0000ff': 'BUTTON',
        '00ff00': 'DOORS',
    })

    objSpawner.addZones('./maps/smash-zones.png', {
        'ff8484': "SPAWN"
    })


    server.onPlayerSpawn = (player) => {
        Object.assign(player, objSpawner.getRandomPositionInZone('SPAWN'))
    }
});




server.fullStart(Player);