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
    KI_MOV_DOWN,

    OS_GET_OBJ,
    OS_SEND_OBJ
} = require('./spoolmessagecodes.js')

const {
    FileReader
} = require('./spoolfilereader.js')

var CHUNK_SIZE = 300;

const {
    SpoolMath
} = require('./spoolmath.js')

////// SERVER //////

/**
 * Server object wrapper essential for the basic Spool functionality, contains ObjectServer and ServerHandler
 * @param {object} initObject - parameters wrapped in object wrapper 
 * @param {string} clientFolder - static folder 
 * @param {string} htmlFile - name of the index.html file 
 */
var Server = (initObject, clientFolders = ['/client'], htmlFile = 'index.html') => {
    var self = {
        port: 2000,
        socketList: [],
        playerList: [],

        handler: ServerHandler(),
        updateCounter: 0,
        chunkSize: 600,
        TPS: 65,
        ...initObject
    }

    CHUNK_SIZE = self.chunkSize;

    self.objectServer = ServerObjectServer(self);
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
            res.sendFile(__dirname + `${clientFolders[0]}/${htmlFile}`);
        });

        clientFolders.forEach(clientFolder => {
            self.app.use(clientFolder, self.express.static(__dirname + `${clientFolder}`));
        });
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

            self.handler.add(player);

            self.playerList[id] = player;

            //// MOVEMENT ////

            self.objectServer.init(socket);

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
                if (self.mouseEvent) {
                    self.mouseEvent(data, socket, player);
                }
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

            if (self.onSocketCreated) {
                self.onSocketCreated(self, socket, player);
            }
        });
    }

    self.startGameLoop = (callback = null) => {
        // Start game loop

        self.lastMillis = Date.now();
        setInterval(() => {
            // Update the game state and get update package
            var pack = self.handler.update();

            if (callback) {
                callback()
            }

            if (self.updateCallback) {
                self.updateCallback(self)
            }

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


            var delta = Date.now() - self.lastMillis;
            if (delta >= 1000) {
                console.log('UPS: ', self.updateCounter);
                self.updateCounter = 0;
                self.lastMillis = Date.now()
            } else {
                self.updateCounter += 1;
            }
        }, 1000 / self.TPS);
    }

    return self
}

////// HANDLER //////
/**
 * ServerObjectServer (SOS) is object that communicates with client side object server and is used as a portal sending and receiving object requests
 * - its point is to hold javascript objects and serve them 
 * @param {object} server - server object  
 * @param {array} caching - automatic object caching 
 */
var ServerObjectServer = (server, caching = []) => {
    var self = {
        server: server,
        objects: {},
        cache: {},
        caching: caching,
    };

    self.init = (socket) => {
        socket.on(OS_GET_OBJ, data => {
            var object = self.getObject(data);
            if (object) {
                object.object.addSubscriber(socket.id);
                socket.emit(OS_SEND_OBJ, object.message)
            }
        })
    }

    //// UPDATE ////

    /**
     * This callback is used in ServerObject and is called on ServerObject.update() function if it is added to the SOS
     * @param {array} subscribers - array of all the sockets we want to send to message to
     * @param {object} returnObject - object we want to send with the socket to client 
     */
    self.updateCallback = (subscribers, returnObject) => {
        subscribers.forEach(sub => {
            self.server.socketList[sub].emit(OS_SEND_OBJ, returnObject);
        });
    }

    //// ADDING ////

    /**
     * Adds object to the server and to the cache
     * @param {object} obj - object we want to add to the server 
     */
    self.add = obj => {
        // Add to handler
        if (!(obj.objectType in self.objects)) {
            self.objects[obj.objectType] = {};
        }
        self.objects[obj.objectType][obj.id] = obj;

        if (self.cache) {
            self.cache(obj);
        }

        obj.updateCallback = self.updateCallback;
    };

    /**
     * Used for caching - storing objects by different parameters for example the x-coord
     * @param {object} obj - object we want to cache 
     */
    self.cache = obj => {
        caching.forEach(cache => {
            if (cache in obj) {
                if (!self.cache[cache]) {
                    self.cache[cache] = {};
                }
                self.cache[cache][obj[cache]] = obj;
            }
        })
    }

    //// REMOVING ////

    /**
     * Removes object from the server
     * @param {string} type - objectType of the object
     * @param {string} id - id of the object 
     */
    self.remove = (type, id) => {
        // Remove object from handler
        if (type in self.objects) {
            delete self.objects[type][id];
        }

        if (self.decache) {
            self.decache(type, id);
        }
    };

    //// GETTING ////

    /**
     * returns object stored in the object server 
     * @param {object} message - object fingerprint
     */
    self.getObject = (message) => {
        var objectType = message.objectType;
        var id = message.id;

        var objects = self.objects[objectType]



        if (objects) {
            var object = objects[id]
            if (object) {
                if (object.returnObject) {
                    return {
                        object: object,
                        message: object.returnObject()
                    };
                } else {
                    return {
                        object: object,
                        message: null
                    };
                }
            }
        }
        return null;
    }

    return self;
}

