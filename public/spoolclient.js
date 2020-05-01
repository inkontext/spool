const CAMERA_ROTATION_SPEED = 0.05;
const CAMERA_FOLLOW_SPEED = 0.4;
const CAMERA_SCALE_SPEED = 0.02;
const CAMERA_MINIMAL_SCALE = 0.5;
const CAMERA_MAXIMAL_SCALE = 1;
const CAMERA_MAXIMAL_SCALE_HANDLEVEL = 35;

/**
 * Client object wrapper essential for the basic Spool functionality 
 * @param {object} initObject - parameters wrapped in object wrapper 
 */
var Client = (initObject) => {
    var self = {
        keyToConstructor: {},
        spoolKeyToConstructor: {
            'SPL_POINT': {
                const: Point
            },
            'SPL_LINE': {
                const: Line
            },
            'SPL_RECT': {
                const: Rectangle
            }
        },

        onMouseEvent: (event) => {},
        onKeyEvent: (event) => {},

        lastTime: 0,
        frameCounter: 0,
        chunkSize: 1000,
        FPS: 60,

        pureLocalClient: false,

        updateOnLoop: false,

        ...initObject
    }

    self.frameTime = 1000 / self.FPS;

    //// CLIENT INFORMATION ////

    self.clientId = undefined;
    self.clientObject = undefined;

    //// DIMENSIONS, GAME AREA AND CAMERA ////

    self.width = window.innerWidth;
    self.height = window.innerHeight;

    self.gameArea = GameArea(self.width, self.height);
    self.camera = Camera({
        width: self.width,
        height: self.height,
        canvasWidth: self.width,
        canvasHeight: self.height
    });

    //// HANDLERS AND OBJECT SERVER ////

    self.handler = ClientHandler(self.chunkSize, self, self.pureLocalClient);
    self.uiHandler = SpoolUIHandler();
    self.objectServer = ClientObjectServer(self);

    //// EVENTS ////


    //// SOCKETS ////

    self.socketInit = () => {

        if (self.pureLocalClient) {
            console.warn("You've set the pureLocalClient flag to true, but are initializing sockets.")
        }

        self.socket = io();
        self.socket.on(MessageCodes.SM_PACK_INIT, (data) => {

            if (data.resetHandler) {
                self.handler.reset();
                self.clientObject = undefined;
            }

            for (key in data) {
                if (key == 'resetHandler') {
                    continue;
                }
                // Constructor function, this pointer is filled with constructor function based on the object type
                var constFunction = undefined;

                if (key in self.keyToConstructor) {
                    constFunction = self.keyToConstructor[key]
                } else if (key in self.spoolKeyToConstructor) {
                    constFunction = self.spoolKeyToConstructor[key]
                }

                // If there is constructor for that object type, run every data from that array through that constructor
                if (constFunction) {
                    for (var i = 0; i < data[key].length; i++) {

                        if (!constFunction.const) {
                            console.warn(`Spool: ${key} has invalid constructor function`)
                        }

                        var obj = constFunction.const({
                            ...constFunction.defs,
                            ...data[key][i]
                        });

                        if (!obj) {
                            console.error(`Object ${key} doesn't return anything, check if constructor returns self.`)
                        }

                        obj.clientInstance = self;
                        self.handler.add(obj)
                    }
                } else {
                    console.error(`Object ${key} doesn't have a constructor`)
                }
            }


            if (!self.firstInit) {
                if (self.onFirstLoad)
                    self.onFirstLoad(self)
                self.firstInit = true;
            }
        })

        self.socket.on(MessageCodes.SM_RESET, (data) => {
            self.client.handler.reset();
        })

        self.socket.on(MessageCodes.ASIGN_CLIENT_ID, (data) => {
            self.clientId = data.clientId;
            self.clientObjectFingerprint = data.clientObject;
        })

        //// UPDATING THE STATE ////

        self.socket.on(MessageCodes.SM_PACK_UPDATE, (data) => {
            self.handler.update(data);
            self.camera.update();

            if (self.clientId && !self.clientObject) {
                self.clientObject = self.handler.getObject(self.clientObjectFingerprint.objectType, self.clientObjectFingerprint.id)
                self.camera.followObject = self.clientObject
                if (self.onClientObjectAssigned) {
                    self.onClientObjectAssigned(self.clientObject);
                }
            }
        })

        //// REMOVIGN OBJECTS ////

        self.socket.on(MessageCodes.SM_PACK_REMOVE, (data) => {
            console.log()
            self.handler.removeBulk(data);
        })

        self.objectServer.init(self.socket);
    }

    self.emit = (message, data) => {
        self.socket.emit(message, data);
    }

    //// GAME LOOP ////

    self.startGameLoop = () => {

        // Start game loop

        self.lastMillisTimer = Date.now();
        self.lastMillis = Date.now();

        self.lastFrameTime = Date.now();
        self.loop();
    }

    self.render = () => {
        // Clear the canvas
        self.gameArea.clear();

        try {
            if (self.background) {
                self.background(self.gameArea.ctx, self.camera);
            }

            if (self.preHandler) {
                self.preHandler(self.gameArea.ctx, self.camera);
            }

            // Render objects
            self.handler.render(self.gameArea.ctx, self.camera);

            if (self.postHandler) {
                self.postHandler(self.gameArea.ctx, self.camera);
            }

            if (self.uiHandler) {
                self.uiHandler.render(self.gameArea.ctx);
            }

            if (self.postUi) {
                self.postUi(self.gameArea.ctx, self.camera);
            }

        } catch (e) {
            console.error(e.stack);
        }
    }

    self.loop = () => {
        let now = Date.now()
        if (now - self.lastFrameTime >= self.frameTime) {
            var delta = (now - self.lastFrameTime) / 1000
            self.lastFrameTime = now;

            if (self.loopUpdateCall) {
                self.handler.update();
                self.camera.update();
            }

            self.render();

            var delta = Date.now() - self.lastMillisTimer;

            if (delta >= 1000) {
                console.log('FPS:' + self.frameCounter);
                self.frameCounter = 0;
                self.lastMillisTimer = Date.now();
            } else {
                self.frameCounter += 1;
            }
        }
        setTimeout(self.loop)
    }

    //// GAME AREA ////

    self.initResizeListener = () => {
        window.onresize = e => {
            self.width = window.innerWidth;
            self.height = window.innerHeight;
            self.gameArea.resize(self.width, self.height);
            self.camera.width = self.width;
            self.camera.height = self.height;
        }
    }

    return self;
}

