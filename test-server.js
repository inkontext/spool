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
    port: 4000,
    TPS: 55,
    chunkSize: 400
}, ['/', '/textures'])

server.keyEvent = (data, socket, player) => {
    if (data.inputId == 'use' || data.inputId == 'throw') {
        var pickup = server.handler.getClosestObject(player.x, player.y, {
            whitelist: ["CUBE"]
        })
        if (pickup != null) {
            if (!player.hand && pickup.distance <= 60 && !data.value && player.canPickUp) {
                pickup.object.transparent = true
                player.hand = pickup.object
                pickup.object.player = player
                pickup.object.x = player.x
                pickup.object.y = player.y
            } else if (player.hand && !data.value) {
                player.hand.transparent = false
                player.hand.player = undefined

                if (data.inputId == 'throw') {
                    player.hand.impulse(22, player.movementAngle);
                    player.hand.velZ = 8;
                }

                player.hand = undefined
            }
        }
    }
}

////// NETWORK //////

var Network = () => {
    self = {}
    self.cells = []
    self.portals = {}

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

    self.setValue = (x, y, object, value, direction = null) => {
        var cell = self.getCell(x, y);
        if (cell) {
            cell.setValue(object, value, direction);
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

    self.addPortal = (portal) => {
        var linkId = portal.portalColor[3];
        if (!self.portals[linkId]) {
            self.portals[linkId] = []
        }
        self.portals[linkId].push(portal);
    }

    self.getRandomPortalSibling = (portal) => {
        linkId = portal.portalColor[3];
        if (!self.portals[linkId]) {
            return null;
        }

        return SpoolMath.randomChoice(self.portals[linkId].filter(value => {
            return value.id != portal.id && value.active
        }))
    }

    return self;
}

var NetworkConnection = () => {

    var self = {
        connected: false,
        input: false,
        active: false,
        output: false,

        activeObjects: {},

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

        return new_value;
    }

    self.setIO = (value) => {
        self.input = value
        self.output = value
    }

    self.setIONeg = (value) => {
        self.input = value
        self.output = !value
    }

    self.toStr = () => {
        return `[I: ${self.input}, O:${self.output}, A:${self.active}]`
    }

    return self;
}

var NetworkCell = (initPack = {}) => {
    var self = {
        x: 0,
        y: 0,
        network: 0,
        connectionLeft: NetworkConnection(),
        connectionRight: NetworkConnection(),
        connectionUp: NetworkConnection(),
        connectionDown: NetworkConnection(),

        activeObjects: {},
        objectActive: false,

        active: false,
        connectedObjects: [],

        ...initPack
    }

    self.activationFunction = (self, l, u, r, b, o) => {
        return l || u || r || b || o;
    }


    self.output = (self, object, value, direction) => {
        if (self.connectionLeft.output) {
            self.network.setValue(self.x - 1, self.y, object, value, 2)
        }
        if (self.connectionRight.output) {
            self.network.setValue(self.x + 1, self.y, object, value, 0)
        }
        if (self.connectionUp.output) {
            self.network.setValue(self.x, self.y - 1, object, value, 3)
        }
        if (self.connectionDown.output) {
            self.network.setValue(self.x, self.y + 1, object, value, 1)
        }
    }

    self.currentForward = (self, object, value, direction) => {
        for (var i = 0; i < self.connectedObjects.length; i++) {
            if (self.connectedObjects[i].networkActivatable) {
                self.connectedObjects[i].setActive(self.active);
            }
        }
        self.output(self, object, value, direction);
    }

    self.setValue = (object, value, direction) => {
        var new_value = false;

        var lastActive = self.active;

        if ((direction == 0 && self.connectionLeft.input) ||
            (direction == 1 && self.connectionUp.input) ||
            (direction == 2 && self.connectionRight.input) ||
            (direction == 3 && self.connectionDown.input) || !direction) {


            if (direction == 0) {
                new_value = self.connectionLeft.setValue(object, value)
            } else if (direction == 1) {
                new_value = self.connectionUp.setValue(object, value)
            } else if (direction == 2) {
                new_value = self.connectionRight.setValue(object, value)
            } else if (direction == 3) {
                new_value = self.connectionDown.setValue(object, value)
            } else {
                if (value) {
                    if (!(object.id in self.activeObjects)) {
                        self.activeObjects[object.id] = {
                            id: object.id,
                            valueUpdated: Date.now(),
                            value: true
                        }
                        new_value = true;
                    }
                    self.objectActive = true;
                } else {
                    if (object.id in self.activeObjects) {
                        delete self.activeObjects[object.id]
                        new_value = true;
                    }
                    if (Object.keys(self.activeObjects).length == 0) {
                        self.objectActive = false;
                    }
                }
            }

            self.active = self.activationFunction(self, self.connectionLeft.active, self.connectionUp.active, self.connectionRight.active, self.connectionDown.active, self.objectActive)



            if (new_value || (lastActive != self.active)) {
                self.currentForward(self, object, value, direction)
            }
        }
    }

    self.toStr = () => {
        return `l ${self.connectionLeft.toStr()} u ${self.connectionUp.toStr()} r ${self.connectionRight.toStr()} d ${self.connectionDown.toStr()}\n o ${Object.keys(self.activeObjects)}`
    }

    self.update = () => {

    }

    self.connect = (object) => {
        self.connectedObjects.push(object)
        self.setValue(object, object.active, null);

        if (object.networkActivatable) {
            object.setActive(self.active);
        }
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

var LebacEntity = (initPack = {}) => {
    var self = Entity({
        z: 0,
        velZ: 0,
        accZ: 0,
        ...RectangleBodyParameters,
        ...initPack
    });

    var superSelf = {
        updatePack: self.updatePack
    }

    self.updatePack = () => {
        return {
            z: self.z,
            ...superSelf.updatePack()
        }
    }

    return self;
}

var Player = (initPack = {}) => {
    var self = LebacEntity({

        maxAcc: 10,
        jumpAcc: 20,
        jumpCounter: 0,
        width: 35,
        height: 20,

        objectType: 'PLAYER',
        rotation: Math.PI / 2,
        color: SpoolMath.randomHsvColor(0.5, 0.8),

        z: 0,
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
    }

    self.update = () => {
        self.z = 0;
        self.updateInputVel();
        superSelf.update();
        if (self.hand) {
            self.hand.x = self.x
            self.hand.y = self.y
            if (self.calculatedVelX > 1) {
                self.hand.x += 40
            }
            if (self.calculatedVelX < -1) {
                self.hand.x -= 40
            }
        }
        self.canPickUp = true;
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
    var self = LebacEntity({
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

//// NETWORK ////

var NetworkEntity = (initPack = {}) => {
    var self = LebacEntity({
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

        cell.connectionLeft.setIO(!self.connections[self.textureId][0])
        cell.connectionLeft.connected = !self.connections[self.textureId][0];
        cell.connectionUp.setIO(!self.connections[self.textureId][1])
        cell.connectionUp.connected = !self.connections[self.textureId][1]
        cell.connectionRight.setIO(!self.connections[self.textureId][2])
        cell.connectionRight.connected = !self.connections[self.textureId][2]
        cell.connectionDown.setIO(!self.connections[self.textureId][3])
        cell.connectionDown.connected = !self.connections[self.textureId][3]

    }

    return self;
}

var CableCross = (initPack = {}) => {
    var self = NetworkEntity({
        objectType: 'CABLE_CROSS',
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

    self.cell = NETWORK.connect(self)

    self.cell.connectionLeft.setIO(true)
    self.cell.connectionLeft.connected = true;
    self.cell.connectionUp.setIO(true)
    self.cell.connectionUp.connected = true
    self.cell.connectionRight.setIO(true)
    self.cell.connectionRight.connected = true
    self.cell.connectionDown.setIO(true)
    self.cell.connectionDown.connected = true

    self.cell.output = (self, object, value, direction) => {
        if (direction == 0 || direction == 2) {
            if (self.connectionLeft.output) {
                self.network.setValue(self.x - 1, self.y, object, value, 2)
            }
            if (self.connectionRight.output) {
                self.network.setValue(self.x + 1, self.y, object, value, 0)
            }
        }
        if (direction == 1 || direction == 3) {
            if (self.connectionUp.output) {
                self.network.setValue(self.x, self.y - 1, object, value, 3)
            }
            if (self.connectionDown.output) {
                self.network.setValue(self.x, self.y + 1, object, value, 1)
            }
        }
    }

    return self;
}

var LogicalGate = (initPack = {}) => {
    var self = NetworkEntity({
        objectType: "LOGIC_GATE",
        networkActivatable: true,
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
        initPack: self.initPack,
        updatePack: self.updatePack,
        update: self.update
    }


    self.static = false;


    self.activationFunctionAnd = (cell_self, l, u, r, b, o) => {
        var resl = (!cell_self.connectionLeft.input || l || !cell_self.connectionLeft.connected)
        var resu = (!cell_self.connectionUp.input || u || !cell_self.connectionUp.connected)
        var resr = (!cell_self.connectionRight.input || r || !cell_self.connectionRight.connected)
        var resb = (!cell_self.connectionDown.input || b || !cell_self.connectionDown.connected)

        var res = (resl && resu && resb && resr) || o
        self.active = res;
        return res;
    }

    self.activationFunctionOr = (cell_self, l, u, r, b, o) => {
        var resl = (cell_self.connectionLeft.input && l && cell_self.connectionLeft.connected)
        var resu = (cell_self.connectionUp.input && u && cell_self.connectionUp.connected)
        var resr = (cell_self.connectionRight.input && r && cell_self.connectionRight.connected)
        var resb = (cell_self.connectionDown.input && b && cell_self.connectionDown.connected)

        var res = (resl || resu || resb || resr) || o
        self.active = res;
        return res;
    }

    self.activationFunctionNor = (cell_self, l, u, r, b, o) => {
        var resl = (cell_self.connectionLeft.input && l && cell_self.connectionLeft.connected)
        var resu = (cell_self.connectionUp.input && u && cell_self.connectionUp.connected)
        var resr = (cell_self.connectionRight.input && r && cell_self.connectionRight.connected)
        var resb = (cell_self.connectionDown.input && b && cell_self.connectionDown.connected)

        var res = (resl || resu || resb || resr) || o
        res = !res;
        self.active = res;
        return res;
    }

    self.activationFunctionXor = (cell_self, l, u, r, b, o) => {
        var resl = (cell_self.connectionLeft.input && l && cell_self.connectionLeft.connected) ? 1 : 0
        var resu = (cell_self.connectionUp.input && u && cell_self.connectionUp.connected) ? 1 : 0
        var resr = (cell_self.connectionRight.input && r && cell_self.connectionRight.connected) ? 1 : 0
        var resb = (cell_self.connectionDown.input && b && cell_self.connectionDown.connected) ? 1 : 0

        var res = (resl + resu + resb + resr == 1) || o
        self.active = res;
        return res;
    }

    self.activationFunctionTimer = (cell_self, l, u, r, b, o) => {
        var resl = (cell_self.connectionLeft.input && l && cell_self.connectionLeft.connected)
        var resu = (cell_self.connectionUp.input && u && cell_self.connectionUp.connected)
        var resr = (cell_self.connectionRight.input && r && cell_self.connectionRight.connected)
        var resb = (cell_self.connectionDown.input && b && cell_self.connectionDown.connected)

        var res = (resl || resu || resb || resr)


        if (!self.timer && res != self.active) {
            self.timer = {
                startTime: Date.now(),
                time: 3000,
                newState: res
            }
        }

        return self.active || o;
    }

    self.onGridColRemoval = () => {
        self.cell = NETWORK.connect(self)

        self.cell.connectionLeft.setIONeg(self.connections[self.textureId][0])
        self.cell.connectionUp.setIONeg(self.connections[self.textureId][1])
        self.cell.connectionRight.setIONeg(self.connections[self.textureId][2])
        self.cell.connectionDown.setIONeg(self.connections[self.textureId][3])

        if (self.gateType == 'AND') {
            self.cell.activationFunction = self.activationFunctionAnd
        } else if (self.gateType == 'OR') {
            self.cell.activationFunction = self.activationFunctionOr
        } else if (self.gateType == 'XOR') {
            self.cell.activationFunction = self.activationFunctionXor
        } else if (self.gateType == 'NOR') {
            self.cell.activationFunction = self.activationFunctionNor
        } else if (self.gateType == 'TIMER') {
            self.cell.activationFunction = self.activationFunctionTimer
        }

        self.cell.currentForward = (cell_self, object, value) => {
            for (var i = 0; i < cell_self.connectedObjects.length; i++) {
                if (cell_self.connectedObjects[i].networkActivatable) {
                    cell_self.connectedObjects[i].setActive(cell_self.active);
                }
            }
            cell_self.output(cell_self, self, self.active);
        }

        self.cell.setValue(self, self.active, null);
    }

    self.getColTextureId = (array) => {
        for (var j = 0; j < self.colTexturingMap.length; j++) {
            var map = self.colTexturingMap[j];

            var mismatch = false;

            for (var i = 0; i < array.length; i++) {
                if (map[i] !== array[i]) {
                    mismatch = true;
                    break;
                }
            }

            if (!mismatch) {
                return j;
            }
        }

        return 0;
    }

    self.update = () => {
        superSelf.update()

        if (self.gateType == 'TIMER') {
            if (self.timer) {

                self.timeLeft = Math.ceil((self.timer.time - Date.now() + self.timer.startTime) / 1000);
                if (Date.now() - self.timer.startTime > self.timer.time) {
                    self.active = self.timer.newState;

                    self.timeLeft = -1;
                    delete self.timer;

                    self.cell.setValue(self, self.active, null);
                }
            }
        }
    }

    self.updatePack = () => {
        return {
            timeLeft: self.timeLeft,
            ...superSelf.updatePack()
        }
    }

    self.initPack = () => {
        return {
            gateType: self.gateType,
            ...superSelf.initPack()
        }
    }

    self.gridColRemoval = true;

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

var CubeButton = (initPack = {}) => {
    var self = Button({
        objectType: 'CUBE_BUTTON',
        ...initPack
    });
    return self;
}

var PlayerButton = (initPack = {}) => {
    var self = Button({
        objectType: 'PLAYER_BUTTON',
        ...initPack
    });
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
    }

    self.gridColRemoval = true;

    self.cell = NETWORK.connect(self)

    return self;
}

var Semiwall = (initPack = {}) => {
    var self = NetworkEntity({
        objectType: 'SEMIWALL',
        ...initPack
    });

    self.static = false;

    self.onActiveChanged = (active) => {
        self.transparent = active;
    }

    self.gridColRemoval = true;

    self.cell = NETWORK.connect(self)

    return self;
}

var Cube = (initPack = {}) => {
    var self = LebacEntity({
        objectType: 'CUBE',
        ...initPack
    });

    var superSelf = {
        update: self.update
    }

    self.width = 48;
    self.height = 32;

    self.rotation = Math.PI / 2;
    self.color = self.color = SpoolMath.randomHsvColor(0.5, 0.8);
    self.static = false;

    self.update = () => {
        if (self.player) {
            self.z = 10
        } else if (self.z > 0) {
            self.accZ = -1


        }



        self.velZ += self.accZ;
        self.z += self.velZ;

        if (self.z <= 0) {
            self.accZ = 0;
            self.velX = 0;
            self.velY = 0;
            self.velZ = 0;
            self.z = 0;
        }

        superSelf.update()
    }

    self.gridColRemoval = true;

    return self;
}

var Portal = (initPack = {}) => {
    var self = NetworkEntity({
        objectType: 'PORTAL',
        ...initPack
    });

    var superSelf = {
        initPack: self.initPack,
        updatePack: self.updatePack,
        update: self.update
    }

    self.static = false;

    self.onActiveChanged = (active) => {
        self.transparent = active;
    }

    self.gridColRemoval = true;

    self.cell = NETWORK.connect(self)
    NETWORK.addPortal(self)

    self.update = () => {
        superSelf.update()
        if (self.deletePortedPlayerRecord && self.portedPlayer) {
            self.portedPlayer = null;
        }
        self.deletePortedPlayerRecord = true
    }

    self.initPack = () => {
        return {
            portalColor: self.portalColor,
            ...superSelf.initPack(),
        }
    }

    self.updatePack = () => {
        return {
            ...superSelf.updatePack(),
            active: self.active && !self.portedPlayer
        }
    }

    return self;
}

////// COLLISION MANAGER ///////

var collisionManager = CollisionManager({
        colPairs: [{
                a: ['PLAYER', 'CUBE'],
                b: ['WALL', 'DOORS', 'CUBE'],
                solidException: (a, b) => {
                    return b.transparent
                },
                func: (a, b, col) => {
                    if (a.player && !b.transparent) {
                        a.x = a.player.x
                        a.y = a.player.y
                        if (a.velZ > 0) {
                            a.velZ = 0;
                        }
                    }
                }
            }, {
                a: ['PLAYER', 'CUBE'],
                b: ['BUTTON'],
                solid: false,
                func: (a, b, col) => {
                    if (a.objectType == 'PLAYER') {
                        a.z = 4;
                    }
                    b.activate()
                }
            }, {
                a: ['CUBE'],
                b: ['CUBE_BUTTON'],
                solid: false,
                func: (a, b, col) => {
                    b.activate()
                }
            }, {
                a: ['PLAYER'],
                b: ['PLAYER_BUTTON'],
                solid: false,
                func: (a, b, col) => {
                    if (a.objectType == 'PLAYER') {
                        a.z = 4;
                    }
                }
            }, {
                a: ['CUBE', 'PLAYER'],
                b: ['SEMIWALL'],
                solidException: (a, b) => {
                    if (a.objectType == 'PLAYER' && b.block == "player") {
                        return false
                    } else if (a.objectType == 'CUBE' && b.block == "cube") {
                        return false
                    } else {
                        return true
                    }
                },
                func: (a, b, col) => {
                    if (a.objectType == 'CUBE' && b.block == "cube") {
                        if (a.player) {
                            a.transparent = false
                            if (a.player.hand) {
                                delete a.player.hand
                                a.x = a.player.x
                                a.y = a.player.y
                            }
                            delete a.player
                        }
                    }
                }
            },
            {
                a: ['PLAYER'],
                b: ['SEMIWALL'],
                solid: false,
                func: (a, b, col) => {
                    a.canPickUp = false
                }

            },
            {
                a: ['PLAYER'],
                b: ['PORTAL'],
                solid: false,
                func: (a, b, col) => {
                    if (b.active && !b.portedPlayer) {
                        sibling = NETWORK.getRandomPortalSibling(b)
                        if (sibling) {
                            a.portingCoords = {
                                from: b.id,
                                to: sibling.id,
                                x: sibling.x,
                                y: sibling.y
                            }
                            a.x = sibling.x
                            a.y = sibling.y
                            sibling.portedPlayer = a.id
                        }
                    } else if (b.portedPlayer) {
                        b.deletePortedPlayerRecord = false;
                    }
                }
            }
        ]
    },
    server.handler);
server.handler.addManager(collisionManager);

var objSpawner = ObjectSpawner(server.handler, {
    'GROUND': {
        const: Ground
    },
    'WALL': {
        const: Wall
    },
    'CABLE_R': {
        const: Cable,
        gridColRemovalSiblings: ['CABLE_Y', 'CABLE_CROSS'],
    },
    'CABLE_G': {
        const: Cable,
        gridColRemovalSiblings: ['CABLE_Y', 'CABLE_CROSS']
    },
    'CABLE_Y': {
        const: Cable,
        gridColRemovalSiblings: ['CABLE_R', 'CABLE_G', 'CABLE_CROSS']
    },
    'CABLE_CROSS': {
        const: CableCross
    },
    'BUTTON': {
        const: Button
    },
    'CUBE_BUTTON': {
        const: CubeButton
    },
    'PLAYER_BUTTON': {
        const: PlayerButton
    },
    'DOORS': {
        const: Doors,
        gridColRemovalSiblings: ['WALL'],
    },
    'GATE_AND': {
        const: LogicalGate,
        gridColRemovalSiblings: ['GATE_IO'],
        defs: {
            gateType: "AND"
        }
    },
    'GATE_OR': {
        const: LogicalGate,
        gridColRemovalSiblings: ['GATE_IO'],
        defs: {
            gateType: "OR"
        }
    },
    'GATE_NOR': {
        const: LogicalGate,
        gridColRemovalSiblings: ['GATE_IO'],
        defs: {
            gateType: "NOR"
        }
    },
    'GATE_XOR': {
        const: LogicalGate,
        gridColRemovalSiblings: ['GATE_IO'],
        defs: {
            gateType: "XOR"
        }
    },
    'GATE_TIMER': {
        const: LogicalGate,
        gridColRemovalSiblings: ['GATE_IO'],
        defs: {
            gateType: "TIMER"
        }
    },
    'CUBE': {
        const: Cube
    },
    'SEMIWALL_PLAYER': {
        const: Semiwall,
        defs: {
            block: "player"
        },
        gridColRemovalSiblings: ['WALL']
    },
    'SEMIWALL_CUBE': {
        const: Semiwall,
        defs: {
            block: "cube"
        },
        gridColRemovalSiblings: ['WALL']
    },
    'PORTAL': {
        const: Portal,
        dependantConst: (spawner, colorValue) => {
            return {
                portalColor: colorValue
            }
        }
    }

})

objSpawner.gx = GRID_SIZE;
objSpawner.gy = GRID_SIZE;

NETWORK = Network()

var GATES_OBJECT_SPAWNER = {
    'ff00ff': 'GATE_AND',
    '7bac3a': 'GATE_OR',
    '970024': 'GATE_NOR',
    'ffff00': 'GATE_XOR',
    'b36e1d': 'GATE_TIMER',
    '555555': 'GATE_IO',
}

FileReader.readImage('./maps/lebac_cables.png', (data) => {

    NETWORK.init(data.shape[0], data.shape[1])

    objSpawner.spawnFromImageMap('./maps/lebac_ground.png', {
        'c3c3c3': 'GROUND'
    });

    objSpawner.spawnFromImageMap('./maps/lebac_cables.png', {
        'ff0000': 'CABLE_R',
        '00ff00': 'CABLE_G',
        'ffff00': 'CABLE_Y',
        '7e7e48': 'CABLE_CROSS'
    }, () => {
        objSpawner.spawnFromImageMap('./maps/lebac_gates.png', GATES_OBJECT_SPAWNER, () => {
            objSpawner.spawnFromImageMap('./maps/lebac_gates2.png', GATES_OBJECT_SPAWNER, () => {
                objSpawner.spawnFromImageMap('./maps/lebac_gates3.png', GATES_OBJECT_SPAWNER, () => {
                    objSpawner.spawnFromImageMap('./maps/lebac_objects.png', {
                        'ffffff': 'WALL',
                        'ff0000': 'CABLE',
                        '0000ff': 'BUTTON',
                        '68dd01': 'DOORS',
                        'ab4000': 'CUBE',
                        'ff9000': 'CUBE_BUTTON',
                        'f6c415': 'SEMIWALL_PLAYER',
                        '00ffcc': 'SEMIWALL_CUBE',
                        '008aff': 'PLAYER_BUTTON'
                    }, () => {
                        objSpawner.spawnFromImageMap('./maps/lebac_portals.png', {
                            'non-black': 'PORTAL'
                        }, () => {
                            objSpawner.addZones('./maps/lebac_zones.png', {
                                'ff8484': "SPAWN"
                            }, () => {
                                server.fullStart(Player);
                                server.onPlayerSpawn = (player) => {
                                    Object.assign(player, objSpawner.getRandomPositionInZone('SPAWN'))
                                }
                            })
                        })
                    })
                })
            })
        })
    })
})