////// CLIENT //////

const PLAYER = 'PLAYER';
const ANIMAL = 'ANIMAL';
const NPC = 'NPC';

const EQUIPMENT_UI_BUTTON_POSITIONS = [
    //helm
    {
        x: 0,
        y: 0
    },
    {
        x: 0,
        y: 60
    },
    {
        x: 0,
        y: 120
    },
    {
        x: 70,
        y: 120
    },
    {
        x: 70,
        y: 60
    }
]


///// RENDERING FUNCTIONS /////

var renderName = (self, ctx, camera) => {
    if (self.name) {
        var tx = self.x;
        var ty = self.y + 10;

        if (self.clientOffsetY) {
            ty += self.clientOffsetY;
        } else {
            ty += self.height;
        }

        var point = camera.transformPoint(tx, ty);


        if (self.objectType == PLAYER) {
            ctx.fillStyle = '#002f4a';
            ctx.font = "bold 22px Arial";
        } else if (self.objectType == ANIMAL) {
            ctx.font = "bold 14px Arial";
            ctx.fillStyle = '#2f0000';
        } else {
            ctx.font = "bold 14px Arial";
            ctx.fillStyle = '#ffff00';
        }

        ctx.fillText(self.name, point.x, point.y);
    }
}

var renderMessage = (self, ctx, camera) => {
    if (self.message) {
        var tx = self.x;
        var ty = self.y + 10;

        if (self.clientOffsetY) {
            ty += self.clientOffsetY / 2;
        } else {
            ty += self.height / 2;
        }

        if (self.clientOffsetX) {
            tx += self.clientOffsetX;
        } else {
            tx += self.width;
        }

        var point = camera.transformPoint(tx, ty);



        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 18px Arial";


        ctx.textAlign = 'left';
        ctx.fillText(self.message, point.x, point.y);
        ctx.textAlign = 'center';
    }
}

///// OBJECTS /////

var RPGEntity = (initObject) => {
    var self = SpriteEntity(initObject);
    var superSelf = {
        ...self
    };

    self.superRenderSprite = self.renderSprite;
    self.sSprite = textureManager.getSprite('shadow', 0, 0);

    self.renderSprite = (ctx, camera, sprite = self.sprite, hardBounds = null) => {
        var bounds = self.superRenderSprite(ctx, camera, sprite, hardBounds);
        renderName(self, ctx, camera);
        renderMessage(self, ctx, camera);
        // var y = camera.transformDimension(self.clientOffsetY);
        // var h = camera.transformDimension(self.clientHeight);
        // bounds.y += 2 * y - h;
        // self.superRenderSprite(ctx, camera, self.shadowSprite, bounds);
        return bounds;
    }

    return self;
}

var RPGMovementEntity = (initObject) => {
    var self = MovementAnimationEntity(initObject);

    self.superRenderMovementAnimation = self.renderMovementAnimation;
    self.sSprite = textureManager.getSprite('shadow', 0, 0);
    self.renderMovementAnimation = (ctx, camera) => {

        var shadowBounds = camera.transformBounds(self.x - self.width / 2, self.y + self.height / 2, self.width, self.height);
        self.renderSprite(ctx, camera, self.sSprite, shadowBounds)

        var res = self.superRenderMovementAnimation(ctx, camera);
        renderMessage(self, ctx, camera);

        renderName(self, ctx, camera);

        return res;
    }

    return self;
}

var Fireball = (initObject) => {
    var self = RPGEntity(initObject);
    self.render = (ctx, camera) => {
        self.clientOffsetY = self.z;
        self.renderSprite(ctx, camera)
    }
    return self;
}

var Wall = (initObject) => {
    var self = RPGEntity(initObject);

    self.render = (ctx, camera) => {
        var bounds = null;
        var wallHeight = 1;

        if (client.clientObject ? client.clientObject.roofZone !== self.roofZone : true) {
            wallHeight = 2;
        }

        for (var i = 0; i < wallHeight; i++) {
            bounds = self.renderSprite(ctx, camera, self.sprite, bounds);
            if (bounds) {
                bounds.y -= 48;
            }
        }
    }

    return self;
}

var Roof = initObject => {
    var self = RPGEntity(initObject);
    var superSelf = {
        render: self.render
    };

    self.render = (ctx, camera) => {
        if (client.clientObject ? client.clientObject.roofZone !== self.roofZone : true) {
            superSelf.render(ctx, camera);
        }
    }

    return self;
}

