const {
    SM_PACK_INIT,
    SM_PACK_UPDATE,
    SM_PACK_REMOVE,
    ASIGN_CLIENT_ID,
    SM_KEY_PRESS,
    SM_MOUSE_INPUT,
    SM_RESET,

    KI_MOV_LEFT,
    KI_MOV_UP,
    KI_MOV_RIGHT,
    KI_MOV_DOWN,

    OS_GET_OBJ,
    OS_SEND_OBJ
} = require('./public/spoolmessagecodes.js')

var CHUNK_SIZE = 300;

const {
    Handler,
    Chunk,
    Entity,
    ObjectSpawner,
    CollisionManager,
    GravityManager,
    OuterWorldManager,
    SpoolTimer,

    SpoolMath,
    SpoolUtils,
    FileReader,


    KeyInputParameters,
    GravityParameters,
    CollisionParameters,
    OvalBodyParameters,
    RectangleBodyParameters,

    Perlin,
    InputManager
} = require('./public/spoolengine.js');



////// SERVER //////

/**
 * Server object wrapper essential for the basic Spool functionality, contains ObjectServer and ServerHandler
 * @param {object} initObject - parameters wrapped in object wrapper 
 * @param {object} rootLocation - location of the root directory 
 * @param {string} publicFolders - static folders first one is used as the location of the html file  
 * @param {string} spoolPublicFolderLocation - location of the spool public location in the root 
 * @param {string} htmlFile - name of the root html file 
 */