/**
 * Basic server object holding all the necessary variables and functions 
 * @param {object} initObject - initObject 
 */
var ServerObject = (initObject) => {
    var self = {
        objectType: 'SERVER_OBJECT',
        id: Math.random(),
        subscribers: [],
        updateCallback: null,
        ...initObject
    }

    /**
     * Moves all the parameters from data to self and if updateCallback present calls updateCallback
     * @param {object} data - data that is assigned to self 
     */
    self.update = data => {
        Object.assign(self, data);
        if (self.updateCallback) {
            self.updateCallback(self.subscribers, self.returnObject());
        }
    }

    /**
     * Adds socketId to the subscribers list, this list is used to determine who will recieve the message after update 
     * @param {float} socketId - id of the socket.io socket
     */
    self.addSubscriber = (socketId) => {
        if (!self.subscribers.includes(socketId)) {
            self.subscribers.push(socketId);
        }
    }

    /**
     * Returns object in format suited for server-client sending 
     */
    self.returnObject = () => {
        return self;
    }

    return self;
}

/**
 * Handler is object that handles all objects in the game (updates them, renders them, sets chunks)
 * Handles chunks, each update objects are assigned to their chunk - used in collision, gravity and more
 */
var ServerHandler = () => {
    var self = {
        objects: {}, // All objects in the game
        chunks: {}, // All the chunks in the game 

        somethingToAdd: false, // If there was an object added -> true ->
        initPack: {}, // Package containing all the information about added objects -> in update sent to clients
        somethingToRemove: false, // If there was an object removed -> true s
        removePack: {}, // Package containing all the information about removed objects -> in update sent to clients

        staticKeys: [], // List of objectTypes that are not updated -> for walls, floors, roofs, trees etc.

        preManagers: [], // Managers that are used before the object.update call
        managers: [] // Managers used after the object.update call
    }

    //// UPDATING ////

    /**
     * Updates the chunks in the object - if object travelled from one chunk to another, if changed size, etc.
     * @param {object} object - object we want to move into the correct chunks
     */
    self.updateObjectsChunk = (object) => {
        var relocating = false;

        // Getting the chunk indexes in the lists 
        var cx = Math.floor((object.x - object.width / 2) / CHUNK_SIZE);
        var cy = Math.floor((object.y - object.height / 2) / CHUNK_SIZE);
        var cxx = Math.floor((object.x + object.width / 2) / CHUNK_SIZE);
        var cyy = Math.floor((object.y + object.height / 2) / CHUNK_SIZE);


        if (!object.chunks) {
            // If object isn't in any chunk relocate 
            relocating = true;

        } else if (object.chunks.length == 0) {
            // If object has chunks but the array is empty relocate
            relocating = true;
        } else {
            if (cx != object.chunksX || cy != object.chunksY || cxx != object.chunksXX || cyy != object.chunksYY) {
                // If the object has chunks but are incorrect relocate
                relocating = true;
                object.chunks.forEach(chunk => {
                    chunk.removeObj(object);
                })
            } else {
                return;
            }
        }

        if (!relocating) {
            return;
        }


        // Relocating 

        object.chunksX = cx;
        object.chunksY = cy;
        object.chunksXX = cxx;
        object.chunksYY = cyy;

        object.chunks = [];

        if (relocating) {
            for (var x = cx; x < cxx + 1; x++) {
                for (var y = cy; y < cyy + 1; y++) {
                    var key = `[${x};${y}]`

                    var chunk = undefined;

                    if (key in self.chunks) {
                        chunk = self.chunks[key];
                    } else {
                        chunk = ServerChunk({
                                x: x,
                                y: y,
                                width: CHUNK_SIZE,
                                height: CHUNK_SIZE,
                                color: SpoolMath.randomHsvColor(0.5, 0.8)

                            },
                            self)
                        self.chunks[key] = chunk;
                    }

                    chunk.add(object)
                    object.chunks.push(chunk);
                    object.color = chunk.color;
                }
            }
        }
    }

    /**
     * Updates all of the objects
     * Returns update package
     */
    self.update = () => {
        var pack = {};

        for (key in self.objects) {

            if (self.staticKeys.includes(key)) {
                continue;
            }

            var objList = self.objects[key];

            var currPackage = [];

            for (objKey in objList) {
                var object = objList[objKey];

                if (!object.static) {

                    for (var i = 0; i < self.preManagers.length; i++) {
                        self.preManagers[i].update(object);
                    }

                    var preUpdate = object.lastUpdatePack;

                    object.update();

                    self.updateObjectsChunk(object);

                    for (var i = 0; i < self.managers.length; i++) {
                        self.managers[i].update(object);
                    }

                    var postUpdate = object.updatePack();

                    var change = !preUpdate ? true : false;

                    if (!change) {
                        for (valueKey in postUpdate) {
                            if (preUpdate[valueKey] !== postUpdate[valueKey]) {
                                change = true;
                                break;
                            }
                        }

                        if (change) {
                            currPackage.push(postUpdate)
                            object.asyncUpdatePackage = {};
                        }
                    }

                    object.lastUpdatePack = postUpdate;
                }

            }
            if (currPackage.length != 0) {
                pack[key] = currPackage;
            }
        }

        for (var i = 0; i < self.managers.length; i++) {
            if (self.managers[i].handlerUpdate)
                self.managers[i].handlerUpdate();
        }

        return pack;
    };

    //// ADDING REMOVING ////

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
        self.updateObjectsChunk(obj);

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
                if (self.objects[type][id].chunks) {
                    self.objects[type][id].chunks.forEach(chunk => {
                        chunk.removeObj(self.objects[type][id]);
                    })
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

    /**
     * Removes object from the handler
     * @param {object} obj - object fingerprint
     */
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

    /**
     * Add update manager that is called on object after update 
     * @param {object} manager - manager (CollisionManager, GravityManager, etc.)
     */
    self.addManager = (manager) => {
        self.managers.push(manager);
    }

    /**
     * Add update manager that is called on object before update 
     * @param {object} manager - manager (CollisionManager, GravityManager, etc.)
     */
    self.addPreManager = (preManager) => {
        self.preManagers.push(preManager);
    }

    /**
     * Returns chunks in these intervals 
     * @param {int} min_x - lower bound of the x coord interval for the chunks, value included
     * @param {int} min_y - lower bound of the y coord interval for the chunks, value included
     * @param {int} max_x - upper bound of the x coord interval for the chunks, value included
     * @param {int} max_y - upper bound of the y coord interval for the chunks, value included
     */
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

    /**
     * Removes all the object with object type 
     * @param {string} key - object type that we want to remove from the handler 
     */
    self.emptyObjectType = (key) => {

        if (key in self.objects) {
            var objects = self.objects[key];
            var ids = Object.keys(objects);
            ids.forEach(id => {
                self.remove(key, id);
            })
        }
    }

    /**
     * Returns the closest object to the coordinates and with attributes
     * @param {int} x - x-coord of the point 
     * @param {int} y - y-coord of the point 
     * @param {object} attributes - attributes we want our object to have 
     */
    self.getClosestObject = (x, y, attributes) => {
        var cx = Math.floor(x / CHUNK_SIZE);
        var cy = Math.floor(y / CHUNK_SIZE);

        var chunks = self.getChunks(cx, cy, cx, cy);

        var res = null;

        chunks.forEach(chunk => {
            var temp = chunk.getClosestObject(x, y, attributes);
            if (temp) {
                if (res ? temp.distance < res.distance : true) {
                    res = temp
                }
            }
        })

        return res;
    }

    // Return 
    return self;
};

/**
 * Chunk holds objects only in certain bounds - used in collision, gravity and more.
 * @param {object} initObject - initObject 
 * @param {object} handler - ServerHandler
 */
var ServerChunk = (initObject, handler) => {

    var self = {
        x: 0, // x-index in the 2d chunks array (position in grid)
        y: 0, // y-index in the 2d chunks array (position in grid)
        width: 0, // width of the chunk
        height: 0, // height of the chunk
        handler: handler, // ServerHandler instance 

        objects: {}, // all the objects in the chunk

        ...initObject
    }

    /**
     * Adds object to the chunk
     * @param {object} obj - object
     */
    self.add = (obj) => {
        // Add to handler
        if (!(obj.objectType in self.objects)) {
            self.objects[obj.objectType] = {};
        }
        self.objects[obj.objectType][obj.id] = obj;
    }

    /**
     * Removes object from the chunk
     * @param {string} type - objectType of the object
     * @param {string} id - id of the object
     */
    self.remove = (type, id) => {
        // Remove object from handler
        if (type in self.objects) {
            delete self.objects[type][id];
        }
    }

    /**
     * Removes object from the chunk
     * @param {object} obj - object fingerprint
     */
    self.removeObj = (obj) => {
        self.remove(obj.objectType, obj.id)
    }

    /**
     * Returns the closest object to the coordinates and with attributes
     * @param {int} x - x-coord of the point 
     * @param {int} y - y-coord of the point 
     * @param {object} attributes - attributes we want our object to have 
     */
    self.getClosestObject = (x, y, attributes) => {

        var res = null;


        for (key in self.objects) {
            if (attributes) {
                if (attributes.whitelist) {
                    if (!attributes.whitelist.includes(key)) {
                        continue;
                    }
                }
            }
            for (id in self.objects[key]) {
                var obj = self.objects[key][id];
                var tempDistance = SpoolMath.distance(x, y, obj.x, obj.y);
                if (res ? tempDistance < res.distance : true) {
                    res = {
                        object: obj,
                        distance: tempDistance
                    }
                }
            }
        }

        return res;
    }

    return self;
}

/**
 * Manager that simulates circle type of collision 
 * @param {object} handler - ServerHandler instance 
 * @param {array} colPairs - array of object pairs that are casting gravity from first object to second 
 */
var CollisionManager = (initPack, handler) => {

    var self = {
        handler,
        ...initPack
    }



    self.colPairs.forEach(cp => {

        cp.a.forEach(cpa => {
            cp.b.forEach(cpb => {
                self.colPairs.push({
                    a: cpa,
                    b: cpb,
                    func: cp.func,
                    exception: cp.exception,
                    notSolid: cp.notSolid
                });
            })
        })
    })

    self.getNeededChunks = (object) => {

        if (object.x > object.px) {
            var x = object.px - object.width / 2;
            var xx = object.x + object.width / 2;
        } else {
            var x = object.x - object.width / 2;
            var xx = object.px + object.width / 2;
        }

        if (object.y > object.py) {
            var y = object.py - object.height / 2;
            var yy = object.y + object.height / 2;
        } else {
            var y = object.y - object.height / 2;
            var yy = object.py + object.height / 2;
        }

        return self.handler.getChunks(
            Math.floor(x / CHUNK_SIZE),
            Math.floor(y / CHUNK_SIZE),
            Math.floor(xx / CHUNK_SIZE),
            Math.floor(yy / CHUNK_SIZE))
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

                        if (bType in chunk.objects) {
                            for (bKey in chunk.objects[bType]) {
                                var a = object;
                                var b = chunk.objects[bType][bKey];

                                if (a.objectType != b.objectType || a.id != b.id) {
                                    if (!self.colPairs[i].exception ? true : !self.colPairs[i].exception(a, b)) {

                                        if (a.bodyType == 'oval' && b.bodyType == 'oval') {
                                            var collision = self.objectOvalCollision;
                                        } else {
                                            var collision = self.objectRectCollision;
                                        }

                                        var col = collision(a, b);

                                        if (col) {
                                            if (col.result) {
                                                if (!self.colPairs[i].notSolid && col.point) {
                                                    a.x = Math.round(col.point.x);
                                                    a.y = Math.round(col.point.y);
                                                }
                                                if (self.colPairs[i].func) {
                                                    self.colPairs[i].func(a, b, col);
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
        }
    }

    self.objectOvalCollision = (a, b) => {

        aradius = Math.max(a.width, a.height) / 2;;
        bradius = Math.max(b.width, b.height) / 2;

        if (SpoolMath.distance(a.x, a.y, b.x, b.y) < aradius + bradius) {
            var b1 = parseInt(a.px);
            var b2 = parseInt(a.py);
            var b3 = parseInt(a.x);
            var b4 = parseInt(a.y);
            var r = bradius + aradius;

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

            return {
                result: true,
                x: newX,
                y: newY
            };
        }

        return null;
    }

    self.objMovementLine = obj => {
        return {
            x: obj.px,
            y: obj.py,
            xx: obj.x,
            yy: obj.y
        }
    }

    self.objectRectCollision = (a, b) => {

        var rx = parseInt(b.x - b.width / 2 - a.width / 2);
        var ry = parseInt(b.y - b.height / 2 - a.height / 2);
        var rxx = parseInt(b.x + b.width / 2 + a.width / 2);
        var ryy = parseInt(b.y + b.height / 2 + a.height / 2);


        var objMovementLine = self.objMovementLine(a);

        var result = {
            result: rx < a.x && a.x < rxx && ry < a.y && a.y < ryy
        };

        if (Math.abs(a.x - b.x) >= Math.abs(a.px - b.x) && Math.abs(a.y - b.y) >= Math.abs(a.py - b.y)) {
            return result;
        }

        var intersections = [];
        var lines = [{
            x: rx,
            y: ry,
            xx: rx,
            yy: ryy
        }, {
            x: rxx,
            y: ry,
            xx: rxx,
            yy: ryy
        }, {
            x: rx,
            y: ryy,
            xx: rxx,
            yy: ryy
        }, {
            x: rx,
            y: ry,
            xx: rxx,
            yy: ry
        }]

        var directions = ['right', 'left', 'bottom', 'top'];
        var active = [b.leftColIgnore, b.rightColIgnore, b.topColIgnore, b.bottomColIgnore]
        var counter = 0;

        lines.forEach(line => {

            if (!active[counter]) {
                var intersection = self.lineIntersection(line, objMovementLine);
                // handler.add(Line({
                //     ...line
                // }));
                if (intersection) {
                    intersection.direction = directions[counter]
                }
                intersections.push(intersection);
            } else {
                intersections.push(null);
            }
            counter++;
        })

        var closestIntersection = null;
        var smallestDistance = null;
        var smallestIndex = null;
        counter = 0;
        intersections.forEach(intersection => {
            if (intersection) {
                var dist = SpoolMath.distance(a.px, a.py, intersection.x, intersection.y);

                if (smallestDistance ? dist < smallestDistance : true) {
                    smallestIndex = counter;
                    smallestDistance = dist;
                    closestIntersection = intersection;
                }
            }
            counter++;
        })

        if (closestIntersection) {
            if (smallestIndex <= 1) {
                closestIntersection.y = a.y;
            } else {
                closestIntersection.x = a.x;
            }
            result.point = {
                x: closestIntersection.x,
                y: closestIntersection.y
            };
            result.direction = closestIntersection.direction;
            return result;
        }
        return result;

    }

    /**
     * finds the intersection point of two lines
     * @param {object} a - line defined as {x, y, xx, yy}
     * @param {object} b - line defined as {x, y, xx, yy}
     */
    self.lineIntersection = (a, b) => {
        var x1 = a.x;
        var x2 = a.xx;
        var y1 = a.y;
        var y2 = a.yy;

        var x3 = b.x;
        var x4 = b.xx;
        var y3 = b.y;
        var y4 = b.yy;

        var denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denominator == 0)
            return null;

        var xNominator = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4);
        var yNominator = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4);

        var px = xNominator / denominator;
        var py = yNominator / denominator;

        var offset = 2;

        if (SpoolMath.inInterval(px, x1, x2, offset) && SpoolMath.inInterval(px, x3, x4, offset) && SpoolMath.inInterval(py, y1, y2, offset) && SpoolMath.inInterval(py, y3, y4, offset)) {
            return {
                x: px,
                y: py
            }
        } else {
            return null;
        }
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
var GravityManager = (initPack, handler) => {
    var self = {
        handler,
        gravityType: 'homogenous',
        G: 2,
        colPairs: [], // array of objects that contain a and b object types
        ...initPack
    }

    self.update = (object) => {
        if (self.gravityType == 'homogenous') {
            self.homGravity(object);
        } else {
            self.vecGravity(object);
        }
    }

    //// VECTOR GRAVITY ////

    self.vecGravity = (object) => {
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

                                if (SpoolMath.objDistance(a, b) < bradius * GRAVITY_RADIUS_COEF) {
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
        var F = self.G * a.mass * b.mass / Math.pow(SpoolMath.objDistance(a, b), GRAVITY_RADIUS_POW);
        return gravity = F / a.mass;
    }

    //// HOMOGENOUS ////

    self.homGravity = (object) => {
        if (!object.gravityIgnore) {
            object.setAcc('gravity', self.G, Math.PI / 2 * 3);
        }
    }

    return self;
}

var InputManager = () => {

}

////// OBJECTSPAWNER //////
var ObjectSpawner = (handler, keyToConstAndDefs, inputObject = {}) => {
    var self = {
        keyToConstAndDefs: keyToConstAndDefs, // keyToConstAndDefs[key] = {const: object's constructor - funcpointer, defs: initPack - {object}}
        handler: handler,
        ...inputObject,

        zones: {},
        zoneCounters: {},

        currentZoneMap: null,

        gx: 10,
        gy: 10,

        mapPxWidth: 0,
        mapPxHeight: 0,

        colTexturingMap: [
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
        ]
    }

    self.spawnInRadius = (key, radius, amount, cx = 0, cy = 0) => {
        if (key in self.keyToConstAndDefs) {
            var pair = keyToConstAndDefs[key];
            for (var i = 0; i < amount; i++) {
                var angle = Math.random() * Math.PI * 2;
                var distance = Math.random() * radius;

                var px = cx + distance * Math.cos(angle);
                var py = cy + distance * Math.sin(angle);

                var object = pair.const({
                    ...pair.defs,
                    x: px,
                    y: py
                })

                self.handler.add(object);
            }
        }
    }

    self.spawnInRectangle = (key, size, amount, cx = 0, cy = 0) => {
        if (key in self.keyToConstAndDefs) {
            var pair = keyToConstAndDefs[key];
            for (var i = 0; i < amount; i++) {
                var px = cx - size / 2 + size * Math.random();
                var py = cy - size / 2 + size * Math.random();

                var object = pair.const({
                    ...pair.defs,
                    x: px,
                    y: py
                })

                self.handler.add(object);
            }
        }
    }

    self.zoneStep = (x, y, value, id) => {
        if (self.currentZoneMap[y][x]) {
            var tile = self.currentZoneMap[y][x];
            if (tile.key == value.key && tile.color == value.color) {
                self.zoneMap[y][x][value.key] = id;

                if (!self.zones[value.key]) {
                    self.zones[value.key] = {};
                }

                if (!self.zones[value.key][id]) {
                    self.zones[value.key][id] = [];
                }

                self.zones[value.key][id].push([x, y]);

                self.currentZoneMap[y][x] = null;

                self.zoneStep(x - 1, y, value, id);
                self.zoneStep(x + 1, y, value, id);
                self.zoneStep(x, y - 1, value, id);
                self.zoneStep(x, y + 1, value, id);
            }
        }
    }

    self.addZonesArray = (zoneMaps, colorToZoneType, callback) => {
        self.addZones(zoneMaps[0], colorToZoneType, () => {
            var slice = zoneMaps.slice(1);
            if (slice.length == 0) {
                callback();
            } else {
                self.addZonesArray(slice, colorToZoneType, callback)
            }
        });
    }

    self.addZones = (zoneMap, colorToZoneType, callback) => {
        FileReader.readImage(zoneMap, (data) => {
            var array = [];

            var pixels = data.data;
            var shape = data.shape;
            // Spawning empty zone map if first zone 

            if (!self.zoneMap) {
                var resArray = [];
                for (var y = 0; y < shape[1]; y++) {
                    var resLineArray = [];
                    for (var x = 0; x < shape[0]; x++) {
                        resLineArray.push({});
                    }
                    resArray.push(resLineArray);
                }

                self.zoneMap = resArray;
            }




            // Adding all the zones present in the map 

            for (var y = 0; y < shape[1]; y++) {
                var lineArray = [];
                for (var x = 0; x < shape[0]; x++) {
                    var index = (y * shape[0] + x) * shape[2];
                    var r = pixels[index];
                    var g = pixels[index + 1];
                    var b = pixels[index + 2];

                    var key = colorToZoneType[SpoolMath.rgbToHex(r, g, b)];
                    if (key) {
                        lineArray.push({
                            key: key,
                            color: SpoolMath.rgbToHex(r, g, b)
                        });
                    } else {
                        lineArray.push(null);
                    }
                }

                array.push(lineArray);
            }

            self.mapPxWidth = shape[0];
            self.mapPxHeight = shape[1];

            // Dividing the tiles into the zones 


            var counters = self.zoneCounters;
            self.currentZoneMap = array;

            for (var y = 0; y < self.currentZoneMap.length; y++) {
                for (var x = 0; x < self.currentZoneMap[y].length; x++) {

                    var val = self.currentZoneMap[y][x]

                    if (val) {
                        if (!(val.key in counters)) {
                            counters[val.key] = 0;
                        }

                        self.zoneStep(x, y, val, counters[val.key]);
                        counters[val.key] += 1;
                    }
                }
            }
            self.zoneCounters = counters;

            if (callback) {
                callback();
            }
        });
    }

    self.spawnFromKeyArray = (array, gx = self.gx, gy = self.gy) => {
        for (var y = 0; y < array.length; y++) {
            for (var x = 0; x < array[y].length; x++) {
                if (array[y][x]) {
                    var pair = keyToConstAndDefs[array[y][x]];
                    if (pair) {
                        var object = pair.const({
                            ...pair.defs,
                            x: parseInt((x - array[y].length / 2) * gx),
                            y: parseInt((-y + array.length / 2) * gy)
                        })

                        if (object.gridColRemoval) {
                            if (x > 0) {
                                if (array[y][x - 1] == array[y][x]) {
                                    object.leftColIgnore = true;
                                }
                            }
                            if (x < array[y].length - 1) {
                                if (array[y][x + 1] == array[y][x]) {
                                    object.rightColIgnore = true;
                                }
                            }

                            if (y > 0) {
                                if (array[y - 1][x] == array[y][x]) {
                                    object.topColIgnore = true;
                                }
                            }
                            if (y < array.length - 1) {
                                if (array[y + 1][x] == array[y][x]) {
                                    object.bottomColIgnore = true;
                                }
                            }
                            var textureId = self.getColTextureId([!object.leftColIgnore, !object.topColIgnore, !object.rightColIgnore, !object.bottomColIgnore]);
                            object.textureId = textureId;
                        }

                        if (self.zoneMap) {
                            Object.keys(self.zoneMap[y][x]).forEach(key => {
                                object.zones[key] = self.zoneMap[y][x][key];
                            })
                        }



                        self.handler.add(object);
                    }
                }
            }
        }
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

    self.spawnFromIndexMap = (fileName, gx = self.gx, gy, separator = ' ', lineSeparator = '\r\n') => {
        FileReader.readFile(fileName, (data) => {

            var array = [];

            var objectKeys = Object.keys(self.keyToConstAndDefs);

            var lines = data.split(lineSeparator);
            lines.forEach(line => {
                var keys = line.split(separator);
                xPointer = 0;
                var lineArray = [];
                keys.forEach(key => {
                    var pair = self.keyToConstAndDefs[objectKeys[parseInt(key) - 1]]
                    if (pair) {
                        lineArray.push(objectKeys[parseInt(key) - 1]);
                    } else {
                        lineArray.push(null);
                    }
                })
                array.push(lineArray);
            });

            self.spawnFromKeyArray(array, gx, gy);

        });



    }

    self.spawnFromImageMap = (fileName, colorToKey, gx = self.gx, gy = self.gy) => {
        FileReader.readImage(fileName, (data) => {

            var array = [];

            var objectKeys = Object.keys(self.keyToConstAndDefs);

            var pixels = data.data;
            var shape = data.shape;

            for (var y = 0; y < shape[1]; y++) {
                var lineArray = []
                for (var x = 0; x < shape[0]; x++) {
                    var index = (y * shape[0] + x) * shape[2];
                    var r = pixels[index];
                    var g = pixels[index + 1];
                    var b = pixels[index + 2];

                    var key = colorToKey[SpoolMath.rgbToHex(r, g, b)];
                    if (key) {
                        lineArray.push(key);
                    } else {
                        lineArray.push(null);
                    }
                }
                array.push(lineArray);
            }

            self.spawnFromKeyArray(array, gx, gy);
        });
    }

    self.spawnRPGWorld = (fileObject, colorToKey, gx = self.gx, gy = self.gy) => {
        self.spawnFromImageMap(fileObject.ground, colorToKey, gx, gy);
        self.spawnFromImageMap(fileObject.objects, colorToKey, gx, gy);
    }

    self.spawnInZone = (key, amount, zoneType, zoneId = null) => {
        if (key in self.keyToConstAndDefs) {
            var pair = keyToConstAndDefs[key];

            var zones = self.zones[zoneType]

            if (zones) {
                for (var i = 0; i < amount; i++) {

                    var id = zoneId;
                    if (!id) {
                        var keys = Object.keys(self.zones[zoneType]);
                        id = keys[Math.round(Math.random() * (keys.length - 1))];
                    }

                    var zone = self.zones[zoneType][id];

                    if (zone) {
                        var tile = zone[Math.round(Math.random() * (zone.length - 1))];

                        var px = (tile[0] - self.mapPxWidth / 2) * self.gx + Math.round(Math.random() * self.gx);
                        var py = (-tile[1] + self.mapPxWidth / 2) * self.gy + Math.round(Math.random() * self.gy);

                        var object = pair.const({
                            ...pair.defs,
                            x: px,
                            y: py
                        })

                        self.handler.add(object);
                    }
                }
            }

        }
    }

    return self;
}

////// OBJECTS //////

/**
 * Entity is generalized model of an object, it has some basic funcionality but shouldn't be used without extending upon it
 */
var Entity = (initPack = {}) => {
    var self = {
        //// STATE ////
        asyncUpdatePackage: {},

        //// VELOCITIES ////
        x: 0, // x pos of the objects center
        y: 0, // y pos of the objects center

        velX: 0, // velocity in x direction
        velY: 0, // velocity in y direction

        calculatedVelX: 0,
        calculatedVelY: 0,

        movementAngle: 0,

        rotation: 0, // double in radians

        accelerations: {}, // acc[id] = {acc: double, angle: double} -> list of accelerations that are used in velocity calculations
        velocities: {}, // vel[id] = {vel: double, angle:double * in radians} -> list of velocities that are used in position calculations (added velocities)

        chunks: [],
        chunksX: 0,
        chunksY: 0,
        chunksXX: 0,
        chunksYY: 0,

        color: 'red',
        zones: {},

        //// GRAVITY PARAMETERS ////
        ...GravityParameters,

        //// COLLISION PARAMETERS ////
        ...CollisionParameters,

        ...OvalBodyParameters,

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
        var addedValues = {};

        if (self.textureId !== undefined) {
            addedValues.textureId = self.textureId;
        }

        return {
            ...self.updatePack(),

            objectType: self.objectType,

            width: self.width,
            height: self.height,
            bodyType: self.bodyType,

            color: self.color,

            ...addedValues
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
            id: self.id,
            movementAngle: self.movementAngle,
            moving: self.moving
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

        self.calculatedVelX = 0;
        self.calculatedVelY = 0;

        for (velKey in self.velocities) {
            var vel = self.velocities[velKey];

            var vels = SpoolMath.coordVelsFromVel(vel.vel, vel.angle);

            self.x += vels.x;
            self.y += vels.y;

            self.calculatedVelX += vels.x;
            self.calculatedVelY += vels.y;
        }
        if (self.px != self.x || self.py != self.y) {
            self.movementAngle = SpoolMath.globalAngle(self.px, self.py, self.x, self.y);
            self.moving = true;
            return true;
        } else {
            self.moving = false;
            return true;
        }
    }

    /**
     * apply an instant kick to the object with value and in certain direction
     */
    self.impulse = (vel, angle) => {
        var vels = SpoolMath.coordVelsFromVel(vel, angle);
        self.velX += vels.x;
        self.velY += vels.y;
    };

    self.vectorImpulse = (velX, velY) => {
        self.velX += velX;
        self.velY += velY;
    }

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

////// DEFAULT OBJECTS //////

var Line = (initObject = {}) => {
    var self = {
        x: 0,
        y: 0,
        xx: 0,
        yy: 0,
        color: 'red',
        id: Math.random(),
        objectType: 'SPL_LINE',
        followObjectA: null,
        followObjectB: null,

        ...initObject
    }

    self.width = self.xx - self.x;
    self.height = self.yy - self.y;

    self.update = () => {
        if (self.followObjectA) {
            self.x = self.followObjectA.x
            self.y = self.followObjectA.y
        }
        if (self.followObjectB) {
            self.xx = self.followObjectB.x
            self.yy = self.followObjectB.y
        }
    }

    self.initPack = () => {
        return {
            x: self.x,
            y: self.y,
            xx: self.xx,
            yy: self.yy,
            width: self.width,
            height: self.height,
            color: self.color,
            objectType: self.objectType,
            id: self.id
        }
    }

    self.updatePack = () => {
        return {
            x: self.x,
            y: self.y,
            xx: self.xx,
            yy: self.yy,
            id: self.id
        }
    }

    self.toStr = () => {
        return `Line [${self.x}, ${self.y}, ${self.xx}, ${self.yy}]`
    }

    return self;

}

var Point = (initObject = {}) => {

    var self = {
        x: 0,
        y: 0,
        color: 'red',
        id: Math.random(),
        objectType: 'SPL_POINT',
        followObjectA: null,

        invisible: false,

        ...initObject
    }

    self.initPack = () => {
        return {
            x: self.x,
            y: self.y,
            color: self.color,
            objectType: self.objectType,
            id: self.id
        }
    }

    self.update = () => {
        if (self.followObjectA) {
            self.x = self.followObjectA.x
            self.y = self.followObjectA.y
        }
    }
    self.updatePack = () => {
        return {
            x: self.x,
            y: self.y,
            id: self.id
        }
    }

    return self;
}

var Rectangle = (initObject = {}) => {
    var self = {
        x: 0,
        y: 0,
        xx: 0,
        yy: 0,
        color: 'red',
        id: Math.random(),
        objectType: 'SPL_RECT',
        followObjectA: null,
        followObjectB: null,

        invisible: false,

        ...initObject
    }

    self.update = () => {
        if (self.followObjectA) {
            self.x = self.followObjectA.x
            self.y = self.followObjectA.y
        }
        if (self.followObjectB) {
            self.xx = self.followObjectB.x
            self.yy = self.followObjectB.y
        }
    }

    self.initPack = () => {
        return {
            x: self.x,
            y: self.y,
            xx: self.xx,
            yy: self.yy,
            color: self.color,
            objectType: self.objectType,
            id: self.id,
            invisible: self.invisible,
            fill: self.fill
        }
    }

    self.updatePack = () => {
        return {
            x: self.x,
            y: self.y,
            xx: self.xx,
            yy: self.yy,
            id: self.id,
            invisible: self.invisible
        }
    }

    self.toStr = () => {
        return `Line [${self.x}, ${self.y}, ${self.xx}, ${self.yy}]`
    }

    return self;
}

////// OBJECT PARAMETERS //////

/**
 * parameters needed for input induced movement 
 */
var KeyInputParameters = {
    pressedLeft: false,
    pressedUp: false,
    pressedRight: false,
    pressedDown: false
}

/**
 * parameters needed for gravity manager
 */
var GravityParameters = {
    mass: 1,
    gravityLock: false
}

/**
 * parameters needed for collision manager
 */
var CollisionParameters = {
    px: 0,
    py: 0
}

/**
 * oval body parameters
 */
var OvalBodyParameters = {
    bodyType: 'oval',
    width: 10,
    height: 10
}

var RectangleBodyParameters = {
    bodyType: 'rect',
    width: 10,
    height: 10
}

////// EXPORT //////

module.exports = {
    Server,

    ServerObjectServer,
    ServerObject,
    ServerHandler,
    CollisionManager,
    GravityManager,
    OuterWorldManager,
    InputManager,

    ObjectSpawner,

    Entity,
    Line,
    Rectangle,
    KeyInputParameters,
    GravityParameters,
    CollisionParameters,
    OvalBodyParameters,
    RectangleBodyParameters,

    SpoolMath
}