/**
 * Creates the canvas, appends it to the object and holds its context
 * @param {int} width - width of the canvas
 * @param {int} height - height of the canvas
 */
var GameArea = (width = 500, height = 500) => {
    var self = {};

    // Add canvas to the DOM
    self.canvas = document.createElement("CANVAS");
    self.resize = (width, height) => {
        self.width = width;
        self.height = height;
        self.canvas.width = width;
        self.canvas.height = height;
    }
    self.resize(width, height);

    document.body.appendChild(self.canvas);

    self.canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };
    // Get context
    self.ctx = self.canvas.getContext('2d');
    SpoolRenderer.ctx = self.ctx;

    self.clear = () => {
        self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
        self.renderBackground();
    }

    self.renderBackground = () => {
        self.ctx.beginPath();
        self.ctx.rect(0, 0, self.canvas.width, self.canvas.height);
        self.ctx.fillStyle = "white";
        self.ctx.fill();
    }

    return self;
}

/**
 * 
 * @param {object} objectTypeToTexturePairs - [objetType] = textureLinke
 */
var TextureManager = (spriteSheetInitObject, objectSheetInitObject) => {
    var self = {
        spriteSheetInitObject: spriteSheetInitObject,
        objectSheetInitObject: objectSheetInitObject,
        spriteSheets: {},
        objectSheets: {},
        onLoad: null,
        loadCounter: 0,
        targetLoad: 0,

        chunkBlankSize: 500,
        chunkBlankImage: null
    }

    self.load = () => {
        self.textures = {}

        var keys = Object.keys(self.spriteSheetInitObject);

        self.targetLoad = keys.length;



        keys.forEach(key => {
            var image = new Image();
            image.onload = () => {
                var canvas = document.createElement('canvas');
                var context = canvas.getContext('2d');

                var r = self.spriteSheetInitObject[key].r ? self.spriteSheetInitObject[key].r : 1;
                var c = self.spriteSheetInitObject[key].c ? self.spriteSheetInitObject[key].c : 1;

                var subWidth = image.width / c;
                var subHeight = image.height / r;

                canvas.width = subWidth;
                canvas.height = subHeight;

                var sprites = [];
                var shadowSprites = [];


                for (var y = 0; y < r; y++) {
                    for (var x = 0; x < c; x++) {
                        context.clearRect(0, 0, subWidth, subHeight);
                        context.imageSmoothingEnabled = false;
                        context.drawImage(image, x * subWidth, y * subHeight, subWidth, subHeight, 0, 0, subWidth, subHeight);

                        // Getting sprite

                        var sprite = new Image();
                        sprite.src = canvas.toDataURL('image/png');
                        sprites.push(sprite);

                        // Getting shadow sprite

                        var shadowSprite = new Image();
                        var imgData = context.getImageData(0, 0, canvas.width, canvas.height);
                        var pixels = imgData.data;

                        var newPixels = [];
                        for (var siy = canvas.height - 1; siy > -1; siy--) {
                            var newRow = [];
                            for (var six = 0; six < canvas.width; six++) {
                                newRow.push(0, 0, 0, pixels[siy * canvas.width * 4 + six * 4 + 3] / 2)
                            }
                            newPixels.push(...newRow)
                        }

                        for (var i = 0, n = pixels.length; i < n; i++) {
                            pixels[i] = newPixels[i];
                        }

                        context.putImageData(imgData, 0, 0);
                        shadowSprite.src = canvas.toDataURL('image/png');
                        shadowSprites.push(shadowSprite);
                    }
                }

                self.spriteSheets[key] = {
                    title: key,
                    textureMap: image,
                    rows: r,
                    columns: c,
                    sprites: sprites,
                    shadowSprites: shadowSprites
                }

                self.loadCounter += 1;

                if (self.loadCounter >= self.targetLoad && self.onLoad) {
                    self.prepareChunkImage();

                }
                var canvas = document.createElement('canvas');
                var context = canvas.getContext('2d');
            }

            image.src = self.spriteSheetInitObject[key].src;
        })
    }

    self.getSubSpriteSheet = (key, x, y, xx, yy) => {
        var c = xx - x + 1;
        var r = yy - y + 1;

        var sprites = [];
        var shadowSprites = [];

        var spriteSheet = self.spriteSheets[key];

        if (!spriteSheet) {
            console.error(`${key} is not in the texture manager`)
            return null;
        }

        for (var yyy = y; yyy <= yy; yyy++) {
            for (var xxx = x; xxx <= xx; xxx++) {
                var index = yyy * spriteSheet.columns + xxx;
                sprites.push(spriteSheet.sprites[index]);
                shadowSprites.push(spriteSheet.shadowSprites[index])
            }
        }


        return {
            textureMap: spriteSheet.textureMap,
            rows: r,
            columns: c,
            sprites: sprites,
            shadowSprites: shadowSprites
        }
    }

    self.getSprite = (key, x = 0, y = 0) => {
        if (!self.spriteSheets[key]) {
            console.error(`@TextureManager: ${key} is not in spritesheets`);
            return null;
        } else {
            return self.spriteSheets[key].sprites[y * self.spriteSheets[key].columns + x];
        }
    }

    self.getSprites = (key) => {
        if (!self.spriteSheets[key]) {
            console.error(`@TextureManager: ${key} is not in spritesheets`);
            return null;
        } else {
            return self.spriteSheets[key].sprites;
        }
    }

    self.prepareChunkImage = () => {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');

        canvas.width = self.chunkBlankSize;
        canvas.height = self.chunkBlankSize;

        var chunkSprite = new Image();
        chunkSprite.src = canvas.toDataURL('image/png');

        self.chunkBlankImage = chunkSprite

        self.prepareObjectSheets();
    }

    self.prepareObjectSheets = () => {
        if (!self.objectSheetInitObject) {
            console.error('Spool: Invalid objectSheetInitObject')
        }

        var keys = Object.keys(self.objectSheetInitObject);

        self.targetLoad = keys.length;


        keys.forEach(key => {

            // Object sheet information object 
            var info = objectSheetInitObject[key];
            var spriteSheet = self.spriteSheets[info.src];

            var x = SpoolMath.numberDefined(info.x) ? info.x : 0;
            var y = SpoolMath.numberDefined(info.y) ? info.y : 0;
            var xx = SpoolMath.numberDefined(info.xx) ? info.xx : spriteSheet.columns - 1;
            var yy = SpoolMath.numberDefined(info.yy) ? info.yy : spriteSheet.rows - 1;


            var variantWidth = xx - x + 1;
            var variantHeight = yy - y + 1;

            if (info.variantBox) {
                variantWidth = info.variantBox.c;
                variantHeight = info.variantBox.r;
            }

            var variants = [];

            for (var yyy = y; yyy <= yy; yyy += variantHeight) {
                for (var xxx = x; xxx <= xx; xxx += variantWidth) {
                    var temp = self.getSubSpriteSheet(info.src, xxx, yyy, xxx + variantWidth - 1, yyy + variantHeight - 1);


                    temp.title = key;
                    variants.push(temp);
                }
            }


            self.objectSheets[key] = variants;
        })


        self.onLoad();
    }

    self.textureObj = (obj) => {
        var objectVariants = self.objectSheets[obj.objectType];

        if (objectVariants) {
            tid = obj.textureId ? obj.textureId : 0;
            var variantId = SpoolMath.randomInt(0, objectVariants.length - 1);

            var sheet = objectVariants[variantId];
            obj.sprite = sheet.sprites[tid % sheet.sprites.length];
            obj.shadowSprite = sheet.shadowSprites[tid % sheet.sprites.length];
            obj.texture = sheet;
        } else if (obj.objectType == 'SPL_CHUNK') {
            obj.sprite = self.chunkBlankImage;
        }
    }

    self.resizeSprite = (originalSprite, width, height, callback) => {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        context.imageSmoothingEnabled = false;
        context.drawImage(originalSprite, 0, 0, width, height);

        var sprite = new Image();
        sprite.src = canvas.toDataURL('image/png');

        sprite.onload = () => {
            callback(sprite);
        }
    }

    self.resizeSprites = (spriteList, width, height, callback) => {
        if (!width || !height) {
            console.warn("@textureManager resizedSprite: Width and height error")
        }
        var i = 0
        var sprites = []
        var size = spriteList.length
        while (size--) {
            sprites.push(1)
        }
        var counter = 0
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        spriteList.forEach(orgsprite => {
            context.clearRect(0, 0, width, height);
            context.imageSmoothingEnabled = false;
            context.drawImage(orgsprite, 0, 0, width, height);

            var sprite = new Image();
            sprite.posInList = i
            sprite.src = canvas.toDataURL('image/png')
            sprite.onload = (e) => {
                sprites[e.target.posInList] = sprite
                counter += 1
                if (counter == spriteList.length) {
                    callback(sprites)
                }
            }
            i++
        })
    }

    self.bakeIn = (originalTexture, bakedTexture, dBounds, callback, attributes = null) => {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');

        canvas.width = originalTexture.width;
        canvas.height = originalTexture.height;

        context.imageSmoothingEnabled = false;
        context.drawImage(originalTexture, 0, 0);
        context.drawImage(bakedTexture, dBounds.x, dBounds.y, dBounds.width, dBounds.height);

        var sprite = new Image();
        sprite.src = canvas.toDataURL('image/png');

        sprite.onload = () => {
            callback(sprite, attributes);
        }
    }

    self.bakeBatch = (originalTexture, bakingArray, callback, attributes) => {

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');

        canvas.width = originalTexture.width;
        canvas.height = originalTexture.height;

        context.imageSmoothingEnabled = false;


        context.drawImage(originalTexture, 0, 0);

        bakingArray.forEach(bObject => {
            context.drawImage(
                bObject.bakedTexture,
                bObject.dBounds.x,
                bObject.dBounds.y,
                bObject.dBounds.width,
                bObject.dBounds.height);
        })
        var sprite = new Image();
        sprite.src = canvas.toDataURL('image/png');

        sprite.onload = () => {
            callback(sprite, attributes);
        }
    }

    return self;
}

