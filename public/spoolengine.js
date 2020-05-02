////// IMPORTS //////
if (typeof SpoolMath === 'undefined') {
    //var SpoolMath;
    try {
        SpoolMath = require('./spoolmath.js').SpoolMath
    } catch (e) {
        console.warn("SpoolMath require importing failed, require is most likely not present, make sure you are importing SpoolMath in another way");
    }
    if (!SpoolMath) {
        console.error("SpoolMath library not present, make sure it is included")
    }
}

if (typeof SpoolUtils === 'undefined') {
    try {
        SpoolUtils = require('./spoolutils.js').SpoolUtils
    } catch (e) {
        console.warn("SpoolUtils require importing failed, require is most likely not present, make sure you are importing SpoolMath in another way");
    }
    if (!SpoolUtils) {
        console.error("SpoolUtils library not present, make sure it is included")
    }
}

if (typeof FileReader === 'undefined') {
    try {
        FileReader = require('../spoolfilereader.js').FileReader
    } catch (e) {
        console.warn("FileReader require importing failed, require is most likely not present, make sure you are importing SpoolMath in another way");
    }
    if (!FileReader) {
        console.error("FileReader library not present, make sure it is included")
    }
}

try {
    var Perlin = require('perlin-noise');
} catch (e) {
    console.warn("Perlin noise is not available without require (server side)");
}

////// HANDLER //////


/**
 * Chunk holds objects only in certain bounds - used in collision, gravity and more.
 * @param {object} initObject - initObject 
 * @param {object} handler - ServerHandler
 */
