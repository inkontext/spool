const {
    SM_PACK_INIT,
    SM_PACK_UPDATE,
    SM_PACK_REMOVE,
    ASIGN_CLIENT_ID,
    SM_KEY_PRESS,
    SM_MOUSE_CLICKED,

    KI_MOV_LEFT,
    KI_MOV_UP,
    KI_MOV_RIGHT,
    KI_MOV_DOWN
} = require('./spoolmessagecodes.js')

const CHUNK_SIZE = 400;

const {
    SpoolMath
} = require('./spoolmath.js')

////// SERVER //////

/**
 * Server object wrapper essential for the basic Spool functionality 
 * @param {object} initObject - parameters wrapped in object wrapper 
 * @param {string} clientFolder - static folder 
 * @param {string} htmlFile - name of the index.html file 
 */
var Server = (initObject, clientFolder = '/client', htmlFile = 'index.html') => {
    var self = {
        port: 2000,
        socketList: [],
        playerList: [],

        handler: ServerHandler(),

        ...initObject
    }

    self.express = require("express");
    self.app = self.express();
    self.http = require("http").createServer(self.app);
    self.io = require("socket.io")(self.http);

    self.fullStart = (playerConstructor) => {
        self.start()
        self.startSocket(playerConstructor)
        self.startGameLoop()
    }

    self.start = () => {
        self.app.get("/", function (req, res) {
            res.sendFile(__dirname + `${clientFolder}/${htmlFile}`);
        });

        self.app.use(`/`, self.express.static(__dirname + `${clientFolder}`));

        self.http.listen(self.port, () => {
            console.log("Server started on port: " + self.port);
        });
    }

    self.startSocket = (playerConstructor) => {
        self.io.sockets.on("connection", socket => {
            //// INIT ////

            // Generate ID
            var id = Math.random();
            socket.id = id;

            // Add socket to the list
            self.socketList[id] = socket;

            // Add player and add it to the list
            var player = playerConstructor({
                id
            })

            self.playerList[id] = player;

            //// MOVEMENT ////

            socket.on(SM_KEY_PRESS, data => {
                if (data.inputId === KI_MOV_LEFT) {
                    player.pressedLeft = data.value;
                } else if (data.inputId === KI_MOV_UP) {
                    player.pressedUp = data.value;
                } else if (data.inputId === KI_MOV_RIGHT) {
                    player.pressedRight = data.value;
                } else if (data.inputId === KI_MOV_DOWN) {
                    player.pressedDown = data.value;
                }
            });
            socket.on(SM_MOUSE_CLICKED, data => {
                player.shootArrow(data.clickedX, data.clickedY);
            });

            socket.emit(SM_PACK_INIT, {
                ...self.handler.getInitPackage(player.objectType, socket.id)
            }); // give client the first init package contains all the information about the the state

            socket.emit(ASIGN_CLIENT_ID, {
                clientId: socket.id,
                clientObject: {
                    objectType: player.objectType,
                    id: player.id
                }
            }); // give client his id -> so he knows which player he is in control of

            //// END ////

            socket.on("disconnect", () => {
                // Remove player both from the player list and from the socket list
                delete self.socketList[id];
                delete self.playerList[id];
                // Remove player from the handler as a object
                self.handler.remove(player.objectType, id);
            });
        });
    }

    self.startGameLoop = () => {
        // Start game loop
        setInterval(() => {
            // Update the game state and get update package
            var pack = self.handler.update();

            // Go through all the sockets
            for (var i in self.socketList) {
                // Get players socket
                var socket = self.socketList[i];

                // Give client the init package -> objects are added to the client
                if (self.handler.somethingToAdd) {
                    socket.emit(SM_PACK_INIT, self.handler.initPack);
                }

                // Give client the update package -> objects are updateg
                socket.emit(SM_PACK_UPDATE, pack);

                // Give client the remove package -> remove objects from the game
                if (self.handler.somethingToRemove) {
                    socket.emit(SM_PACK_REMOVE, self.handler.removePack);
                }
            }
            // Reset both the init package and remove package
            self.handler.resetPacks();
        }, 1000 / 60);
    }

    return self
}

////// HANDLER //////

/**
 * Handler is object that handles all objects in the game
 * Handles chunks, each update objects are assigned to their chunk - used in collision, gravity and more
 */