////// MISC //////

cameraContainsEntity = (camera, obj) => {
    let point = {
        x,
        y,
        width,
        height
    } = camera.transformBounds(obj.x, obj.y, obj.radius * 2, obj.radius * 2);

    if (0 <= point.x + point.width / 2 && point.x - point.width / 2 <= camera.width * camera.scale && 0 <= point.y + point.height / 2 && point.y - point.height / 2 <= camera.height * camera.scale) {
        return true;
    }

    return false;
}

var Grid = () => {
    var self = {
        rowGap: 200,
        columnGap: 200
    }

    self.render = (ctx, camera) => {
        var column = camera.x - camera.width * CAMERA.scale;
        var row = camera.y - camera.width * CAMERA.scale;

        while (column < (camera.x + camera.width) / CAMERA.scale) {
            var topY = camera.y - camera.width;
            var bottomY = camera.y + camera.width;
            var topX = column + (-camera.x % self.columnGap);
            var bottomX = column + (-camera.x % self.columnGap);

            let top = {
                x,
                y,
            } = camera.transformPoint(topX, topY);
            topX = top.x;
            topY = top.y;

            let bottom = {
                x,
                y,
            } = camera.transformPoint(bottomX, bottomY);
            bottomX = bottom.x;
            bottomY = bottom.y;


            ctx.beginPath();
            ctx.moveTo(topX, topY);
            ctx.strokeStyle = "gray";
            ctx.lineWidth = 1;
            ctx.lineTo(bottomX, bottomY);
            ctx.stroke();

            column += self.columnGap;
        }
        while (row < (camera.y + camera.width) / CAMERA.scale) {
            var leftY = row + (-camera.y % self.rowGap);
            var rightY = row + (-camera.y % self.rowGap);
            var leftX = camera.x - camera.width;
            var rightX = camera.x + camera.width;

            let left = {
                x,
                y,
            } = camera.transformPoint(leftX, leftY);
            leftX = left.x;
            leftY = left.y;

            let right = {
                x,
                y,
            } = camera.transformPoint(rightX, rightY);
            rightX = right.x;
            rightY = right.y;


            ctx.beginPath();
            ctx.moveTo(leftX, leftY);
            ctx.strokeStyle = "gray";
            ctx.lineTo(rightX, rightY);
            ctx.stroke();

            row += self.rowGap;
        }

    }
    return self;
}