var Player = initObject => {
    var self = RPGMovementEntity(initObject);

    var superSelf = {
        update: self.update
    }

    self.renderHand = (ctx, camera, handPosition, angle, weaponOffset, weapon) => {
        var coef = 3;
        if (weapon) {
            self.renderRotatedSprite(ctx, camera, handPosition.x, handPosition.y, angle, weapon, {
                x: -weaponOffset[0] * coef,
                y: -weaponOffset[1] * coef,
                width: weapon.width * coef,
                height: weapon.height * coef
            })
        }
        var handOffset = WEAPON_HOLDINGS[getWeaponIndex('fists')];
        var fists = getWeaponSprite('fists');
        self.renderRotatedSprite(ctx, camera, handPosition.x, handPosition.y, angle, fists, {
            x: -handOffset[0] * coef,
            y: -handOffset[1] * coef,
            width: fists.width * coef,
            height: fists.height * coef
        })
    }

    self.render = (ctx, camera) => {
        var index = self.getMovementAnimationSpriteIndex()
        var row = Math.floor(index / self.texture.columns)
        var c = index % self.texture.columns
        var handLeft = BODYPARTS['lefthand'][row][c]
        var handRight = BODYPARTS['righthand'][row][c]

        var bounds = self.getRenderBounds();

        if ([0, 1, 2, 8].includes(row)) {
            var l = 0
            var r = 1
            var la = 0
            var ra = 0
        } else if ([4, 5, 6].includes(row)) {
            var l = 1
            var r = 0
            var la = Math.PI
            var ra = Math.PI
        } else if ([3].includes(row)) {
            var l = 0
            var r = 0
            var la = -Math.PI / 2
            var ra = -Math.PI / 2
        } else if ([7].includes(row)) {
            var l = 1
            var r = 1
            var la = Math.PI / 2
            var ra = Math.PI / 2
        }

        var inventory = self.equip;

        if (!self.angleCounter) {
            self.angleCounter = 1;
        }
        self.angleCounter++;

        if (inventory) {

            var leftHandEqIndex = 4
            var rightHandEqIndex = 3

            if (inventory.slots[leftHandEqIndex].value) {
                var leftHandOffset = WEAPON_HOLDINGS[getWeaponIndex(inventory.slots[leftHandEqIndex].value.value)]
                var leftHandImage = getWeaponSprite(inventory.slots[leftHandEqIndex].value.value)
            }
            if (inventory.slots[rightHandEqIndex].value) {
                var rightHandOffset = WEAPON_HOLDINGS[getWeaponIndex(inventory.slots[rightHandEqIndex].value.value)]
                var rightHandImage = getWeaponSprite(inventory.slots[rightHandEqIndex].value.value)
            }

            bounds.y += bounds.height * 2

            var coef = 3;


            if (!self.leftHandAnimation) {
                var leftHandPos = {
                    x: bounds.x + handLeft[0] * coef,
                    y: bounds.y - handLeft[1] * coef
                }
            } else {
                var leftHandPos = {
                    x: bounds.x + handLeft[0] * coef,
                    y: bounds.y - handLeft[1] * coef
                }

                var slash = self.leftHandAnimation.func(self.leftHandAnimation)

                leftHandPos.x += slash.x;
                leftHandPos.y -= slash.y;
                la = slash.angle;

                self.leftHandAnimation.counter += 1
                if (self.leftHandAnimation.counter >= self.leftHandAnimation.length) {
                    self.leftHandAnimation = undefined;
                }
            }

            if (!self.rightHandAnimation) {
                var rightHandPos = {
                    x: bounds.x + handRight[0] * coef,
                    y: bounds.y - handRight[1] * coef
                }
            } else {
                var rightHandPos = {
                    x: bounds.x + handRight[0] * coef,
                    y: bounds.y - handRight[1] * coef
                }

                var slash = self.rightHandAnimation.func(self.rightHandAnimation)

                rightHandPos.x += slash.x;
                rightHandPos.y -= slash.y;
                ra = slash.angle;

                self.rightHandAnimation.counter += 1
                if (self.rightHandAnimation.counter >= self.rightHandAnimation.length) {
                    self.rightHandAnimation = undefined;
                }
            }


            if (l == 0) {
                self.renderHand(ctx, camera, leftHandPos, la, leftHandOffset, leftHandImage)
            }
            if (r == 0) {
                self.renderHand(ctx, camera, rightHandPos, ra, rightHandOffset, rightHandImage)
            }
            var res = self.renderMovementAnimation(ctx, camera, index);
            if (l == 1) {
                self.renderHand(ctx, camera, leftHandPos, la, leftHandOffset, leftHandImage)
            }
            if (r == 1) {
                self.renderHand(ctx, camera, rightHandPos, ra, rightHandOffset, rightHandImage)
            }
        } else {
            var res = self.renderMovementAnimation(ctx, camera, index);
        }
    }

    self.getSlashAnimation = (params) => {
        return {
            counter: 0,
            length: 20,
            params: params,
            func: (self) => {

                var coefAngle = Math.pow(Math.tan(self.counter / self.length) * 1 / Math.tan(1), 3)
                var coefDistance = Math.atan(self.counter / self.length) * 1 / Math.atan(1)

                var angle = self.params.angle + self.params.span / 2 - self.params.span * coefAngle
                angle *= -1
                var x = Math.cos(angle)
                var y = Math.sin(angle)


                return {
                    x: x * 30 * coefDistance,
                    y: y * 30 * coefDistance,
                    angle: angle
                }
            }
        }
    }

    self.update = (data) => {

        if (data.leftHandMovement) {
            if (self.leftHandMovement ? self.leftHandMovement.id != data.leftHandMovement.id : true) {
                var params = data.leftHandMovement.params;
                self.leftHandAnimation = self.getSlashAnimation(params)
            }
        }
        if (data.rightHandMovement) {
            if (self.rightHandMovement ? self.rightHandMovement.id != data.rightHandMovement.id : true) {
                var params = data.rightHandMovement.params;
                self.rightHandAnimation = self.getSlashAnimation(params)
            }
        }

        superSelf.update(data);
    }

    return self;
}