var Server = (initObject, rootLocation, publicFolders = ['/public'], spoolPublicFolderLocation = '/spool', htmlFile = 'index.html') => {
    var self = {
        port: 2000,
        socketList: [],
        playerList: [],

        publicFolders: publicFolders,
        rootLocation: rootLocation,

        handler: ServerHandler(),
        updateCounter: 0,
        chunkSize: 600,
        spoolPublicFolderLocation: spoolPublicFolderLocation,

        smartSleeping: true,
        sleepingUpdateTime: 1000,
        sleeping: true,

        upsReport: true,
        sleepingReport: true,

        TPS: 65,
        ...initObject
    }

    CHUNK_SIZE = self.chunkSize;

    self.objectServer = ServerObjectServer(self);
    self.express = require("express");
    self.app = self.express();
    self.http = require("http").createServer(self.app);
    self.io = require("socket.io")(self.http);

    self.updateTime = 1000 / self.TPS;
    self.currentUpdateTime = self.updateTime;

    self.fullStart = (playerConstructor) => {
        self.start()
        self.startSocket(playerConstructor)
        self.startGameLoop()
    }

    self.start = () => {
        console.log('\nEXRESS SERVER START')

        console.log(`Express serving "${self.rootLocation}${publicFolders[0]}/${htmlFile}" as the root html file`);
        self.app.get("/", function (req, res) {
            res.sendFile(`${self.rootLocation}${publicFolders[0]}/${htmlFile}`);
        });

        publicFolders.forEach(publicFolder => {
            console.log('Express static using', `${self.rootLocation}${publicFolder}`, 'as', publicFolder);
            self.app.use(publicFolder, self.express.static(`${self.rootLocation}${publicFolder}`));
        });

        self.app.use('/spool', self.express.static(`${self.rootLocation}${spoolPublicFolderLocation}/public`))

        self.http.listen(self.port, () => {
            console.log("Server started on port: " + self.port);
        });
        console.log('EXRESS SERVER STARTED\n')
    }

    self.startSocket = (playerConstructor) => {
        self.io.sockets.on("connection", socket => {
            //// INIT ////

            // give client the first init package contains all the information about the the state

            // Generate ID
            var id = Math.random();
            socket.id = id;
            // Add socket to the list
            self.socketList[id] = socket;

            // Add player and add it to the list
            var player = playerConstructor({
                id: id
            })

            if (self.onPlayerSpawn) {
                self.onPlayerSpawn(player);
            }

            self.handler.add(player);

            if (self.onPlayerAddedToHandler) {
                self.onPlayerAddedToHandler(player);
            }

            self.playerList[id] = player;

            self.onPlayerCountChangedInternal();

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
                if (self.keyEvent) {
                    self.keyEvent(data, socket, player);
                }
            });

            socket.on(SM_MOUSE_CLICKED, data => {
                if (self.mouseEvent) {
                    self.mouseEvent(data, socket, player);
                }
            });

            self.sendInitPackage(socket, true);

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
                if (self.onPlayerDisconnected) {
                    self.onPlayerDisconnected(self, socket, player);
                }

                self.onPlayerCountChangedInternal();
            });

            if (self.onSocketCreated) {
                self.onSocketCreated(self, socket, player);
            }
        });
    }

    self.sendInitPackage = (socket = server, reset = false) => {
        var initPackage = self.handler.getInitPackage();

        if (reset) {
            initPackage.resetHandler = true;
        }
        // give client the first init package contains all the information about the the state
        socket.emit(SM_PACK_INIT,
            initPackage
        );
    }

    self.smartSleepingUpdate = (playerCount) => {
        if (playerCount == 0) {
            self.sleeping = true;
            self.currentUpdateTime = self.sleepingUpdateTime
        } else {
            self.sleeping = false;
            self.currentUpdateTime = self.updateTime
        }
    }

    self.onPlayerCountChangedInternal = () => {
        var playerCount = Object.keys(self.playerList).length;

        self.smartSleepingUpdate(playerCount);

        if (self.onPlayerCountChanged) {
            self.onPlayerCountChanged(playerCount, self);
        }
    }

    self.onPlayerCountChangedInternal();

    self.emit = (message, data) => {
        if (self.io) {
            self.io.sockets.emit(message, data);
        }
    }

    self.update = () => {
        // Update the game state and get update package
        var pack = self.handler.update();

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
            socket.emit(SM_PACK_UPDATE, pack['general']);

            // Give client his authorized update package 
            if (pack[socket.id]) {
                socket.emit(SM_PACK_UPDATE, pack[socket.id]);
            }

            // Give client the remove package -> remove objects from the game
            if (self.handler.somethingToRemove) {
                socket.emit(SM_PACK_REMOVE, self.handler.removePack);
            }
        }
        // Reset both the init package and remove package
        self.handler.resetPacks();
    }

    self.startGameLoop = () => {
        // Start game loop

        self.lastMillisTimer = Date.now();
        self.lastMillis = Date.now();

        self.lastUpdateTime = Date.now();
        self.loop();
    }

    self.sleep = () => {
        if (self.sleepingReport) {
            console.log('Sleeping');
        }
        if (self.sleeping) {
            setTimeout(self.sleep, self.sleepingUpdateTime);
        } else {
            setTimeout(self.loop);
        }
    }

    self.loop = () => {
        let now = Date.now()
        if (now - self.lastUpdateTime >= self.updateTime) {
            var delta = (now - self.lastUpdateTime) / 1000
            self.lastUpdateTime = now

            self.update(delta);

            if (self.upsReport) {
                var delta = Date.now() - self.lastMillisTimer;
                if (delta >= 1000) {
                    console.log('UPS: ', self.updateCounter);
                    self.updateCounter = 0;
                    self.lastMillisTimer = Date.now()
                } else {
                    self.updateCounter += 1;
                }
            }
        }

        if (!self.sleeping) {
            if (Date.now() - self.lastUpdateTime < self.updateTime - 16) {
                setTimeout(self.loop)
            } else {
                setImmediate(self.loop)
            }
        } else {
            setTimeout(self.sleep);
        }
    }

    self.loop_d = () => {
        setTimeout(self.loop, self.updateTime)
        self.update();

        var delta = Date.now() - self.lastMillisTimer;
        if (delta >= 1000) {
            console.log('UPS: ', self.updateCounter);
            self.updateCounter = 0;
            self.lastMillisTimer = Date.now()
        } else {
            self.updateCounter += 1;
        }
    }

    self.getPlayers = () => {
        return Object.keys(self.playerList).map(key => self.playerList[key]);
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
        objectsById: {},
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

    //// RESET ////

    self.resetObjects = () => {
        Object.assign(self, {
            objectsById: {},
            objects: {}, // All objects in the game
            chunks: {}, // All the chunks in the game 

            somethingToAdd: false, // If there was an object added -> true ->
            initPack: {}, // Package containing all the information about added objects -> in update sent to clients
            somethingToRemove: false, // If there was an object removed -> true s
            removePack: {}, // Package containing all the information about removed objects -> in update sent to clients
        })
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
                    object.chunkColor = chunk.color;
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
        var authorizedPacks = {};

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

                    var sendUpdate = object.sendUpdatePackageAlways || object.asyncUpdateNeeded;

                    if (!sendUpdate) {

                        var change = !preUpdate;

                        if (!change) {
                            for (valueKey in postUpdate) {
                                if (preUpdate[valueKey] !== postUpdate[valueKey]) {
                                    change = true;
                                    break;
                                }
                            }

                            if (change) {
                                sendUpdate = true;
                            }
                        }
                    }

                    if (sendUpdate) {
                        currPackage.push(postUpdate)
                        object.asyncUpdatePackage = {};
                        object.asyncUpdateNeeded = false;
                    }

                    var authPack = object.authorizedUpdatePack();

                    if (authPack) {
                        if (!authorizedPacks[authPack.id]) {
                            authorizedPacks[authPack.id] = {}
                        }
                        if (!authorizedPacks[authPack.id][object.objectType]) {
                            authorizedPacks[authPack.id][object.objectType] = [];
                        }

                        authorizedPacks[authPack.id][object.objectType].push(authPack.package);
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

        return {
            'general': pack,
            ...authorizedPacks
        };
    };

    //// ADDING REMOVING ////

    /**
     * Adds object to the handler
     * @param {object} obj - object we want to add need to contain objecType and idf
     */
    self.add = obj => {
        // Add to handler
        if (!(obj.objectType in self.objects)) {
            self.objects[obj.objectType] = {};
        }
        self.objects[obj.objectType][obj.id] = obj;
        self.objectsById[obj.id] = obj;
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

        delete self.objectsById[id];

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

                // if (key == 'PLAYER') {
                //     console.log(object);
                //     console.log(objKey);
                //     console.log(initPack);
                // }
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

        if (!res) {
            for (key in self.chunks) {
                var chunk = self.chunks[key];
                var temp = chunk.getClosestObject(x, y, attributes);
                if (temp) {
                    if (res ? temp.distance < res.distance : true) {
                        res = temp
                    }
                }
            }
        }

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
    return Chunk(initObject, handler)
}

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

    SpoolTimer,

    SpoolMath,
    SpoolUtils,
    Perlin
}