var ObjectRadar = (handler, camera, objectType, radius) => {
    var self = {
        handler,
        camera,
        objectType,
        radius
    }

    self.render = (ctx) => {
        if (camera.followObject) {
            if (self.objectType in self.handler.objects) {
                var objects = self.handler.objects[objectType];

                for (id in objects) {
                    if (id == camera.followObject.id) {
                        continue;
                    }

                    var obj = objects[id];

                    if (cameraContainsEntity(camera, obj)) {
                        continue;
                    }

                    var angle = Math.PI * 2 - SpoolMath.objGlobalAngle(camera.followObject, obj) + camera.rotation;

                    ctx.fillStyle = obj.color;

                    let p = {
                        x,
                        y
                    } = SpoolMath.polarPoint(camera.width / 2 * camera.scale, camera.height / 2 * camera.scale, 200, angle);

                    // drawing arrow 
                    var ox = p.x;
                    var oy = p.y;
                    let a = {
                        x,
                        y
                    } = SpoolMath.polarPoint(p.x, p.y, 20, angle + Math.PI * 3 / 4);
                    let b = {
                        x,
                        y
                    } = SpoolMath.polarPoint(ox, oy, 20, angle + Math.PI * 5 / 4);
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.closePath();
                    ctx.fill();
                    //
                }
            }
        }
    }

    return self;
}

//// Handler ////

var ClientObjectServer = (client, caching = []) => {
    var self = {
        client: client,
        objects: {}
    };

    self.init = () => {
        self.client.socket.on(MessageCodes.OS_SEND_OBJ, data => {
            self.add(data);
        })
    }

    self.load = data => {
        self.client.socket.emit(MessageCodes.OS_GET_OBJ, data);
    }

    self.getObject = (message) => {
        var objectType = message.objectType;
        var id = message.id;

        var objects = self.objects[objectType]
        if (objects) {
            var object = objects[id]
            if (object) {
                return object;
            }
        }
        return null;
    }

    self.add = obj => {
        // Add to handler
        if (!(obj.objectType in self.objects)) {
            self.objects[obj.objectType] = {};
        }

        if (self.objects[obj.objectType][obj.id]) {
            Object.assign(self.objects[obj.objectType][obj.id], obj);
        } else {
            self.objects[obj.objectType][obj.id] = obj;
        }
    };

    self.remove = (type, id) => {
        // Remove object from handler
        if (type in self.objects) {
            delete self.objects[type][id];
        }
    };

    return self;
}

/**
 *  Handler is object that takes cares of drawn elements  
 */