var OBJECTS = {
    'PLAYER': {
        const: Player,

        src: 'player',
        defs: {
            clientWidth: 42,
            clientHeight: 78,
            clientOffsetY: 78,
            clientOffsetX: 21,
            animationTime: 2
        },
        variantBox: {
            c: 8,
            r: 9
        }
    },
    'NPC': {
        const: RPGMovementEntity,

        src: 'player',
        defs: {
            clientWidth: 42,
            clientHeight: 78,
            clientOffsetY: 78,
            clientOffsetX: 21,
            animationTime: 2
        },
        variantBox: {
            c: 8,
            r: 9
        }
    },
    'NPC_KID': {
        const: RPGMovementEntity,

        src: 'player',
        defs: {
            clientWidth: 26,
            clientHeight: 39,
            clientOffsetY: 39,
            clientOffsetX: 13,
            animationTime: 2
        },
        variantBox: {
            c: 8,
            r: 9
        }
    },
    'ANIMAL': {
        const: RPGEntity,

        src: 'silverfish',
    },
    'SPL_CHUNK': {
        src: 'chunk',
    },
    'TREE': {
        const: RPGEntity,
        defs: {
            clientWidth: 128,
            clientHeight: 256,
            clientOffsetY: 250,
            clientOffsetX: 70
        },


        variantBox: {
            c: 1,
            r: 1
        },

        src: 'tree',
    },
    'POST': {
        const: RPGEntity,
        defs: {
            clientWidth: 128,
            clientHeight: 256,
            clientOffsetY: 250,
            clientOffsetX: 70
        },

        src: 'post',
    },
    'FLOWER': {
        const: RPGEntity,
        src: 'flower',

        defs: {
            bakeIn: true,
            layer: 11,
        },
        xx: 1,
        yy: 1,
        variantBox: {
            c: 1,
            r: 1
        }
    },
    'GROUND': {
        const: SpriteEntity,
        defs: {
            layer: 0,
            bakeIn: true
        },
        xx: 3,
        yy: 3,

        src: 'ground'
    },
    'ROOF': {
        const: Roof,
        defs: {
            clientWidth: 138,
            layer: 15,
            clientOffsetX: 69,
            clientOffsetY: 143,
        },

        src: 'roofs',
        xx: 3,
        yy: 3
    },
    'GROUND_SAND': {
        const: SpriteEntity,
        defs: {
            layer: 0,
            bakeIn: true
        },

        src: 'ground',
        x: 4,
        y: 0,
        xx: 7,
        yy: 3
    },
    'GROUND_STONE': {
        const: SpriteEntity,
        defs: {
            layer: 0,
            bakeIn: true
        },

        src: 'ground',
        x: 8,
        y: 0,
        xx: 11,
        yy: 3
    },
    'FIREBALL': {
        const: Fireball,
        src: 'fireball'
    },
    'PILE': {
        const: RPGEntity,
        src: 'pile'
    },
    'WALL': {
        const: Wall,
        defs: {
            clientWidth: 96,
            clientHeight: 144,
            clientOffsetY: 96
        },

        src: 'wall',
        x: 0,
        y: 0,
        xx: 3,
        yy: 11,

        variantBox: {
            c: 4,
            r: 4
        }
    },
    'STONE_WALL': {
        const: Wall,
        defs: {
            clientWidth: 96,
            clientHeight: 144,
            clientOffsetY: 96
        },

        src: 'wall',
        x: 4,
        y: 0,
        xx: 7,
        yy: 3,
    },
    'FENCE': {
        const: RPGEntity,
        defs: {
            clientWidth: 96,
            clientHeight: 144,
            clientOffsetY: 96
        },

        src: 'fence'
    }
}

///// TEXTURE MANAGER //////

textureManager = TextureManager({
    'player': {
        src: '/textures/player.png',
        c: 8,
        r: 9
    },
    'wall': {
        src: '/textures/wall.png',
        c: 8,
        r: 12
    },
    'silverfish': {
        src: '/textures/silverfish.png',
    },
    'chunk': {
        src: '/textures/chunk.png',
    },
    'tree': {
        src: '/textures/tree.png',
        c: 4
    },
    'flower': {
        src: '/textures/flower.png',
        c: 2,
        r: 2
    },
    'ground': {
        src: '/textures/ground.png',
        c: 12,
        r: 4
    },
    'roofs': {
        src: '/textures/roofs.png',
        c: 4,
        r: 4
    },
    'fence': {
        src: '/textures/fence.png',
        c: 4,
        r: 4
    },
    'fireball': {
        src: '/textures/fireball.png'
    },
    'buttons': {
        src: '/textures/buttons.png',
        r: 1,
        c: 5
    },
    'shadow': {
        src: '/textures/shadow.png',
    },
    'items': {
        src: '/textures/items.png',
        c: 4,
        r: 3,
    },
    'weapons': {
        src: '/textures/weapons.png',
        c: 1,
        r: 3
    },
    'pile': {
        src: '/textures/pile.png'
    },
    'post': {
        src: '/textures/post.png'
    }
}, OBJECTS)