var ServerHandler = () => {
    var self = {
        objects: {}, // All objects in the game
        chunks: {},

        somethingToAdd: false, // If there was an object added -> true ->
        initPack: {}, // Package containing all the information about added objects -> in update sent to clients
        somethingToRemove: false, // If there was an object removed -> true s
        removePack: {}, // Package containing all the information about removed objects -> in update sent to clients

        preManagers: [],
        managers: []
    }

    //// UPDATING ////

    self.updateObjectsChunk = (object) => {
        var relocating = false;
        var cx = Math.floor(object.x / CHUNK_SIZE);
        var cy = Math.floor(object.y / CHUNK_SIZE);

        if (!object.chunk) {
            relocating = true;
        } else {
            var ccx = object.chunk.x;
            var ccy = object.chunk.y;
            if (ccx != cx || ccy != cy) {
                relocating = true;
                object.chunk.remove(object);
            } else {
                return;
            }
        }

        if (relocating) {
            var key = `[${cx};${cy}]`

            var chunk = undefined;

            if (key in self.chunks) {
                chunk = self.chunks[key];
            } else {
                chunk = ServerChunk({
                    x: cx,
                    y: cy,
                    width: CHUNK_SIZE,
                    height: CHUNK_SIZE,
                    color: SpoolMath.randomHsvColor(0.5, 0.8)

                })
                self.chunks[key] = chunk;
            }

            chunk.add(object)
            object.chunk = chunk;
            object.color = chunk.color;
        }
    }

    /**
     * updates all of the objects
     * returns update package
     */
    self.update = () => {
        var pack = {};

        for (key in self.objects) {
            var objList = self.objects[key];

            var currPackage = [];

            for (objKey in objList) {
                var object = objList[objKey];

                for (var i = 0; i < self.preManagers.length; i++) {
                    self.preManagers[i].update(object);
                }

                object.update();

                self.updateObjectsChunk(object);

                for (var i = 0; i < self.managers.length; i++) {
                    self.managers[i].update(object);
                }

                currPackage.push(object.updatePack())
            }
            if (currPackage.length != 0) {
                pack[key] = currPackage;
            }
        }

        return pack;
    };

    //// ADDING REMOVOING ////

    /**
     * Adds object to the handler
     * @param {object} obj - object we want to add need to contain objecType and id
     */
    self.add = obj => {
        // Add to handler
        if (!(obj.objectType in self.objects)) {
            self.objects[obj.objectType] = {};
        }
        self.objects[obj.objectType][obj.id] = obj;

        // Add to init pack
        if (!(obj.objectType in self.initPack)) {
            self.initPack[obj.objectType] = [];
        }
        self.initPack[obj.objectType].push(obj.initPack());

        self.somethingToAdd = true;
    };

    /**
     * Removes object from the handler
     * @param {string} type - object type
     * @param {double} id - id of the object
     */
    self.remove = (type, id) => {
        // Remove object from handler
        if (type in self.objects) {
            if (self.objects[type][id]) {
                if (self.objects[type][id].chunk) {
                    self.objects[type][id].chunk.removeObj(self.objects[type][id])
                }
            }
            delete self.objects[type][id];
        }

        // Add to remove pack
        if (!(type in self.removePack)) {
            self.removePack[type] = [];
        }
        self.removePack[type].push(id);

        self.somethingToRemove = true;
    };

    self.removeObj = (obj) => {
        self.remove(obj.objectType, obj.id)
    }

    /**
     * Resets the init and remove packs -> used in update
     */

    self.resetPacks = () => {
        self.initPack = {};
        self.somethingToAdd = false;
        self.removePack = {};
        self.somethingToRemove = false;
    };

    /**
     * Get all init packages from the objects -> similar to update but for init
     */
    self.getInitPackage = (playerType = null, playerId = null) => {
        var pack = {};

        for (key in self.objects) {
            var objList = self.objects[key];

            var currPackage = [];
            for (objKey in objList) {
                var object = objList[objKey];
                var initPack = object.initPack();

                if (objKey == playerId && key == playerType) {
                    initPack["playerFlag"] = true;
                }

                currPackage.push(initPack);
            }

            pack[key] = currPackage;
        }
        return pack;
    };

    self.addManager = (manager) => {
        self.managers.push(manager);
    }

    self.addPreManager = (preManager) => {
        self.preManagers.push(preManager);
    }

    self.getChunks = (min_x, min_y, max_x, max_y) => {
        result = []
        for (var x = min_x; x <= max_x; x++) {
            for (var y = min_y; y <= max_y; y++) {
                var key = `[${x};${y}]`;
                if (key in self.chunks) {
                    result.push(self.chunks[key]);
                }
            }
        }
        return result;
    }

    // Return 
    return self;
};