var ClientHandler = (chunkSize, client, pureLocal = false) => {
    var self = Handler({
        client: client,
        chunkSize: chunkSize
    })

    var superSelf = {
        add: self.add
    }

    //// UPDATING ////

    if (!pureLocal) {
        /**
         * @param {object} data   - update package from server ('update' message) 
         *                          example is {PLAYER: [{x:0, y:10, id: 32}]}  
         */
        self.update = (data) => {
            // Go through all the object types (players, bullets, etc.)
            for (key in data) {
                // If there is at least one object of that type 
                if (self.objects[key]) {
                    // Go through all the objects with that type 
                    for (var i = 0; i < data[key].length; i++) {
                        var obj = data[key][i];
                        // Check if the object is present 
                        if (self.objects[key][obj.id]) {
                            // Run update on the object 
                            var updatePack = {
                                ...obj
                            };
                            delete updatePack.id;
                            self.objects[key][obj.id].update(updatePack);
                            self.updateObjectsChunk(self.objects[key][obj.id]);
                        }
                    }
                }
            }
        }
    }

    /**
     * Goes through the objects and renders them
     * @param {canvas context} ctx - context of the game canvas
     */
    self.render = (ctx, camera) => {
        if (true) {
            var min_x = Math.floor((camera.x - camera.width / 2 - 100) / self.chunkSize);
            var min_y = Math.floor((camera.y - camera.height / 2 - 100) / self.chunkSize);
            var max_x = Math.floor((camera.x + camera.width / 2 + 100) / self.chunkSize);
            var max_y = Math.floor((camera.y + camera.height / 2 + 100) / self.chunkSize);
            var chunks = self.getChunks(min_x, min_y, max_x, max_y)
            // var chunks = client.camera.followObject.chunks;

            var allObjects = {}

            var bakingObjects = {}

            for (chunkKey in chunks) {
                var chunk = chunks[chunkKey];
                var objects = chunk.objects;
                if (chunk.sprite) {
                    var bounds = camera.transformBounds(chunk.x * self.chunkSize, (chunk.y + 1) * self.chunkSize, self.chunkSize, self.chunkSize)
                    ctx.drawImage(chunk.sprite, bounds.x, bounds.y, bounds.width, bounds.height)
                }
                for (key in objects) {
                    for (id in objects[key]) {
                        var obj = chunk.objects[key][id];

                        if (obj.bakeIn) {
                            if (obj.bakedIn ? !obj.bakedIn.includes(chunk.key) : true) {
                                var renderBounds = obj.getRenderBounds();

                                var coefX = chunk.sprite.width / self.chunkSize;
                                var coefY = chunk.sprite.height / self.chunkSize;

                                var bakingObject = {
                                    bakedTexture: obj.sprite,
                                    dBounds: {
                                        x: (renderBounds.x - chunk.x * self.chunkSize) * coefX,
                                        y: (self.chunkSize - (renderBounds.y - chunk.y * self.chunkSize) - renderBounds.height) * coefY,
                                        width: renderBounds.width * coefX,
                                        height: renderBounds.height * coefY
                                    },
                                    attributes: {
                                        obj: obj,
                                        chunk: chunk
                                    },
                                    callback: (self, newSprite, attributes) => {
                                        self.attributes.chunk.sprite = newSprite
                                        self.attributes.obj.bakedIn = true;
                                    }
                                };

                                var cKey = chunk.key;

                                if (!(cKey in bakingObjects)) {
                                    bakingObjects[cKey] = {};
                                }
                                if (!(obj.layer in bakingObjects[cKey])) {
                                    bakingObjects[cKey][obj.layer] = [];
                                }

                                bakingObjects[cKey][obj.layer].push(bakingObject);
                            }
                        } else {
                            if (obj.layer in allObjects) {
                                allObjects[obj.layer][id] = obj;
                            } else {
                                allObjects[obj.layer] = {
                                    id: obj
                                };
                            }
                        }
                    }
                }
            }

            //// BAKING OBJECTS //// 

            for (key in bakingObjects) {
                if (key in self.chunks) {
                    var bakingArray = [];
                    var waitingList = [];

                    var sortedChunkLayers = Object.keys(bakingObjects[key]).sort((a, b) => {
                        return parseInt(a) - parseInt(b);
                    })

                    sortedChunkLayers.forEach(layerKey => {

                        var layer = bakingObjects[key][layerKey];
                        layer.forEach(bo => {
                            bakingArray.push({
                                bakedTexture: bo.bakedTexture,
                                dBounds: bo.dBounds
                            })
                            waitingList.push(bo.attributes.obj)
                        })
                    });

                    callback = (sprite, attributes) => {
                        self.chunks[attributes.key].sprite = sprite;
                        waitingList.forEach(o => {
                            if (!o.bakedIn) {
                                o.bakedIn = [attributes.key]
                            } else {
                                o.bakedIn.push(attributes.key)
                            }
                        })
                    }

                    self.textureManager.bakeBatch(
                        self.chunks[key].sprite,
                        bakingArray,
                        callback, {
                            key: key
                        }
                    );
                } else {
                    console.warn('invalid chunk added to baking');
                }
            }

            //// RENDERING OBJECTS ////


            var sortedLayerKeys = Object.keys(allObjects).sort((a, b) => {
                return parseInt(a) - parseInt(b);
            })

            sortedLayerKeys.forEach(layerKey => {
                var sortedKeys = Object.keys(allObjects[layerKey]).sort((a, b) => {
                    return allObjects[layerKey][b].y - allObjects[layerKey][a].y;
                })

                sortedKeys.forEach(key => {
                    allObjects[layerKey][key].render(ctx, camera);
                })
            })
        }
    }

    /**
     * Goes through the objects and renders them
     * @param {canvas context} ctx - context of the game canvas
     */
    self.preBake = () => {
        var chunks = self.chunks;

        var bakingObjects = {}
        for (chunkKey in chunks) {
            var chunk = chunks[chunkKey];
            var objects = chunk.objects;
            for (key in objects) {
                for (id in objects[key]) {
                    var obj = chunk.objects[key][id];
                    self.updateObjectsChunk(obj);

                    if (obj.bakeIn) {
                        if (obj.bakedIn ? !obj.bakedIn.includes(chunk.key) : true) {
                            var renderBounds = obj.getRenderBounds();

                            var coefX = chunk.sprite.width / self.chunkSize;
                            var coefY = chunk.sprite.height / self.chunkSize;

                            var bakingObject = {
                                bakedTexture: obj.sprite,
                                dBounds: {
                                    x: (renderBounds.x - chunk.x * self.chunkSize) * coefX,
                                    y: (self.chunkSize - (renderBounds.y - chunk.y * self.chunkSize) - renderBounds.height) * coefY,
                                    width: renderBounds.width * coefX,
                                    height: renderBounds.height * coefY
                                },
                                callback: (newSprite, attributes) => {
                                    attributes.chunk.sprite = newSprite
                                    attributes.obj.bakedIn = true;
                                },
                                attributes: {
                                    obj: obj,
                                    chunk: chunk
                                }
                            };

                            var cKey = chunk.key;

                            if (!(cKey in bakingObjects)) {
                                bakingObjects[cKey] = {};
                            }
                            if (!(obj.layer in bakingObjects[cKey])) {
                                bakingObjects[cKey][obj.layer] = [];
                            }
                            bakingObjects[cKey][obj.layer].push(bakingObject);
                        }
                    }
                }
            }
        }

        //// BAKING OBJECTS //// 

        for (key in bakingObjects) {
            if (key in self.chunks) {
                var bakingArray = [];
                var waitingList = [];

                var sortedChunkLayers = Object.keys(bakingObjects[key]).sort((a, b) => {
                    return parseInt(a) - parseInt(b);
                })

                sortedChunkLayers.forEach(layerKey => {
                    var layer = bakingObjects[key][layerKey];
                    layer.forEach(bo => {
                        bakingArray.push({
                            bakedTexture: bo.bakedTexture,
                            dBounds: bo.dBounds
                        })
                        waitingList.push(bo.attributes.obj)
                    })
                });

                callback = (sprite, attributes) => {
                    self.chunks[attributes.key].sprite = sprite;
                    attributes.waitingList.forEach(o => {
                        if (!o.bakedIn) {
                            o.bakedIn = [attributes.key]
                        } else {
                            o.bakedIn.push(attributes.key)
                        }
                    })
                }

                self.textureManager.bakeBatch(
                    self.chunks[key].sprite,
                    bakingArray,
                    callback, {
                        key: key,
                        waitingList: waitingList
                    }
                );
            } else {
                console.warn('invalid chunk added to baking');
            }
        }
    }

    //// ADDING REMOVOING ////

    /**
     * adds object to the handler
     * @param {object} obj - object being added 
     */
    self.add = (obj) => {
        superSelf.add(obj);

        if (self.textureManager) {
            self.textureManager.textureObj(obj);
        }
    }

    /**
     * @param {object} data   - remove package from server ('remove' message) 
     *                          example is {PLAYER: [32]}  
     */
    self.removeBulk = (data) => {
        for (key in data) {
            if (key in self.objects) { // If object type in handler (PLAYER type etc.)
                for (var i = 0; i < data[key].length; i++) {
                    if (data[key][i] in self.objects[key]) { // If objects id is in the sub-objects list (If object is in handler)
                        self.remove(self.objects[key][data[key][i]]) // Remove object with the id
                    }
                }
            }
        }
    }

    self.reset = () => {
        var defs = {
            objects: {},
            objectsById: {},
            chunks: {},
            client: client,
            chunkSize: chunkSize
        };

        Object.keys(defs).forEach(key => {
            delete self.key;
        });
        Object.assign(self, defs);
    }

    return self;
}