var getItemSprite = (value) => {
    if (value == 'ash') {
        return textureManager.getSprite('items', 0, 0)
    } else if (value == 'berry') {
        return textureManager.getSprite('items', 1, 0)
    } else if (value == 'iron_helmet') {
        return textureManager.getSprite('items', 4, 0)
    } else if (value == 'iron_chestplate') {
        return textureManager.getSprite('items', 5, 0)
    } else if (value == 'iron_footwear') {
        return textureManager.getSprite('items', 6, 0)
    } else if (value == 'iron_footwear') {
        return textureManager.getSprite('items', 6, 0)
    } else if (value == 'iron_sword') {
        return textureManager.getSprite('items', 0, 2)
    } else if (value == 'iron_shield') {
        return textureManager.getSprite('items', 1, 2)
    } else if (value == 'iron_staff') {
        return textureManager.getSprite('items', 2, 2)
    } else {
        console.error('invalid item value: ', value)
        return null;
    }
}

var getWeaponIndex = (value) => {
    if (value == 'fists') {
        return 0
    } else if (value == 'iron_sword') {
        return 1
    } else if (value == 'iron_shield') {
        return 2
    } else {
        console.error('invalid weapon value: ', value)
        return null
    }
}

var getWeaponSprite = (value) => {
    var index = getWeaponIndex(value);
    if (index != null) {

        return textureManager.getSprite('weapons', index, 0)

    } else {
        return null;
    }
}

///// CLIENT //////

var client = Client({
    keyToConstructor: OBJECTS,
    chunkSize: 960,
    FPS: 45,
    gameLoopStart: false,
    onMouseEvent: (event, self) => {
        if (event.type == 'mouseup') {
            if (self.cursorValue) {
                self.cursorValue == null;
                self.cursorOnRelease();
            }
        }
    },
    onFirstLoad: (self) => {
        self.handler.preBake();
        self.startGameLoop()
    }
})

client.camera.lerp = true;

///// UI ELEMENTS //////


var Bar = (initObject) => {
    var self = SpoolUIElement({
        bgColor: 'black',
        barColor: 'red',
        value: 1,
        ...initObject
    });

    self.renderBounds = (ctx) => {
        ctx.beginPath();
        ctx.lineWidth = "1";

        var margin = 0;
        var innerWidth = (self.width - 2 * margin);

        ctx.fillStyle = self.barColor;
        ctx.rect(self.x, self.y, self.width, self.height);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = self.bgColor;
        ctx.rect(
            self.x + margin + innerWidth * self.value,
            self.y + margin,
            innerWidth * (1 - self.value),
            self.height - 2 * margin);
        ctx.fill();
    }

    return self;
}

var PlayerInformation = (initObject) => {
    var self = SpoolUIElement({
        ...initObject,
    });

    var barWidth = 100;
    var barHeight = 15;

    self.healthBar = Bar({
        x: self.x,
        y: self.y,
        width: barWidth,
        height: barHeight,
        value: 0.8,
        font: "13px Arial"
    })

    self.add(self.healthBar)

    self.manaBar = Bar({
        x: self.healthBar.left,
        y: self.healthBar.bottom + barHeight / 2,
        width: barWidth,
        height: barHeight,
        value: 0.8,
        barColor: 'blue',
        font: "13px Arial"
    })

    self.add(self.manaBar)

    var superRender = self.render;
    self.render = (ctx) => {
        if (client.clientObject) {
            self.healthBar.value = client.clientObject.hp / client.clientObject.maxHp
            self.manaBar.value = client.clientObject.mp / client.clientObject.maxMp
            self.healthBar.text = `${Math.floor(client.clientObject.hp)} / ${client.clientObject.maxHp}`
            self.manaBar.text = `${Math.floor(client.clientObject.mp)} / ${client.clientObject.maxMp}`
            superRender(ctx);
        }
    }
    return self;
}

var ItemInformation = (initObject) => {
    var self = SpoolUIElement({
        item: null,
        ...initObject,
        layer: 11,
    })

    self.setItem = (item) => {
        self.item = item;
        self.sprite = getItemSprite(item.value);
    }

    self.render = (ctx) => {
        if (self.item) {
            var ttx = self.mx;
            var tty = self.my;
            var ttw = 200;
            var tth = 200;

            if (ttx + ttw >= client.gameArea.width - 10) {
                ttx = client.gameArea.width - ttw - 10
            }

            if (tty + tth >= client.gameArea.height - 10) {
                tty = client.gameArea.height - tth - 10
            }

            ctx.fillStyle = 'black';
            ctx.strokeStyle = 'white';


            var imageWidth = 40;
            var imageHeight = 40;
            var margin = 10;



            drawRoundRect(ctx, ttx, tty, ttw, tth, margin, true, true);
            ctx.drawImage(self.sprite, ttx + ttw - margin - imageWidth + margin / 2, tty + margin + margin / 2, imageWidth - margin, imageHeight - margin);
            drawRoundRect(ctx, ttx + ttw - margin - imageWidth, tty + margin, imageWidth, imageHeight, margin / 2, false, true);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = '18px Arial';
            ctx.fillText(self.item.value, ttx + margin, tty + margin, ttw - margin * 2)

            if (self.item.amount ? self.item.amount > 1 : false) {
                ctx.textAlign = 'right';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(self.item.amount, ttx + ttw - margin, tty + tth - margin, ttw - margin * 2)
            }

            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'center';
            self.itemInfo = true;
        }
    }

    return self;
}
client.itemBox = ItemInformation();
client.uiHandler.add(client.itemBox);

