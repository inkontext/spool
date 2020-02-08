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
        ...initObject
    }

    self.clientId = undefined;
    self.clientObject = undefined;

    self.width = window.innerWidth;
    self.height = window.innerHeight;

    self.socket = io();

    self.camera = Camera({
        width: self.width,
        height: self.height,
        canvasWidth: self.width,
        canvasHeight: self.height
    });
    self.gameArea = GameArea(self.width, self.height);
    self.handler = ClientHandler();

    self.socketInit = () => {
        self.socket.on(MessageCodes.SM_PACK_INIT, (data) => {
            for (key in data) {

                // Constructor function, this pointer is filled with constructor function based on the object type
                var constFunction = undefined;

                if (key in self.keyToConstructor) {
                    constFunction = self.keyToConstructor[key]
                }

                // If there is constructor for that object type, run every data from that array through that constructor
                if (constFunction) {
                    for (var i = 0; i < data[key].length; i++) {
                        var obj = constFunction(data[key][i]);
                        obj.clientInstance = self;
                        self.handler.add(obj)
                    }
                }
            }
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
            }
        })

        //// REMOVIGN OBJECTS ////

        self.socket.on(MessageCodes.SM_PACK_REMOVE, (data) => {
            self.handler.removeBulk(data);
        })
    }

    self.initResizeListener = () => {
        window.onresize = e => {
            self.width = window.innerWidth;
            self.height = window.innerHeight;
            self.gameArea.resize(self.width, self.height);
            self.camera.width = self.width;
            self.camera.height = self.height;
        }
    }

    self.startGameLoop = () => {
        setInterval(() => {
            // Clear the canvas
            self.gameArea.clear();

            if (self.preHandler) {
                self.preHandler();
            }

            // Render objects
            self.handler.render(self.gameArea.ctx, self.camera);

            if (self.postHandler) {
                self.postHandler();
            }
        }, 1000 / 60)
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

    // Get context
    self.ctx = self.canvas.getContext('2d');

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
        collumnGap: 200
    }

    self.render = (ctx, camera) => {
        var collumn = camera.x - camera.width * CAMERA.scale;
        var row = camera.y - camera.width * CAMERA.scale;

        while (collumn < (camera.x + camera.width) / CAMERA.scale) {
            var topY = camera.y - camera.width;
            var bottomY = camera.y + camera.width;
            var topX = collumn + (-camera.x % self.collumnGap);
            var bottomX = collumn + (-camera.x % self.collumnGap);

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

            collumn += self.collumnGap;
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
                    ctx.drawPolygonn
                }
            }
        }
    }

    return self;
}

//// Handler ////

/**
 *  Handler is object that takes cares of drawn elements  
 */