var ClientChunk = (initObject, handler) => {
    var self = Chunk({
        objectType: "SPL_CHUNK",
        ...initObject
    }, handler);

    return self;
}

//// CAMERA ////

/** */
var Camera = (initPack = {}) => {
    var self = {
        x: 0,
        y: 0,
        rotation: 0,
        width: 0,
        height: 0,
        canvasWidth: 0,
        canvasHeight: 0,
        scaleX: 1,
        scaleY: 1,

        followSpeed: CAMERA_FOLLOW_SPEED,
        rotationSpeed: CAMERA_ROTATION_SPEED,
        followObject: null,

        offsetX: 0,
        offsetY: 0,

        ...initPack
    };

    self.update = () => {
        if (self.followObject) {
            //self.rotation += 0.0

            if (self.lerpRotation) {
                self.rotation = SpoolMath.lerpRotation(self.rotation, self.followObject.rotation - Math.PI / 2, self.rotationSpeed);
            }

            if (self.lerpSpeedToScale) {
                var vel = self.followObject.velocity ? self.followObject.velocity : 0;


            }

            self.width = self.canvasWidth / self.scaleX;
            self.height = self.canvasHeight / self.scaleY;

            if (self.lerp) {
                self.x = SpoolMath.lerp(self.x, self.followObject.x + self.offsetX, self.followSpeed);
                self.y = SpoolMath.lerp(self.y, self.followObject.y + self.offsetY, self.followSpeed);
            }
        } else if (self.followObject) {
            self.x = self.followObject.x + self.offsetX;
            self.y = self.followObject.y + self.offsetY;
        }

        if (self.onUpdate) {
            self.onUpdate(self)
        }
    }

    self.transformBounds = (x, y, width, height) => {

        let point = {
            x,
            y,
        } = self.transformPoint(x, y);

        // console.log(point, point2);

        return {
            x: point.x,
            y: point.y,
            width: width * self.scaleX,
            height: height * self.scaleY
        };
    }

    self.transformPoint = (x, y) => {


        var sin = Math.sin(self.rotation);
        var cos = Math.cos(self.rotation);


        var newX = self.scaleX * ((x - self.x) * cos - (-y + self.y) * sin + self.width / 2);
        var newY = self.scaleY * ((x - self.x) * sin + (-y + self.y) * cos + self.height / 2);

        return {
            x: newX,
            y: newY,
        }
    }

    self.transformDimension = (d) => {
        return self.scaleX * d;
    }

    self.clickTransfer = (x, y) => {
        var dist = SpoolMath.distance(x, y, self.width / 2, self.height / 2);

        var alpha = self.rotation;
        var beta = Math.atan2(y - self.height / 2, x - self.width / 2);

        var gamma = alpha + beta;

        var finalX = self.x + Math.cos(gamma) * dist;
        var finalY = self.y + Math.sin(gamma) * dist;

        return {
            x: finalX,
            y: finalY
        }
    }

    self.inverseTransformPoint = (x, y) => {

        var sin = Math.sin(self.rotation);
        var cos = Math.cos(self.rotation);

        var b = self.y - (-sin * (x / self.scaleX - self.width / 2) + cos * (y / self.scaleY - self.height / 2));
        var a = cos * (x / self.scaleX - self.width / 2) + sin * (y / self.scaleY - self.height / 2) + self.x;

        return {
            x: a,
            y: b,
        }
    }
    self.setFollowObject = (followObject) => {
        if (followObject) {
            self.followObject = followObject;
            self.angle = followObject.angle;
        }
    }

    return self;
}

////// SOCKET //////

//// INITIALIZE ////

/**
 * Entity is client side generalized object that holds many useful methods for game objects
 */