var ItemButton = (initObject) => {
    var self = SpoolUIButton({
        ...initObject
    })

    var superSelf = {
        render: self.render
    }

    self.render = (ctx) => {
        superSelf.render(ctx);


        if (self.value) {
            var sprite = getItemSprite(self.value.value)


            if (self.itemBeingMoved) {
                ctx.globalAlpha = 0.4;
                self.renderSprite(ctx, sprite, 0.5)
                ctx.globalAlpha = 1.0;
            } else {
                self.renderSprite(ctx, sprite, 0.5)
            }
            ctx.fillStyle = 'white';
            ctx.font = "20px Arial";
            if (self.value.amount ? self.value.amount > 1 : false) {
                ctx.fillText(self.value.amount, self.x + self.width, self.y + self.height);
            }

            if (self.mouseOn) {
                client.itemBox.setItem(self.value);
                client.itemBox.visible = true;

                self.itemInfo = true;
            } else if (self.itemInfo) {
                client.itemBox.visible = false;

                self.itemInfo = false;
            }
        }
    }

    return self;
}

var ItemList = (initObject, items) => {
    var self = SpoolUIElement({
        items: items,
        buttonConst: ItemButton,
        buttonSize: 50,
        ...initObject
    });

    // adding buttons

    self.columns = Math.floor(self.width / self.buttonSize);
    self.rows = Math.ceil(self.items / self.columns);

    for (var i = 0; i < self.items.length; i++) {
        var button = self.buttonConst({
            x: i % self.columns * self.buttonSize + self.x,
            y: Math.floor(i / self.columns) * self.buttonSize + self.y,
            width: self.buttonSize,
            height: self.buttonSize,
            value: self.items[i]
        })

        self.add(button);
    }

    return self;
}

var SlotButton = (initObject) => {
    var self = ItemButton(initObject);

    self.mouseUp = true;

    self.bindedMouseEvent = event => {
        if (self.value && event.type == 'mousedown') {
            client.cursorValue = {
                type: 'item',
                value: {
                    inventoryId: self.inventoryId,
                    value: self.value
                }
            };
            self.itemBeingMoved = true;
            client.cursorOnRelease = () => {
                self.itemBeingMoved = false;
            }
        } else if (event.type == 'mouseup') {
            if (client.cursorValue && client.cursorOnRelease) {
                client.socket.emit("MOVE_ITEM", {
                    from: client.cursorValue.value.inventoryId,
                    to: self.inventoryId,
                    value: client.cursorValue.value.value
                })
                client.cursorOnRelease();
            }
        }
    }

    return self;
}

var InventoryUI = (initObject) => {
    var self = SpoolUIElement({
        visible: false,
        ...initObject
    });

    var superSelf = {
        render: self.render
    };

    self.init = (inventory, initObject) => {
        self.elements = {};

        var inventoryButtons = []

        for (var i = 0; i < inventory.size; i++) {
            var f = i;
            inventoryButtons.push({
                sprite: textureManager.getSprite('buttons', 0, 0),
                bindedMouseEvent: (event) => {
                    console.log(f);
                }
            })
        }

        console.log(inventory.uiType);

        if (inventory.uiType == 'entity-equipment') {
            var list = SpoolUIElement({
                ...initObject
            })
            var buttons = []

            for (var i = 0; i < inventoryButtons.length; i++) {
                var inventoryButton = inventoryButtons[i];

                console.log(EQUIPMENT_UI_BUTTON_POSITIONS[i])

                var buttonPosition = EQUIPMENT_UI_BUTTON_POSITIONS[i];
                var button = SlotButton({
                    x: buttonPosition.x + list.x,
                    y: buttonPosition.y + list.y,
                    width: 50,
                    height: 50,
                    sprite: inventoryButton.sprite,
                    bindedMouseEvent: inventoryButton.bindedMouseEvent
                })
                buttons.push(button);

                list.add(button);
            }

            list.alignItems('center', self.cx, self.cy)
            self.buttons = buttons;
            delete list.render;
        } else {
            var list = SpoolUIButtonList({
                columns: 4,
                rows: 4,
                offsetX: 1,
                offsetY: 0,
                visible: false,
                ...initObject
            }, inventoryButtons, SlotButton);
            delete list.render;
        }

        list.forEachElement(element => {
            element.inventoryId = self.inventory.id;
        })

        bounds = list.getElementBounds()

        list.x = bounds.x - 20;
        list.y = bounds.y - 20;
        list.width = bounds.width + 40;
        list.height = bounds.height + 40;
        list.bgColor = 'black';
        list.radius = 20;

        return list;
    }

    self.setInventory = (inventory) => {
        self.loadRequest = true;
        self.inventory = inventory;
        self.inventoryFootprint = inventory;
    }

    self.render = (ctx) => {
        ctx.fillStyle = 'white';
        if (self.inventoryFootprint) {
            if (!self.loadRequest) {
                client.objectServer.load(self.inventoryFootprint)
                self.loadRequest = true;
            } else {
                if (self.inventory) {
                    if (!self.initiated) {
                        var invList = self.init(self.inventory, self);
                        console.log(self.inventory);
                        delete invList['render'];
                        if (invList) {
                            Object.assign(self, invList);
                            self.initiated = true;
                        }
                    } else {
                        for (var i = 0; i < self.buttons.length; i++) {
                            self.buttons[i].value = self.inventory.slots[i].value;
                        }
                        superSelf.render(ctx);
                    }
                } else {

                    self.inventory = client.objectServer.getObject(self.inventoryFootprint);
                }
            }
        }
    }



    return self;
}