var Chunk = (initObject, handler) => {
    var self = {
        x: 0, // x-index in the 2d chunks array (position in grid)
        y: 0, // y-index in the 2d chunks array (position in grid)
        width: 0, // width of the chunk
        height: 0, // height of the chunk
        handler: handler, // Handler instance 

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
    self.removeSignature = (type, id) => {
        // Remove object from handler
        if (type in self.objects) {
            delete self.objects[type][id];
        }
    }

    /**
     * Removes object from the chunk
     * @param {object} obj - object fingerprint
     */
    self.remove = (obj) => {
        self.removeSignature(obj.objectType, obj.id)
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
 * Handler is object that handles all objects in the game (updates them, renders them, sets chunks)
 * Handles chunks, each update objects are assigned to their chunk - used in collision, gravity and more
 */
var Handler = (initObject = {}) => {
    var self = {
        objectsById: {},
        objects: {}, // All objects in the game
        chunks: {}, // All the chunks in the game 

        staticKeys: [], // List of objectTypes that are not updated -> for walls, floors, roofs, trees etc.

        preManagers: [], // Managers that are used before the object.update call
        managers: [], // Managers used after the object.update call

        chunkSize: 300,

        chunkConstructor: Chunk,

        ...initObject,
    }

    //// RESET ////

    self.resetObjects = () => {
        Object.assign(self, {
            objectsById: {},
            objects: {}, // All objects in the game
            chunks: {}, // All the chunks in the game 
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
        var cx = Math.floor((object.x - object.width / 2) / self.chunkSize);
        var cy = Math.floor((object.y - object.height / 2) / self.chunkSize);
        var cxx = Math.floor((object.x + object.width / 2) / self.chunkSize);
        var cyy = Math.floor((object.y + object.height / 2) / self.chunkSize);


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
                    chunk.remove(object);
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
                        chunk = self.chunkConstructor({
                                x: x,
                                y: y,
                                width: self.chunkSize,
                                height: self.chunkSize,
                                key: key,
                                color: SpoolMath.randomHsvColor(0.5, 0.8)
                            },
                            self)
                        self.chunks[key] = chunk;

                        if (self.onChunkCreated) {
                            self.onChunkCreated(chunk);
                        }
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
        for (key in self.objects) {

            if (self.staticKeys.includes(key)) {
                continue;
            }

            var objList = self.objects[key];

            for (objKey in objList) {
                var object = objList[objKey];

                if (!object.static) {
                    for (var i = 0; i < self.preManagers.length; i++) {
                        self.preManagers[i].update(object);
                    }

                    object.update();

                    self.updateObjectsChunk(object);

                    for (var i = 0; i < self.managers.length; i++) {
                        self.managers[i].update(object);
                    }
                }
            }
        }

        for (var i = 0; i < self.managers.length; i++) {
            if (self.managers[i].handlerUpdate)
                self.managers[i].handlerUpdate();
        }
    };

    //// OBJECTS ////

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
    };

    /**
     * Removes object from the handler
     * @param {string} type - object type
     * @param {double} id - id of the object
     */
    self.removeSignature = (type, id) => {
        // Remove object from handler
        if (type in self.objects) {
            if (self.objects[type][id]) {
                if (self.objects[type][id].chunks) {
                    self.objects[type][id].chunks.forEach(chunk => {
                        chunk.remove(self.objects[type][id]);
                    })
                }
            }
            delete self.objects[type][id];
        }

        delete self.objectsById[id];
    };

    /**
     * Removes object from the handler
     * @param {object} obj - object fingerprint
     */
    self.remove = (obj) => {
        self.removeSignature(obj.objectType, obj.id)
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
     * @param {double} objectid - id of the object
     * @param {string} objectType - type of the object (PLAYER, ARROW ...)
     */
    self.getObject = (objectType, objectId) => {
        if (self.objects[objectType]) {
            if (self.objects[objectType][objectId]) {
                return self.objects[objectType][objectId];
            }
        }
        return null;
    }

    /**
     * Returns the closest object to the coordinates and with attributes
     * @param {int} x - x-coord of the point 
     * @param {int} y - y-coord of the point 
     * @param {object} attributes - attributes we want our object to have 
     */
    self.getClosestObject = (x, y, attributes) => {
        var cx = Math.floor(x / self.chunkSize);
        var cy = Math.floor(y / self.chunkSize);

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

    //// MANAGERS ////

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

    //// CHUNKS ////

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

    // Return 
    return self;
};


////// MANAGERS //////

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
                    solid: cp.solid !== undefined ? cp.solid : true,
                    solidException: cp.solidException
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
            Math.floor(x / self.handler.chunkSize),
            Math.floor(y / self.handler.chunkSize),
            Math.floor(xx / self.handler.chunkSize),
            Math.floor(yy / self.handler.chunkSize))
    }

    self.update = (object) => {
        var objectType = object.objectType;

        if (objectType in handler.objects) {

            for (var i = 0; i < self.colPairs.length; i++) {

                var aType = self.colPairs[i].a;
                var harsh = self.colPairs[i].harsh;

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

                                        var col = collision(a, b, harsh);

                                        if (col) {
                                            if (col.result) {
                                                if (self.colPairs[i].solid && col.point) {
                                                    if (self.colPairs[i].solidException ? !self.colPairs[i].solidException(a, b) : true) {
                                                        a.x = Math.round(col.point.x);
                                                        a.y = Math.round(col.point.y);
                                                    }
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

    self.objectRectCollision = (a, b, harsh = false) => {

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
        } else if (harsh) {
            result.point = {
                x: a.px,
                y: a.py,
            }
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


////// TIMER //////

var SpoolTimer = (duration, event, object = null) => {
    var self = {
        startTime: Date.now(),
        duration: duration,
        event: event,
        object: object,
        active: true,
        timeLeft: 0,
    }

    self.update = () => {
        self.timeLeft = self.startTime + self.duration - Date.now()
        if (self.timeLeft < 0 && self.active) {
            self.event(object);
            self.active = false;
        }
    }

    self.stop = () => {
        self.active = false;
    }

    return self;
}

////// OBJECTSPAWNER //////

var ObjectSpawner = (handler, keyToConstAndDefs, inputObject = {}) => {
    var self = {
        keyToConstAndDefs: keyToConstAndDefs, // keyToConstAndDefs[key] = {const: object's constructor - funcpointer, defs: initPack - {object}, }
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

    self.reset = () => {
        Object.assign(self, {
            zones: {},
            zoneCounters: {}
        })
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
            // Spawning empty zone map if first zone 

            if (!self.zoneMap) {
                var resArray = [];
                for (var y = 0; y < data.height; y++) {
                    var resLineArray = [];
                    for (var x = 0; x < data.width; x++) {
                        resLineArray.push({});
                    }
                    resArray.push(resLineArray);
                }

                self.zoneMap = resArray;
            }

            // Adding all the zones present in the map 

            for (var y = 0; y < data.height; y++) {
                var lineArray = [];
                for (var x = 0; x < data.width; x++) {
                    var index = (y * data.width + x) * data.pixelSize;
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

            self.mapPxWidth = data.width;
            self.mapPxHeight = data.height;

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

    self.spawnFromKeyArray = (array, gx = self.gx, gy = self.gy, colorArray = null) => {
        for (var y = 0; y < array.length; y++) {
            for (var x = 0; x < array[y].length; x++) {
                if (array[y][x]) {
                    var pair = keyToConstAndDefs[array[y][x]];
                    if (pair) {

                        var dependantConst = {}
                        if (pair.dependantConst) {
                            dependantConst = pair.dependantConst(self, colorArray ? colorArray[y][x] : null)
                        }

                        var object = pair.const({
                            ...pair.defs,
                            x: parseInt((x - array[y].length / 2) * gx),
                            y: parseInt((-y + array.length / 2) * gy),
                            gridX: x,
                            gridY: y,
                            ...dependantConst
                        })

                        var valueArray = [array[y][x]]

                        if (pair.gridColRemovalSiblings) {
                            valueArray = [array[y][x], ...pair.gridColRemovalSiblings]
                        }



                        if (object.gridColRemoval) {
                            if (x > 0) {
                                if (valueArray.includes(array[y][x - 1])) {
                                    object.leftColIgnore = true;
                                }
                            }
                            if (x < array[y].length - 1) {
                                if (valueArray.includes(array[y][x + 1])) {
                                    object.rightColIgnore = true;
                                }
                            }

                            if (y > 0) {
                                if (valueArray.includes(array[y - 1][x])) {
                                    object.topColIgnore = true;
                                }
                            }
                            if (y < array.length - 1) {
                                if (valueArray.includes(array[y + 1][x])) {
                                    object.bottomColIgnore = true;
                                }
                            }
                            var textureId = self.getColTextureId([!object.leftColIgnore, !object.topColIgnore, !object.rightColIgnore, !object.bottomColIgnore]);
                            object.textureId = textureId;
                            if (object.onGridColRemoval) {
                                object.onGridColRemoval()
                            }
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

    self.spawnFromImageMap = (fileName, colorToKey, callback, gx = self.gx, gy = self.gy) => {
        FileReader.readImage(fileName, (data) => {
            var array = [];

            var objectKeys = Object.keys(self.keyToConstAndDefs);

            var pixels = data.data;

            var nonBlack = colorToKey['non-black']
            var colorArray = []

            for (var y = 0; y < data.height; y++) {
                var lineArray = []
                var colorLine = []
                for (var x = 0; x < data.width; x++) {
                    var index = (y * data.width + x) * data.pixelSize;
                    var r = pixels[index];
                    var g = pixels[index + 1];
                    var b = pixels[index + 2];

                    var colorcode = SpoolMath.rgbToHex(r, g, b);
                    var key = colorToKey[colorcode];

                    if (nonBlack && !key && (r != 0 || g != 0 || b != 0)) {
                        key = nonBlack
                    }

                    if (key) {
                        lineArray.push(key);
                    } else {
                        lineArray.push(null);
                    }

                    colorLine.push([r, g, b, colorcode])
                }
                array.push(lineArray);
                colorArray.push(colorLine)
            }



            self.spawnFromKeyArray(array, gx, gy, colorArray);
            if (callback) {
                callback()
            }
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

    self.getRandomPositionInZone = (zoneType, zoneId = null) => {
        var id = zoneId;
        if (!id) {
            var keys = Object.keys(self.zones[zoneType]);
            id = keys[Math.round(Math.random() * (keys.length - 1))];
        }

        var zone = self.zones[zoneType][id];

        if (zone) {
            var tile = zone[Math.round(Math.random() * (zone.length - 1))];

            var px = (tile[0] - self.mapPxWidth / 2) * self.gx + Math.round(Math.random() * self.gx);
            var py = (-tile[1] + self.mapPxHeight / 2) * self.gy + Math.round(Math.random() * self.gy);

            return ({
                x: px,
                y: py
            })

        } else {
            return null;
        }
    }

    return self;
}

////// ENTITY //////

/**
 * Entity is generalized model of an object, it has some basic funcionality but shouldn't be used without extending upon it
 */
var Entity = (initPack = {}, extending = null) => {
    var defs = {
        //// STATE ////
        asyncUpdatePackage: {},
        asyncUpdateNeeded: false,

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

    if (extending) {
        var self = extending(defs);
    } else {
        var self = defs;
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
            moving: self.moving,
            ...self.asyncUpdatePackage,
        };
    };

    self.authorizedUpdatePack = () => {
        return null;
    }

    self.setAsyncUpdateValue = (name, value) => {

        self.asyncUpdatePackage[name] = value;
        self.asyncUpdateNeeded = true;
    }

    self.addAsyncUpdatePackage = (pack) => {
        Object.assign(self.asyncUpdatePackage, pack);
        self.asyncUpdateNeeded = true;
    }

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

var InputManager = () => {

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

try {
    module.exports = {
        Handler,
        Chunk,

        CollisionManager,
        GravityManager,
        OuterWorldManager,
        InputManager,

        ObjectSpawner,

        Entity,

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
} catch (e) {
    if (typeof module === 'undefined') {
        console.log("Modules are not present, you are probably on client, make sure this script is included before the files that require it");
    } else {
        console.error(e);
    }
}