var ClientEntity = (initPack, extending = null) => {
    var defs = {
        x: 0, // x pos 
        y: 0, // y pos (inverted from normal - because of trigonometry and other calculations y=10 is rendered as y=-10
        rotation: 0,
        radius: 10, // radius of the object
        color: 'red', // color of the object
        layer: 10,

        animationCounter: 0,
        animationTime: 0,
        animationFrame: 0,
        animationSize: 0,

        ...initPack // unpacking the init package,
    };
    if (extending) {
        var self = extending(defs);
    } else {
        var self = defs;
    }

    /**
     * function that overrides the self state with data from update package
     */
    self.update = (data) => {
        Object.assign(self, data);
    }

    /**
     * default render method
     */
    self.render = (ctx, camera) => {
        self.renderOval(ctx, camera);
    }

    /**
     * default render method
     */
    self.renderOval = (ctx, camera, color = self.color) => {
        ctx.fillStyle = color;

        var bounds = camera.transformBounds(self.x, self.y, self.width, self.height)
        SpoolRenderer.fillInscribedOval(SpoolRect(bounds.x - bounds.width / 2, bounds.y - bounds.height / 2, bounds.width, bounds.height));
    }

    self.renderNtagon = (ctx, camera, n, radius, startAngle = 0, color = self.color) => {
        ctx.fillStyle = color;
        ctx.beginPath();


        var point = camera.transformBounds(self.x, self.y, radius, radius);

        var r = point.width;

        ctx.moveTo(point.x - r * Math.cos(startAngle), point.y - r * Math.sin(startAngle))

        for (var i = 1; i < n; i++) {
            angle = startAngle + Math.PI * 2 / n * i;
            ctx.lineTo(point.x - r * Math.cos(angle), point.y - r * Math.sin(angle))
        }

        ctx.closePath();
        ctx.fill();
    }

    /**
     * default render method
     */
    self.renderRectangle = (ctx, camera, color = self.color) => {
        var bounds = camera.transformBounds(self.x, self.y, self.width, self.height)

        ctx.beginPath();
        ctx.lineWidth = "1";
        ctx.rect(Math.floor(bounds.x - bounds.width / 2), Math.floor(bounds.y - bounds.height / 2), bounds.width, bounds.height);


        ctx.fillStyle = color;
        ctx.fill();
    }

    /**
     * render texture in bounds
     */
    self.renderSprite = (ctx, camera, sprite = self.sprite, hardBounds = null) => {
        if (sprite) {
            var finalBounds;
            if (!hardBounds) {
                var width = self.width;
                var height = self.height;
                var x = self.x;
                var y = self.y;

                if (self.clientWidth) {
                    width = self.clientWidth;
                }
                if (self.clientHeight) {
                    height = self.clientHeight;
                }

                var bounds = camera.transformBounds(x, y, width, height);

                var offsetX = self.width / 2;
                var offsetY = self.height / 2;

                if (self.clientOffsetX) {
                    offsetX = self.clientOffsetX;
                }
                if (self.clientOffsetY) {
                    offsetY = self.clientOffsetY;
                }

                var offsetBounds = camera.transformBounds(x, y, offsetX, offsetY);

                ctx.imageSmoothingEnabled = false;

                finalBounds = {
                    x: bounds.x - offsetBounds.width,
                    y: bounds.y - offsetBounds.height,
                    width: bounds.width,
                    height: bounds.height
                }
            } else {
                finalBounds = hardBounds;
            }

            ctx.drawImage(sprite, finalBounds.x, finalBounds.y, finalBounds.width, finalBounds.height)
            if (self.showBounds) {
                self.renderRectangle(ctx, camera, self.color);
            }
            return finalBounds;
        } else {
            self.renderRectangle(ctx, camera, 'violet')
            return null;
        }
    }

    self.renderRotatedSprite = (ctx, camera, cx, cy, angle, sprite, bounds) => {
        ctx.save()

        var point = camera.transformPoint(cx, cy);
        ctx.translate(point.x, point.y);

        ctx.rotate(angle)
        ctx.drawImage(sprite, bounds.x, bounds.y, bounds.width, bounds.height)
        ctx.restore()
    }

    self.getMovementAnimationSpriteIndex = (moving = self.moving, angle = self.movementAngle) => {
        var animationRowsNumber = (self.texture.rows - 1);

        if (moving) {

            var angleCoef = angle;
            if (angleCoef < 0) {
                angleCoef += 2 * Math.PI;
            }

            angleCoef = angleCoef / Math.PI / 2 + 1 / animationRowsNumber / 2;
            if (angleCoef < 0) {
                angleCoef += 1;
            }
            angleCoef %= 1;

            var row = Math.floor(angleCoef * animationRowsNumber) % animationRowsNumber + 1;
        } else {
            var row = 0;
        }

        //console.log('sprite');
        return row * self.texture.columns + self.animationFrame;
    }

    self.renderMovementAnimation = (ctx, camera, hardIndex = null) => {
        // Getting the sprite index 

        if (hardIndex) {
            var index = hardIndex;
        } else {
            var index = self.getMovementAnimationSpriteIndex();
        }
        // Counter 

        if (self.animationCounter == self.animationTime) {
            if (self.texture) {
                self.animationFrame += 1;
                if (self.animationFrame == self.texture.columns) {
                    self.animationFrame = 0;
                }
            }

            self.animationCounter = 0;
        } else {
            self.animationCounter += 1;
        }

        return [self.renderSprite(ctx, camera, self.texture.sprites[index]), index]

    }

    self.getRenderBounds = (camera = null) => {
        if (!camera) {
            var offsetX = self.width / 2;
            var offsetY = self.height / 2;

            if (self.clientOffsetX) {
                offsetX = self.clientOffsetX;
            }
            if (self.clientOffsetY) {
                offsetY = self.clientOffsetY;
            }

            var width = self.width;
            var height = self.height;

            if (self.clientWidth) {
                width = self.clientWidth;
            }
            if (self.clientHeight) {
                height = self.clientHeight;
            }

            var bounds = {
                x: self.x - offsetX,
                y: self.y - offsetY,
                width: width,
                height: height
            }
        } else {
            var width = self.width;
            var height = self.height;
            var x = self.x;
            var y = self.y;

            if (self.clientWidth) {
                width = self.clientWidth;
            }
            if (self.clientHeight) {
                height = self.clientHeight;
            }

            var bounds = camera.transformBounds(x, y, width, height);

            var offsetX = self.width / 2;
            var offsetY = self.height / 2;

            if (self.clientOffsetX) {
                offsetX = self.clientOffsetX;
            }
            if (self.clientOffsetY) {
                offsetY = self.clientOffsetY;
            }

            var offsetBounds = camera.transformBounds(x, y, offsetX, offsetY);

            ctx.imageSmoothingEnabled = false;

            finalBounds = {
                x: bounds.x - offsetBounds.width,
                y: bounds.y - offsetBounds.height,
                width: bounds.width,
                height: bounds.height
            }

            return finalBounds
        }

        return bounds;
    }

    return self;
}