var ConversationUI = (initObject) => {
    var self = SpoolUIElement({
        width: 400,
        height: 500,
        bgColor: 'black',
        strokeColor: 'white',
        radius: 10,
        font: '20px Arial',
        ...initObject
    });

    self.x -= self.width / 2;
    self.y -= self.height / 2;


    self.setConversation = (conversation) => {
        self.removeAll();

        self.conversation = conversation;

        // adding message box 

        self.messageBox = SpoolUIElement({
            x: self.x,
            y: self.y,
            width: self.width,
            height: self.height - 50,
            text: conversation.message,
            font: self.font,
            multiLine: true
        })
        self.add(self.messageBox);

        // adding conversation buttons 
        self.buttonWidth = self.width / conversation.options.length;


        for (var i = 0; i < conversation.options.length; i++) {
            var option = conversation.options[i]

            var price = conversation.options[i].price;
            var priceMenu = null;
            if (price) {
                priceMenu = ItemList({
                    x: self.x,
                    y: self.y + self.height - 50 - 100,
                    width: self.width,
                    height: self.height,
                    visible: false,
                }, price.items)
                self.add(priceMenu);

                if (self.visMenus) {
                    self.visMenus.push(priceMenu);
                } else {
                    self.visMenus = [priceMenu];
                }
            }

            var reward = conversation.options[i].reward;
            var rewardMenu = null;
            if (reward) {
                rewardMenu = ItemList({
                    x: self.x,
                    y: self.y + self.height - 50 - 50,
                    width: self.width,
                    height: self.height,
                    visible: false,
                }, reward.items)
                self.add(rewardMenu);

                if (self.visMenus) {
                    self.visMenus.push(rewardMenu);
                } else {
                    self.visMenus = [rewardMenu];
                }
            }



            var button = SpoolUIButton({
                x: self.x + i * self.buttonWidth,
                y: self.y + self.height - 50,
                width: self.buttonWidth,
                height: 50,
                text: option.response,
                option: option.response,
                font: self.font,
                priceMenu: priceMenu,
                rewardMenu: rewardMenu,
                parent: self,
                disabled: !option.availible,
                bindedMouseEvent: (event, self) => {
                    client.socket.emit('PLAYER_CONVERSATION', {
                        id: client.clientObject.id,
                        option: self.option
                    })
                },
                onMouseEnter: (event, self) => {
                    if (self.parent) {
                        self.parent.resetVisibilities()
                    }

                    if (self.priceMenu) {
                        self.priceMenu.visible = true;
                    }

                    if (self.rewardMenu) {
                        self.rewardMenu.visible = true;
                    }
                }
            })

            self.add(button)
        }


    }

    self.resetVisibilities = () => {
        if (self.visMenus) {
            self.visMenus.forEach(menu => {
                if (menu) {
                    menu.visible = false;
                }
            })
        }
    }


    self.update = () => {
        if (client.clientObject ? client.clientObject.conversation : false) {
            if (self.conversation) {
                if (self.conversation.message != client.clientObject.conversation.message) {
                    self.setConversation(client.clientObject.conversation);
                }
            } else {
                self.setConversation(client.clientObject.conversation);
            }
            self.visible = true;
        } else if (self.visible) {
            self.visible = false;
        }
    }

    return self;
}