var ServerChunk = (initObject) => {

    var self = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,

        objects: {},

        ...initObject
    }

    self.add = (obj) => {
        // Add to handler
        if (!(obj.objectType in self.objects)) {
            self.objects[obj.objectType] = {};
        }
        self.objects[obj.objectType][obj.id] = obj;
    }

    self.remove = (type, id) => {
        // Remove object from handler
        if (type in self.objects) {
            delete self.objects[type][id];
        }
    }

    self.removeObj = (obj) => {
        self.remove(obj.objectType, obj.id)
    }

    return self;
}

/**
 * Manager that simulates circle type of collision 
 * @param {object} handler - ServerHandler instance 
 * @param {array} colPairs - array of object pairs that are casting gravity from first object to second 
 */
var CollisionManager = (handler, colPairs) => {
    var self = {
        handler,
        colPairs // array of objects that contain a and b object types
    }

    self.getNeededChunks = (object) => {
        var x = Math.floor(object.x / CHUNK_SIZE);
        var y = Math.floor(object.y / CHUNK_SIZE);
        var xx = Math.floor(object.px / CHUNK_SIZE);
        var yy = Math.floor(object.py / CHUNK_SIZE);

        return self.handler.getChunks(Math.min(x, xx) - object.radius, Math.min(y, yy) - object.radius, Math.max(x, xx) + object.radius, Math.max(y, yy) + object.radius);

    }

    self.update = (object) => {
        var objectType = object.objectType;


        if (objectType in handler.objects) {
            for (var i = 0; i < self.colPairs.length; i++) {

                var aType = self.colPairs[i].a;


                if (objectType == aType) {
                    var bType = self.colPairs[i].b;

                    var chunks = self.getNeededChunks(object);
                    for (var j = 0; j < chunks.length; j++) {
                        var chunk = chunks[j];
                        if (objectType == 'PLAYER');

                        if (bType in chunk.objects) {
                            for (bKey in chunk.objects[bType]) {
                                var a = object;
                                var b = chunk.objects[bType][bKey];

                                if (a.objectType != b.objectType || a.id != b.id) {
                                    if (!colPairs[i].exception ? true : !colPairs[i].exception(a, b)) {
                                        if (self.objectCollision(a, b) && colPairs[i].func) {
                                            colPairs[i].func(a, b);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    self.objectCollision = (a, b) => {
        if (SpoolMath.distance(a.x, a.y, b.x, b.y) < a.radius + b.radius) {
            var b1 = parseInt(a.px);
            var b2 = parseInt(a.py);
            var b3 = parseInt(a.x);
            var b4 = parseInt(a.y);
            var r = b.radius + a.radius;

            var a1 = parseInt(b.x);
            var a2 = parseInt(b.y);


            var newX, newY = 0

            if (b1 != b3) {
                var alpha = (b4 - b2) / (b3 - b1);
                var beta = b2 - b1 * alpha;
                var gamma = beta - a2;

                var quadraA = (alpha * alpha + 1);
                var quadraB = 2 * alpha * gamma - 2 * a1;
                var quadraC = (gamma * gamma + a1 * a1 - r * r);


                var D = Math.sqrt(Math.pow((quadraB), 2) - 4 * quadraA * quadraC);

                var x1 = (-quadraB + D) / (2 * quadraA);
                var x2 = (-quadraB - D) / (2 * quadraA);
                var y1 = alpha * x1 + beta;
                var y2 = alpha * x2 + beta;

                if (SpoolMath.distance(x1, y1, b1, b2) < SpoolMath.distance(x2, y2, b1, b2)) {
                    newX = x1;
                    newY = y1;
                } else {
                    newX = x2;
                    newY = y2;
                }
            } else {
                var x = b1;

                var quadraA = 1;
                var quadraB = -2 * a2;
                var quadraC = a2 * a2 + a1 * a1 - r * r + x * x - 2 * a1 * x;

                var D = Math.sqrt(quadraB * quadraB - 4 * quadraA * quadraC);
                var y1 = (-quadraB + D) / (2 * quadraA);
                var y2 = (-quadraB - D) / (2 * quadraA);

                if (SpoolMath.distance(x, y1, b1, b2) < SpoolMath.distance(x, y2, b1, b2)) {
                    newX = x;
                    newY = y1;
                } else {
                    newX = x;
                    newY = y2;
                }
            }




            var alpha = SpoolMath.globalAngle(b1, b2, a1, a2);
            var beta = SpoolMath.globalAngle(b1, b2, b3, b4);

            var delta = alpha - beta;

            var dist = Math.cos(delta) * SpoolMath.distance(b1, b2, b3, b4);

            var cx = b1 + Math.cos(delta) * dist;
            var cy = b2 + Math.sin(delta) * dist;

            var diffX = b3 - cx;
            var diffY = b4 - cy;

            a.x = newX;
            a.y = newY;


            if (b.groundable && a.findingGround) {

                a.ground = b;
                a.velX = 0;
                a.velY = 0;

            }

            return true;
        }

        return false;
    }

    return self;
}

/**
 * Manager that simulates invisible wall all around the world in set parameter
 * @param {object} handler - instance of ServerHandler
 * @param {array} validObjects - objects that are affected by this outer edge 
 */
var OuterWorldManager = (handler, validObjects) => {
    var self = {
        handler,
        validObjects // array of objects that contain a and b object types
    }

    self.update = (object) => {
        if (self.validObjects.includes(object.objectType)) {
            if (object.objectType in self.handler.objects) {
                var dist = SpoolMath.distance(object.x, object.y, 0, 0);
                if (dist > OUTER_EDGE) {
                    object.setAcc('outer-world', dist / 500, SpoolMath.globalAngle(object.x, object.y, 0, 0));
                } else {
                    object.setAcc('outer-world', 0, 0);
                }
            }
        }
    }

    return self;
}

/**
 * Manager that simulates objectd to object gravity
 * @param {object} handler - instance of ServerHandler
 * @param {array} colPairs - array of object pairs that are casting gravity from first object to second 
 */
var GravityManager = (handler, colPairs) => {
    var self = {
        handler,
        colPairs // array of objects that contain a and b object types
    }

    self.update = (object) => {
        var objectType = object.objectType;



        var firstAngle = object.accelerations['gravity'] ? object.accelerations['gravity'].angle : 0;
        object.setAcc("gravity", 0, firstAngle);

        if (!object.ground && !object.gravityLock) {
            if (objectType in handler.objects) {
                for (var i = 0; i < self.colPairs.length; i++) {

                    var aType = self.colPairs[i].a;


                    if (objectType == aType) {
                        var bType = self.colPairs[i].b;

                        if (bType in handler.objects) {
                            for (bKey in handler.objects[bType]) {
                                var a = object;
                                var b = handler.objects[bType][bKey];

                                if (SpoolMath.objDistance(a, b) < b.radius * GRAVITY_RADIUS_COEF) {
                                    a.addToAcc("gravity", self.objectGravity(a, b), SpoolMath.objGlobalAngle(a, b));
                                }
                            }
                        }
                    }
                }
            }
        }

        object.rotation = object.accelerations["gravity"].angle + Math.PI
    }

    self.objectGravity = (a, b) => {
        var F = G * a.mass * b.mass / Math.pow(SpoolMath.objDistance(a, b), GRAVITY_RADIUS_POW);
        return gravity = F / a.mass;

    }

    return self;
}

var InputManager = () => {

}

////// OBJECTS //////

/**
 * Entity is generalized model of an object, it has some basic funcionality but shouldn't be used without extending upon it
 */
var Entity = (initPack = {}) => {
    var self = {
        //// VELOCITIES ////
        x: 0, // x pos of the objects center
        y: 0, // y pos of the objects center

        velX: 0, // velocity in x direction
        velY: 0, // velocity in y direction

        rotation: 0, // double in radians

        accelerations: {}, // acc[id] = {acc: double, angle: double} -> list of accelerations that are used in velocity calculations
        velocities: {}, // vel[id] = {vel: double, angle:double * in radians} -> list of velocities that are used in position calculations (added velocities)

        color: 'red',

        //// GRAVITY PARAMETERS ////
        ...gravityParameters,

        //// COLLISION PARAMETERS ////
        ...collisionParameters,

        id: Math.random(), // id of the object
        objectType: "BLANK_ENTITY", // type of the object (used in many dictionaries)

        ...initPack
    }

    /**
     * not id of the object but id of the entity - contains both the object type and the object id
     */
    self.getEntityId = () => {
        return objectType + ":" + id;
    };

    /**
     * basic update function -> important return of udpate package (used in server, client communication)
     */
    self.update = () => {
        var change = false;

        self.updateVel();
        change |= self.updatePos();

        return change ? self.updatePack() : null;
    };

    /**
     * returns the initialization package -> package used to create object on clients side
     */
    self.initPack = () => {
        return {
            ...self.updatePack(),

            objectType: self.objectType,
            radius: self.radius,
            color: self.color
        }
    }

    /**
     * returns update package -> package used to update existing object on clients side
     */
    self.updatePack = () => {
        return {
            x: self.x,
            y: self.y,
            color: self.color,
            rotation: self.rotation,
            id: self.id
        };
    };

    //// UPDATING ////

    /**
     * calculate position from object velocity and added velocities
     */
    self.updatePos = () => {
        self.px = self.x;
        self.py = self.y;

        self.x += self.velX;
        self.y += self.velY;

        for (velKey in self.velocities) {
            var vel = self.velocities[velKey];

            var vels = SpoolMath.coordVelsFromVel(vel.vel, vel.angle);

            self.x += vels.x;
            self.y += vels.y;
        }
        return self.x !== self.px || self.y !== self.py
    }

    /**
     * apply an instant kick to the object with value and in certain direction
     */
    self.impulse = (vel, angle) => {
        var vels = SpoolMath.coordVelsFromVel(vel, angle);
        self.velX += vels.x;
        self.velY += vels.y;
    };

    /**
     * calculate velocities from the acceleration list
     */
    self.updateVel = () => {
        for (acckey in self.accelerations) {
            var acc = self.accelerations[acckey];
            var accs = SpoolMath.coordVelsFromVel(acc.acc, acc.angle);
            self.velX += accs.x;
            self.velY += accs.y;
        }
    };

    /**
     * set accelerations value
     */
    self.setAcc = (id, acc, angle) => {
        self.accelerations[id] = {
            acc,
            angle
        };
    };

    self.addToAcc = (id, acc, angle) => {
        var lastAcc = {
            ...self.accelerations[id]
        };

        var xx = lastAcc.acc * Math.cos(lastAcc.angle) + acc * Math.cos(angle);
        var yy = lastAcc.acc * Math.sin(lastAcc.angle) + acc * Math.sin(angle);

        newAcc = Math.sqrt(xx * xx + yy * yy);
        newAngle = Math.atan2(yy, xx);

        self.setAcc(id, newAcc, newAngle);

    }

    /**
     * remove acceleration from acceleration list
     */
    self.removeAcc = id => {
        delete self.accelerations[id];
    };

    /**
     * set added velocities value
     */
    self.setVel = (id, vel, angle) => {
        self.velocities[id] = {
            vel,
            angle
        };
    };

    /**
     * set added velocities value
     */
    self.setVelVector = (id, vel) => {
        self.velocities[id] = {
            vel: SpoolMath.distance(0, 0, vel[0], vel[1]),
            angle: SpoolMath.globalAngle(0, 0, vel[0], vel[1])
        };
    };

    /**
     * remove added velocity from
     */
    self.removeVel = id => {
        delete self.velocities[id];
    };

    //// ADD TO HANDLER ////

    /**
     * adds object to the static handler (the main one present on the server)
     */
    self.addToHandler = (handler) => {
        handler.add(self);
    };

    self.vectorFromVel = () => {
        return {
            angle: Math.atan2(self.velY, self.velX),
            value: SpoolMath.distance(self.velX, self.velY, 0, 0)
        }
    }

    //// RETURN ////
    return self;
};

/**
 * parameters needed for input induced movement 
 */
var keyInputParameters = {
    pressedLeft: false,
    pressedUp: false,
    pressedRight: false,
    pressedDown: false
}

/**
 * parameters needed for gravity manager
 */
var gravityParameters = {
    mass: 1,
    gravityLock: false,
    radius: 10,
}

/**
 * parameters needed for collision manager
 */
var collisionParameters = {
    px: 0,
    py: 0
}


////// EXPORT //////

module.exports = {
    Server,

    ServerHandler,
    CollisionManager,
    GravityManager,
    OuterWorldManager,
    InputManager,

    Entity,
    keyInputParameters,
    gravityParameters,
    collisionParameters,

    SpoolMath
}