var ClientHandler = () => {
    var self = {
        objects: {}
    }

    //// UPDATING ////

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
        for (key in self.objects) {
            for (id in self.objects[key]) {
                self.objects[key][id].render(ctx, camera);
            }
        }
    }

    //// ADDING REMOVOING ////

    /**
     * adds object to the handler
     * @param {object} obj - object being added 
     */
    self.add = (obj) => {
        if (!(obj.objectType in self.objects)) {
            self.objects[obj.objectType] = {};
        }
        self.objects[obj.objectType][obj.id] = obj;
    }

    /**
     * removes object from the handler
     * @param {object} obj - object being removed 
     */
    self.remove = (obj) => {
        if (obj.objectType in objects) {
            delete self.objects[obj.objectType][obj.id];
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
     * @param {object} data   - remove package from server ('remove' message) 
     *                          example is {PLAYER: [32]}  
     */
    self.removeBulk = (data) => {
        for (key in data) {
            if (key in self.objects) { // If object type in handler (PLAYER type etc.)
                for (var i = 0; i < data[key].length; i++) {
                    if (data[key][i] in self.objects[key]) { // If objects id is in the sub-objects list (If object is in handler)
                        delete self.objects[key][data[key][i]] // Remove object with the id
                    }
                }
            }
        }
    }

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
        scale: 1,
        followSpeed: CAMERA_FOLLOW_SPEED,
        rotationSpeed: CAMERA_ROTATION_SPEED,
        followObject: null,

        ...initPack
    };

    self.update = () => {
        if (self.followObject) {
            self.setFollowObject(self.followObject);
            //self.rotation += 0.0

            self.rotation = SpoolMath.lerpRotation(self.rotation, self.followObject.rotation - Math.PI / 2, self.rotationSpeed);
            //self.rotation = self.followObject.rotation - Math.PI / 2;

            var wantedScale = SpoolMath.lerp(CAMERA_MAXIMAL_SCALE, CAMERA_MINIMAL_SCALE, self.followObject.velocity / CAMERA_MAXIMAL_SCALE_HANDLEVEL);

            self.scale = SpoolMath.lerp(self.scale, wantedScale, CAMERA_SCALE_SPEED);

            self.width = self.canvasWidth / self.scale;
            self.height = self.canvasHeight / self.scale;


            if (self.followObject) {
                self.x = SpoolMath.lerp(self.x, self.followObject.x, self.followSpeed);
                self.y = SpoolMath.lerp(self.y, self.followObject.y, self.followSpeed);
            }
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
            width: width * self.scale,
            height: height * self.scale
        };
    }

    self.transformPoint = (x, y) => {


        var sin = Math.sin(self.rotation);
        var cos = Math.cos(self.rotation);


        var newX = self.scale * ((x - self.x) * cos - (-y + self.y) * sin + self.width / 2);
        var newY = self.scale * ((x - self.x) * sin + (-y + self.y) * cos + self.height / 2);

        return {
            x: newX,
            y: newY,
        }
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

        var b = self.y - (-sin * (x / self.scale - self.width / 2) + cos * (y / self.scale - self.height / 2));
        var a = cos * (x / self.scale - self.width / 2) + sin * (y / self.scale - self.height / 2) + self.x;

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
var Entity = (initPack) => {
    var self = {
        x: 0, // x pos 
        y: 0, // y pos (inverted from normal - because of trigonometry and other calculations y=10 is rendered as y=-10
        rotation: 0,
        radius: 10, // radius of the object
        color: 'red', // color of the object
        ...initPack // unpacking the init package
    };

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
        ctx.fillStyle = self.color;
        ctx.beginPath();

        let {
            x,
            y,
            width
        } = camera.transformBounds(self.x, self.y, self.radius, self.radius);

        ctx.arc(x, y, width, 0, 360);
        ctx.fill();
    }

    return self;
}

////// LISTENERS //////

/**
 * Listener for keyboard
 * @param {object} socket - socket.io socket instance important for communication 
 */
var KeyboardListener = (socket) => {
    var self = {
        socket
    };

    self.initListener = () => {
        document.onkeydown = event => {
            if (event.keyCode === 65) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_LEFT,
                    value: true
                });
            } else if (event.keyCode === 87) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_UP,
                    value: true
                });
            } else if (event.keyCode === 68) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_RIGHT,
                    value: true
                });
            } else if (event.keyCode === 83) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_DOWN,
                    value: true
                });
            }
        }

        document.onkeyup = event => {
            if (event.keyCode === 65) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_LEFT,
                    value: false
                });
            } else if (event.keyCode === 87) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_UP,
                    value: false
                });
            } else if (event.keyCode === 68) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_RIGHT,
                    value: false
                });
            } else if (event.keyCode === 83) {
                self.socket.emit(MessageCodes.SM_KEY_PRESS, {
                    inputId: MessageCodes.KI_MOV_DOWN,
                    value: false
                });
            }
        }
    }

    return self;
}

/**
 * Listener for mouse clicks
 * @param {object} socket - socket.io socket instance important for communication 
 */
var MouseListener = (socket) => {
    var self = {
        socket
    };

    self.initListener = () => {
        document.onmousedown = event => {
            if (event.button === 0) {
                self.socket.emit(MessageCodes.SM_MOUSE_CLICKED, {
                    clickedX: event.clientX,
                    clickedY: event.clientY
                })
            }
        }
    }

    return self;
}