var PlayerMenu = (initObject) => {
    var self = SpoolUIElement({
        ...initObject,
    });
    var superSelf = {
        render: self.render
    }

    // Adding inventory management 

    self.inventoryEventObj = {
        mouseEvent: (event) => {

        }
    }
    self.craftingEventObj = {
        mouseEvent: (event) => {

        }
    }
    self.equipEventObj = {
        mouseEvent: (event) => {

        }
    }

    self.navigation = SpoolUIButtonList({
        x: client.gameArea.width - 30,
        y: 30,
        columns: 1,
        rows: 3,
        offsetX: 1,
        offsetY: 0
    }, [{
        sprite: textureManager.getSprite('buttons', 1, 0),
        bindedMouseEvent: (event) => {
            self.inventoryEventObj.mouseEvent(event);
        }
    }, {
        sprite: textureManager.getSprite('buttons', 4, 0),
        bindedMouseEvent: (event) => {
            self.craftingEventObj.mouseEvent(event);
        }
    }, {
        sprite: textureManager.getSprite('buttons', 2, 0),
        bindedMouseEvent: (event) => {
            self.equipEventObj.mouseEvent(event);
        }
    }, {
        sprite: textureManager.getSprite('buttons', 3, 0),
        bindedMouseEvent: (event) => {
            console.log('map');
        }
    }])

    self.add(self.navigation)

    // Adding hotbar
    var hotbarButtons = []
    for (var i = 0; i < 8; i++) {
        hotbarButtons.push({
            sprite: textureManager.getSprite('buttons', 0, 0),
            bindedMouseEvent: (event) => {
                console.log(i);
            }
        })
    }

    self.hotbar = SpoolUIButtonList({
        x: client.gameArea.width / 2,
        y: client.gameArea.height - 30,
        columns: 8,
        rows: 1,
        offsetX: 0.5,
        offsetY: 1,
    }, hotbarButtons)

    self.add(self.hotbar)

    // Player information 

    self.playerInformation = PlayerInformation({
        x: 30,
        y: 30
    });
    self.add(self.playerInformation)

    // Inventory 

    self.inventory = InventoryUI({
        x: self.navigation.left - 30,
        y: self.navigation.top
    });
    self.add(self.inventory);

    self.inventoryEventObj.mouseEvent = event => {
        self.inventory.visible = !self.inventory.visible;
    }

    // Equipment 

    self.equipment = InventoryUI({
        x: 0,
        y: 0,
        cx: client.gameArea.width / 2 - 200,
        cy: client.gameArea.height / 2,
        width: client.gameArea.width,
        height: client.gameArea.height
    });
    self.add(self.equipment);

    self.equipEventObj.mouseEvent = event => {
        console.log(self.equipment.visible);
        self.equipment.visible = !self.equipment.visible;
    }

    // Conversation

    self.conversation = ConversationUI({
        x: client.gameArea.width / 4 * 3,
        y: client.gameArea.height / 2
    });

    self.add(self.conversation);

    self.render = (ctx) => {
        superSelf.render(ctx);

        if (client.clientObject) {
            if (!self.inventory.inventoryFootprint) {
                self.inventory.inventoryFootprint = {
                    objectType: 'INVENTORY',
                    id: client.clientObject.inventoryId
                }
            }

            if (!self.equipment.inventoryFootprint) {
                self.equipment.inventoryFootprint = {
                    objectType: 'INVENTORY',
                    id: client.clientObject.equipId
                }
            }
        }
    }



    return self;
}

client.handler.textureManager = (textureManager);

///// START CLIENT //////

textureManager.onLoad = () => {
    client.socketInit()

    ///// INPUT LISTENER //////

    mouseListener = MouseListener(client)
    mouseListener.mouseEvent = (event, self) => {
        var point = self.client.camera.inverseTransformPoint(event.clientX, event.clientY);
        self.client.socket.emit(MessageCodes.SM_MOUSE_CLICKED, {
            button: event.button,
            clickedX: point.x,
            clickedY: point.y,
            type: event.type
        })
    }
    mouseListener.initListener()

    var playerMenu = PlayerMenu();
    client.uiHandler.add(playerMenu);

    keyListener = KeyboardListener(client.socket)
    keyListener.initListener()
}

client.camera.onUpdate = (self) => {
    if (client.clientObject) {
        if (client.clientObject.focusObject) {
            var fo = client.clientObject.focusObject;
            self.followObject = client.handler.getObject(fo.objectType, fo.id);

            if (client.clientObject.conversation) {
                self.offsetX = 200;
            } else {
                self.offsetX = 0;
            }
        } else {
            self.followObject = client.clientObject;
            self.offsetX = 0;
        }
    }
}

textureManager.load();