var RectangleEntity = (initObject) => {
    var self = ClientEntity(initObject);
    self.render = (ctx, camera) => {
        self.renderRectangle(ctx, camera);
    }
    return self;
}

var SpriteEntity = (initObject) => {
    var self = ClientEntity(initObject);
    self.render = (ctx, camera) => {
        self.renderSprite(ctx, camera);
    }
    return self;
}

var MovementAnimationEntity = (initObject) => {
    var self = ClientEntity({
        ...initObject,
        animationTime: 5
    });

    self.render = (ctx, camera) => {
        self.renderMovementAnimation(ctx, camera);
    }
    return self;
}

var Point = (initObject) => {
    var self = {
        x: 0,
        y: 0,
        xx: 0,
        yy: 0,
        color: 'green',
        ...initObject
    }

    /**
     * function that overrides the self state with data from update package
     */
    self.update = (data) => {
        Object.assign(self, data);
    }

    self.render = (ctx, camera) => {
        ctx.fillStyle = self.color;
        ctx.beginPath();

        let {
            x,
            y,
            width
        } = camera.transformBounds(self.x, self.y, 3, 3);



        ctx.arc(x, y, width, 0, 360);
        ctx.stroke();
    }



    return self;
}

var Line = (initObject) => {
    var self = Entity({
        x: 0,
        y: 0,
        xx: 0,
        yy: 0,
        color: 'green',
        ...initObject
    })

    self.render = (ctx, camera) => {
        let np = camera.transformPoint(self.x, self.y)
        var npp = camera.transformPoint(self.xx, self.yy)

        ctx.strokeStyle = self.color;
        ctx.beginPath();
        ctx.moveTo(np.x, np.y)
        ctx.lineTo(npp.x, npp.y)
        ctx.stroke()


    }

    return self;
}

var Rectangle = (initObject) => {
    var self = {
        x: 0,
        y: 0,
        xx: 0,
        yy: 0,
        color: 'green',
        ...initObject
    }

    /**
     * function that overrides the self state with data from update package
     */
    self.update = (data) => {
        Object.assign(self, data);
    }

    self.render = (ctx, camera) => {
        let np = camera.transformPoint(self.x, self.y)
        var npp = camera.transformPoint(self.xx, self.yy)

        ctx.beginPath();
        ctx.lineWidth = "1";
        ctx.rect(np.x, np.y, npp.x - np.x, npp.y - np.y);

        if (self.fill) {
            ctx.fillStyle = self.color;
            ctx.fill();
        } else {
            ctx.strokeStyle = self.color;
            ctx.stroke();
        }
    }



    return self;
}

////// LISTENERS //////

/**
 * Listener for keyboard
 * @param {object} client - socket.io socket instance important for communication 
 */
var KeyboardListener = (client) => {
    var self = {
        client,

        keyListeners: {
            65: {
                inputMessage: MessageCodes.KI_MOV_LEFT,
                parameter: 'pressedLeft'
            },
            87: {
                inputMessage: MessageCodes.KI_MOV_UP,
                parameter: 'pressedUp'
            },
            68: {
                inputMessage: MessageCodes.KI_MOV_RIGHT,
                parameter: 'pressedRight'
            },
            83: {
                inputMessage: MessageCodes.KI_MOV_DOWN,
                parameter: 'pressedDown'
            }
        }
    };

    self.onEvent = (event, value) => {
        if (event.keyCode in self.keyListeners) {

            listener = self.keyListeners[event.keyCode]

            if (self.client.pureLocalClient) {
                if (self.client.clientObject) {
                    self.client.clientObject[listener.parameter] = value;
                }
            } else {
                self.client.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: listener.inputMessage,
                    value: value
                });
            }
        }
    }

    self.initListener = () => {
        document.onkeydown = event => {
            self.onEvent(event, true);
            if (self.onKeyDown) {
                self.onKeyDown(event)
            }
        }

        document.onkeyup = event => {
            self.onEvent(event, false);
            if (self.onKeyUp) {
                self.onKeyUp(event)
            }
        }
    }

    return self;
}

/**
 * Listener for mouse clicks
 * @param {object} client - socket.io socket instance important for communication 
 */
var MouseListener = (client) => {
    var self = {
        client,
        mouseCoordTransformation: null
    };

    self.onMouseButtonEvent = (event) => {


        if (!self.client.uiHandler.mouseEvent(event)) {
            self.gamePlaneMouseButtonEvent(event);
            self.client.onMouseEvent(event, client);
        }
    }

    self.gamePlaneMouseButtonEvent = (event) => {

        if (event.button === 0) {
            var mousePoint = null;

            if (self.mouseCoordTransformation) {
                mousePoint = self.mouseCoordTransformation(event.clientX, event.clientY);
            } else {
                mousePoint = {
                    x: event.clientX,
                    y: event.clientY
                };
            }



            if (!self.client.pureLocalClient) {
                self.client.socket.emit(MessageCodes.SM_MOUSE_INPUT, {
                    clickedX: mousePoint.x,
                    clickedY: mousePoint.y,
                    type: event.type
                })
            } else {
                if (client.clientObject.mouseEventInWorld) {
                    client.clientObject.mouseEventInWorld(mousePoint.x, mousePoint.y);
                }
            }
        }
    }

    self.initListener = () => {
        document.onmousedown = self.onMouseButtonEvent;
        document.onmouseup = self.onMouseButtonEvent;

        document.onmousemove = event => {
            if (self.client.onMouseMove) {
                self.client.onMouseMove(event);
            }
            self.client.uiHandler.mouseMove(event);
        }
    }

    return self;
}