BODYPARTS = {
    "righthand": [
        [
            [1.5, 18.5, 4],
            [2.5, 18.5, 4],
            [2.5, 18.5, 4],
            [2.5, 19.5, 4],
            [1.5, 20.5, 4],
            [1.5, 18.5, 4],
            [1.5, 18.5, 4],
            [1.5, 18.5, 4]
        ],
        [
            [2.5, 18.5, 4],
            [1.5, 17.5, 4],
            [0.5, 15.5, 4],
            [1.5, 17.5, 4],
            [2.5, 18.5, 4],
            [3.5, 17.5, 4],
            [5.5, 15.5, 4],
            [3.5, 17.5, 4]
        ],
        [
            [2.5, 18.5, 4],
            [1.5, 17.5, 4],
            [0.5, 15.5, 4],
            [1.5, 17.5, 4],
            [2.5, 18.5, 4],
            [3.5, 17.5, 4],
            [5.5, 15.5, 4],
            [3.5, 17.5, 4]
        ],
        [
            [11.5, 18.5, 4],
            [11.5, 16.5, 4],
            [11.5, 14.5, 4],
            [11.5, 16.5, 4],
            [11.5, 18.5, 4],
            [11.5, 17.5, 4],
            [11.5, 15.5, 4],
            [11.5, 17.5, 4]
        ],
        [
            [2.0, 18.5, 2],
            [1.5, 17.5, 4],
            [0.5, 15.5, 4],
            [1.5, 17.5, 4],
            [2.0, 18.5, 2],
            [4.5, 16.5, 4],
            [4.5, 15.5, 4],
            [4.5, 16.5, 4]
        ],
        [
            [2.0, 18.5, 2],
            [1.5, 17.5, 4],
            [0.5, 15.5, 4],
            [1.5, 17.5, 4],
            [2.0, 18.5, 2],
            [4.5, 16.5, 4],
            [4.5, 15.5, 4],
            [4.5, 16.5, 4]
        ],
        [
            [2.0, 18.5, 2],
            [1.5, 17.5, 4],
            [0.5, 15.5, 4],
            [1.5, 17.5, 4],
            [2.0, 18.5, 2],
            [4.5, 16.5, 4],
            [4.5, 15.5, 4],
            [4.5, 16.5, 4]
        ],
        [
            [1.5, 18.5, 4],
            [1.5, 17.5, 4],
            [1.5, 15.5, 4],
            [1.5, 17.5, 4],
            [1.5, 18.5, 4],
            [1.5, 16.5, 4],
            [1.5, 14.5, 4],
            [1.5, 16.5, 4]
        ],
        [
            [2.5, 18.5, 4],
            [1.5, 17.5, 4],
            [0.5, 15.5, 4],
            [1.5, 17.5, 4],
            [2.5, 18.5, 4],
            [3.5, 17.5, 4],
            [5.5, 15.5, 4],
            [3.5, 17.5, 4]
        ]
    ],
    "lefthand": [
        [
            [10.0, 18.5, 2],
            [11.0, 18.5, 2],
            [11.0, 18.5, 2],
            [11.0, 19.5, 2],
            [10.0, 20.5, 2],
            [10.0, 18.5, 2],
            [10.0, 18.5, 2],
            [10.0, 18.5, 2]
        ],
        [
            [11.0, 18.5, 2],
            [11.5, 17.5, 4],
            [12.5, 15.5, 4],
            [11.5, 17.5, 4],
            [11.0, 18.5, 2],
            [9.5, 16.5, 4],
            [8.5, 15.5, 4],
            [8.5, 16.5, 4]
        ],
        [
            [11.0, 18.5, 2],
            [11.5, 17.5, 4],
            [12.5, 15.5, 4],
            [11.5, 17.5, 4],
            [11.0, 18.5, 2],
            [9.5, 16.5, 4],
            [8.5, 15.5, 4],
            [8.5, 16.5, 4]
        ],
        [
            [1.5, 18.5, 4],
            [1.5, 17.5, 4],
            [1.5, 15.5, 4],
            [1.5, 17.5, 4],
            [1.5, 18.5, 4],
            [1.5, 16.5, 4],
            [1.5, 14.5, 4],
            [1.5, 16.5, 4]
        ],
        [
            [10.5, 18.5, 4],
            [11.5, 17.5, 4],
            [12.5, 15.5, 4],
            [11.5, 17.5, 4],
            [10.5, 18.5, 4],
            [9.5, 17.5, 4],
            [7.5, 15.5, 4],
            [9.5, 17.5, 4]
        ],
        [
            [10.5, 18.5, 4],
            [11.5, 17.5, 4],
            [12.5, 15.5, 4],
            [11.5, 17.5, 4],
            [10.5, 18.5, 4],
            [9.5, 17.5, 4],
            [7.5, 15.5, 4],
            [9.5, 17.5, 4]
        ],
        [
            [10.5, 18.5, 4],
            [11.5, 17.5, 4],
            [12.5, 15.5, 4],
            [11.5, 17.5, 4],
            [10.5, 18.5, 4],
            [9.5, 17.5, 4],
            [7.5, 15.5, 4],
            [9.5, 17.5, 4]
        ],
        [
            [11.5, 18.5, 4],
            [11.5, 16.5, 4],
            [11.5, 14.5, 4],
            [11.5, 16.5, 4],
            [11.5, 18.5, 4],
            [11.5, 17.5, 4],
            [11.5, 15.5, 4],
            [11.5, 17.5, 4]
        ],
        [
            [11.0, 18.5, 2],
            [11.5, 17.5, 4],
            [12.5, 15.5, 4],
            [11.5, 17.5, 4],
            [11.0, 18.5, 2],
            [9.5, 16.5, 4],
            [8.5, 15.5, 4],
            [8.5, 16.5, 4]
        ]
    ]
}

WEAPON_HOLDINGS = [
    [16.5, 16.5, 16.5, 16.5],
    [7.5, 15.5, 25, 15],
    [16.5, 16.5, 17, 16]
]