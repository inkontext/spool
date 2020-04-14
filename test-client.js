////// FUNCTIONS //////



function tileDistance(ax, ay, bx, by) {
    return (Math.abs(bx - ax) + Math.abs(by - ay) + Math.abs(bx + by - ax - ay)) / 2
}

function tileDistance2T(a, b) {
    return tileDistance(a.tx, a.ty, b.tx, b.ty);
}

function movingPrice(tilea, tileb) {
    if (tilea.z !== undefined && tilea.leavingPrice !== undefined && tileb.z !== undefined && tileb.enteringPrice !== undefined) {
        var res = Math.abs(tilea.z - tileb.z) + tilea.leavingPrice + tileb.enteringPrice;
        return res;
    } else {
        if (tilea.z === undefined || tilea.leavingPrice === undefined) {
            console.warn('@movingPrice: problem with tileA:', tilea);
        }
        if (tileb.z === undefined || tileb.enteringPrice === undefined) {
            console.warn('@movingPrice: problem with tileB:', tileb);
        }

        return null;
    }
}

function renderVialValue(ctx, color, value, maxValue, box) {
    SpoolRenderer.setColor(ctx, '#333333');
    var newBox = SpoolRect(box.x + 5, box.y + 5, box.width - 10, box.height - 10);
    SpoolRenderer.fillInscribedOval(ctx, newBox);

    SpoolRenderer.setColor(ctx, color);
    SpoolRenderer.fillInscribedOvalPercentFull(ctx, newBox, value / maxValue);
    ctx.imageSmoothingEnabled = false;


    ctx.drawImage(textureManager.getSprite('ring'), box.x, box.y, box.width, box.height);

    SpoolRenderer.setColor(ctx, 'black');
    SpoolRenderer.multiLineText(ctx, value.toString(), box, box.width);
}

function getTileInPoint(x, y) {
    var res = null;
    Object.keys(colBoxes).forEach(key => {
        var box = colBoxes[key];
        if (SpoolMath.distance(x, y, box.x, box.y) <= box.radius) {
            res = box.tile;
        }
    })
    return res;
}

////// CLIENT //////

var Z_SCALINGFACTOR_MAX = 10;
var Z_SCALINGFACTOR_MIN = 3;
var Z_SCALINGFACTOR = Z_SCALINGFACTOR_MAX;
var Z_SCALINGENABLED = true;

var colBoxes = {};

var client = null;

BIOME_COLORS = {
    'grass': '#a0d964',
    'stone': '#757575',
    'sand': '#f0e089',
    'water': '#0077be '
}

BIOME_TEXTROWS = {
    'grass': 2,
    'stone': 3,
    'sand': 1,
    'water': 0,
    'dead': 4,
}

NATURE_TEXTROWS = {
    'bush': 0,
    'grass': 1,
    'stone': 2,
}

TILE_SELECTOR_FCOUNTER = 0;
TILE_SELECTOR_INDEX = 0;
TILE_SELECTOR_LENGTH = 5;


var Tile = (initObject) => {
    var self = Entity({
        ...initObject
    });

    var superSelf = {
        render: self.render
    }

    self.deadColor = '#444444';
    self.baseColor = '#b58d65'
    self.baseDark = ['#a37a52', '#a8835e', '#c2a07e']

    self.topColor = BIOME_COLORS[self.biome]

    self.renderZ = self.z;

    self.color = SpoolMath.randomColor(100, 255);
    self.darkColor = SpoolMath.divideColor(self.color, 2);

    self.textureId = SpoolMath.randomInt(0, 3);
    self.biome;
    self.frameCounter = 0;

    self.update = (data) => {
        Object.assign(self, data);
    }

    self.render = (ctx, camera) => {
        var r = self.hexRadius;
        var startAngle = 0;
        var n = 6;

        var points = []
        var pointsDown = []
        var pointsInner = []

        var innerRadiusFactor = 0.8;

        self.renderZ = SpoolMath.lerp(self.renderZ, self.z, 0.2);

        var zOffset = self.renderZ * Z_SCALINGFACTOR + self.zRandomOffset * Z_SCALINGFACTOR * 1;


        for (var i = 0; i < n; i++) {
            angle = startAngle + Math.PI * 2 / n * i;
            var point = camera.transformPoint(self.x - r * Math.cos(angle), self.y - r * Math.sin(angle));
            var pointInner = camera.transformPoint(self.x - r * innerRadiusFactor * Math.cos(angle), self.y - r * innerRadiusFactor * Math.sin(angle))
            pointInner.y -= zOffset
            pointsDown.push(point);
            pointsInner.push(pointInner);
            points.push({
                x: point.x,
                y: point.y - zOffset
            })
        }

        // Drawing the base going down the screen

        // ctx.fillStyle = self.baseDark[0];
        // ctx.beginPath();
        // ctx.moveTo(points[0].x, points[0].y)
        // ctx.lineTo(points[1].x, points[1].y)
        // ctx.lineTo(points[1].x, client.gameArea.height)
        // ctx.lineTo(points[0].x, client.gameArea.height) //, pointsDown[0].y)
        // ctx.closePath();
        // ctx.fill();

        // ctx.fillStyle = self.baseDark[1];
        // ctx.beginPath();
        // ctx.moveTo(points[1].x, points[1].y)
        // ctx.lineTo(points[2].x, points[2].y)
        // ctx.lineTo(points[2].x, client.gameArea.height) //pointsDown[3].y)
        // ctx.lineTo(points[1].x, client.gameArea.height)
        // ctx.closePath();
        // ctx.fill();

        // ctx.fillStyle = self.baseDark[2];
        // ctx.beginPath();
        // ctx.moveTo(points[2].x, points[2].y)
        // ctx.lineTo(points[3].x, points[3].y)
        // ctx.lineTo(points[3].x, client.gameArea.height) //pointsDown[3].y)
        // ctx.lineTo(points[2].x, client.gameArea.height)
        // ctx.closePath();
        // ctx.fill();

        ctx.imageSmoothingEnabled = false;

        var rectHeight = client.gameArea.height - points[0].y;

        ctx.fillStyle = self.baseDark[0];
        ctx.fillRect(points[0].x, points[0].y, points[1].x - points[0].x, rectHeight)
        ctx.fillStyle = self.baseDark[1];
        ctx.fillRect(points[1].x, points[0].y, points[2].x - points[1].x, rectHeight)
        ctx.fillStyle = self.baseDark[2];
        ctx.fillRect(points[2].x, points[0].y, points[3].x - points[2].x, rectHeight)

        // Calculating the upper point 

        colPoint = camera.transformPoint(self.x, self.y);
        colBox = {
            x: colPoint.x,
            y: colPoint.y - zOffset,
            radius: camera.transformDimension(self.hexRadius) * Math.sin(Math.PI / 3),
            tile: self
        }
        colBoxes[self.id] = colBox;

        // Drawing the upper face of the hexagon

        // ctx.fillStyle = self.baseColor;
        // ctx.beginPath();
        // ctx.moveTo(points[0].x, points[0].y)
        // for (var i = 1; i < n; i++) {
        //     ctx.lineTo(points[i].x, points[i].y)
        // }
        // ctx.closePath();
        // ctx.fill();

        // Drawing the inner part of the hexagon

        var t_width = r * 2;

        var sprite = textureManager.getSprite('tiles', BIOME_TEXTROWS[self.dead ? 'dead' : self.biome] * 4 + (self.textureId + self.animationFrame) % 4)
        var t_height = t_width / sprite.width * sprite.height;

        ctx.drawImage(sprite, colBox.x - t_width / 2, colBox.y - t_height / 2, t_width, t_height);

        /*
        ctx.fillStyle = self.dead ? self.deadColor : BIOME_COLORS[self.biome];
        ctx.beginPath();
        ctx.moveTo(pointsInner[0].x, pointsInner[0].y)
        for (var i = 1; i < n; i++) {
            ctx.lineTo(pointsInner[i].x, pointsInner[i].y)
        }
        ctx.closePath();
        ctx.fill();
        */


        self.objects.forEach(object => {
            var temp = client.handler.objectsById[object];
            if (temp) {
                temp.renderOnTile(ctx, camera, colBox.x, colBox.y);
            }
        })

        if (client.handUi) {
            if (client.handUi.activatedCard) {

                var selectorId = null;

                if (tileDistance2T(client.clientObject.tile, self) <= client.handUi.activatedCard.range) {


                    selectorId = 0;
                }

                if (client.handUi.selectedTx == self.tx && client.handUi.selectedTy == self.ty) {
                    if (selectorId != null) {
                        selectorId = 1;
                    } else {
                        selectorId = 2;
                    }
                }

                if (selectorId != null) {
                    var selectorWidth = t_width * 1 / 2;
                    var selectorHeight = t_height * 1 / 2;
                    var selectorZ = 10;
                    ctx.drawImage(textureManager.getSprite('tileselector', selectorId * 4 + TILE_SELECTOR_INDEX), colBox.x - selectorWidth / 2, colBox.y - selectorHeight / 2 - selectorZ, selectorWidth, selectorHeight);
                }
            }
        }

        if (client.clientObject && !self.dead) {
            if (client.clientObject.tile) {
                if (tileDistance2T(client.clientObject.tile, self) == 1) {
                    SpoolRenderer.setFont(ctx, 'Arial', 25);
                    SpoolRenderer.setColor(ctx, 'white');

                    var price = movingPrice(self, client.clientObject.tile);

                    SpoolRenderer.multiLineText(ctx, `${price}`, SpoolRect(colBox.x, colBox.y, 0, 0))
                }
            }
        }

        if (self.biome == 'water') {

            self.frameCounter += 1;
            if (self.frameCounter >= 20) {
                self.frameCounter = 0;
                self.animationFrame += 1;
                if (self.animationFrame >= 4) {
                    self.animationFrame = 0;
                }
            }
        }
    }

    return self;
}

var StandableEntity = (initObject) => {
    var self = RectangleEntity({
        ...initObject
    })

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        SpoolRenderer.setColor(ctx, 'red');
        var textureOffsetY = self.textureOffsetY ? self.textureOffsetY : 0;
        if (self.sprite) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(self.sprite, tilex - self.width / 2, tiley - self.height + textureOffsetY, self.width, self.height);
        } else {
            SpoolRenderer.fillRect(ctx, tilex - self.width / 2, tiley - self.height, self.width, self.height);
        }
    }

    return self;
}

var Player = (initObject) => {
    var self = MovementAnimationEntity({
        ...initObject,
        currentX: null,
        currentY: null,
    })

    var superSelf = {
        render: self.render
    }

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        var index = self.getMovementAnimationSpriteIndex(false, 0);
        var textureOffsetY = self.textureOffsetY ? self.textureOffsetY : 0;
        ctx.drawImage(self.texture.sprites[index], tilex - self.width / 2, tiley - self.height + textureOffsetY, self.width, self.height)

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
    }

    return self;
}

var Nature = (initObject) => {
    var self = RectangleEntity({
        ...initObject
    })

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        var sprite = textureManager.getSprite('nature', NATURE_TEXTROWS[self.natureType] * 4 + self.variationId);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, tilex - self.width / 2 + self.xOffset, tiley - self.height + self.yOffset * camera.scaleY, self.width, self.height);
    }

    return self;
}

var OBJECTS = {
    'TILE': {
        const: Tile
    },
    'PLAYER': {
        const: Player
    },
    'BOX': {
        const: StandableEntity,
        defs: {
            textureOffsetY: 12,
            yOffset: 10
        }
    },
    'NATURE': {
        const: Nature
    }
}

textureManager = TextureManager({
    'card': {
        src: './textures/full_stack.png',
        r: 3,
        c: 5,
    },
    'tiles': {
        src: './textures/tiles.png',
        r: 5,
        c: 4,
    },
    'tileselector': {
        src: './textures/tileselector.png',
        r: 3,
        c: 4,
    },
    'boxes': {
        src: './textures/boxes.png',
        r: 2,
        c: 2,
    },
    'ring': {
        src: './textures/ring.png',
        r: 1,
        c: 1,
    },
    'queuegems': {
        src: './textures/queuegems.png',
        r: 3,
        c: 1,
    },
    'nature': {
        src: './textures/nature.png',
        r: 3,
        c: 4,
    },
    'dice': {
        src: './textures/dice.png',
        r: 1,
        c: 6,
    },
    'player': {
        src: './textures/player.png',
        r: 9,
        c: 8
    }
}, {
    'BOX': {
        src: 'boxes',
        x: 0,
        y: 0,
        xx: 0,
        yy: 0,
    },
    'PLAYER': {
        src: 'player'
    }
})

client = Client({
    keyToConstructor: OBJECTS
});

client.preHandler = () => {
    if (Z_SCALINGENABLED) {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MAX, 0.5)
    } else {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MIN, 0.5)
    }
    TILE_SELECTOR_FCOUNTER += 1;
    if (TILE_SELECTOR_FCOUNTER >= TILE_SELECTOR_LENGTH) {
        TILE_SELECTOR_FCOUNTER = 0;
        TILE_SELECTOR_INDEX += 1;
        if (TILE_SELECTOR_INDEX >= 4) {
            TILE_SELECTOR_INDEX = 0;
        }
    }
}

client.camera.scaleY = 0.8

////// UI //////

//// DICE ////

var DiceUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        diceSize: 50,

        rolling: false,

        diceA: 1,
        diceB: 1,

        currentX: 0,
        currentY: 0,
        currentDiceSize: 50,

        ...initObject
    })

    self.renderNumberPair = (ctx, a, b) => {
        ctx.imageSmoothingEnabled = false;

        var diceMargin = self.diceSize / 5;

        ctx.drawImage(textureManager.getSprite('dice', a - 1), self.currentX - self.currentDiceSize - diceMargin / 2, self.currentY - self.currentDiceSize, self.currentDiceSize, self.currentDiceSize);
        ctx.drawImage(textureManager.getSprite('dice', b - 1), self.currentX + diceMargin / 2, self.currentY - self.currentDiceSize, self.currentDiceSize, self.currentDiceSize);

    }

    self.render = (ctx) => {
        if (self.rolling) {
            self.renderNumberPair(ctx, `${SpoolMath.randomInt(1, 6)}`, `${SpoolMath.randomInt(1, 6)}`);
        } else {
            self.renderNumberPair(ctx, `${self.diceA}`, `${self.diceB}`);
        }

        var targetX = self.x
        var targetY = self.y
        var targetSize = self.diceSize

        if (client.queueUi.currentPlayerId != undefined) {
            if (client.queueUi.currentPlayerId == client.clientId && (Date.now() - self.rollTime < 1000 || self.rolling)) {
                targetX = client.gameArea.width / 2;
                targetY = client.gameArea.height / 2;
                targetSize = self.diceSize * 2;
            }
        }
        self.currentX = SpoolMath.lerp(self.currentX, targetX, 0.2)
        self.currentY = SpoolMath.lerp(self.currentY, targetY, 0.2)
        self.currentDiceSize = SpoolMath.lerp(self.currentDiceSize, targetSize, 0.2);
    }

    return self;
}

var diceUi = DiceUI({
    x: client.gameArea.width - 200,
    y: 200
})
client.diceUi = diceUi;



//// QUEUE ////

var QueueUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        queue: [],
        timeOnTimer: 0,

        ...initObject
    })

    self.renderGem = (ctx, text, box, type) => {
        ctx.drawImage(textureManager.getSprite('queuegems', type), box.x, box.y, box.width, box.height);
        SpoolRenderer.multiLineText(ctx, text, box);
    }

    self.render = (ctx) => {
        SpoolRenderer.setColor(ctx, 'black');
        SpoolRenderer.setFont(ctx, 'Arial', 20)

        var timerMargin = 20;
        var timerBox = SpoolRect(self.x + timerMargin, self.y + timerMargin, 100 - timerMargin * 2, self.height - timerMargin * 2);

        var timerValue = 0;
        var timerMaxValue = 0;

        if (self.endTime) {
            timerValue = Math.ceil((self.endTime - Date.now()) / 1000)
            timerMaxValue = Math.ceil((self.timeOnTimer ? self.timeOnTimer : 1) / 1000)
        }


        renderVialValue(ctx, 'green', timerValue, timerMaxValue, timerBox)

        x = 100;

        var queueHeight = 64;
        var queueY = self.height / 2 - queueHeight / 2

        if (self.queue.thisRound) {
            self.queue.thisRound.forEach(value => {
                self.renderGem(ctx, value, SpoolRect(self.x + x, queueY, queueHeight * 2, queueHeight), 0);
                x += queueHeight * 2 + 10;
            })
            SpoolRenderer.fillRect(ctx, x, self.y, 3, self.height);
            x += 3;
        }
        if (self.queue.nextRound) {

            self.queue.nextRound.forEach(value => {
                self.renderGem(ctx, value, SpoolRect(self.x + x, queueY, queueHeight * 2, queueHeight), 2);
                x += queueHeight * 2 + 10;
            })
        }
    }

    return self;
}


var queueUi = QueueUI({
    x: 0,
    y: 0,
    width: client.gameArea.width,
    height: 100
})
client.queueUi = queueUi;


//// ALERT UI ////

var AlertUi = (initObject) => {
    var self = SpoolUIElement({
        alerts: [],
        ...initObject
    });

    self.pushAlert = (msg) => {
        self.alerts.push(msg);
        if (self.alerts.length > 5) {
            self.alerts.splice(0, 1);
        }
        self.awake = true;
        self.endTime = Date.now() + 2000;
    }

    self.render = (ctx) => {

        if (self.awake) {

            self.alerts.forEach((value, index) => {

                var invertedIndex = self.alerts.length - (index);

                var rect = SpoolRect(
                    self.x - self.width / 2,
                    self.y - self.height * (invertedIndex),
                    self.width,
                    self.height)
                invertedIndex++;
                SpoolRenderer.setColor(ctx, `#${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}${invertedIndex}`)
                SpoolRenderer.fillSplRect(ctx, rect);
                SpoolRenderer.setColor(ctx, 'white')
                SpoolRenderer.setFont(ctx, 'Arial', 15);
                SpoolRenderer.multiLineText(ctx, value, rect, rect.width);
            })
            if (Date.now() > self.endTime) {
                self.awake = false;
            }
        }
    }

    return self;
}

var alertUi = AlertUi({
    x: client.gameArea.width / 4 * 3,
    y: client.gameArea.height,
    width: 200,
    height: 50
});
client.alertUi = alertUi;
client.uiHandler.add(alertUi);

//// HAND ////

var HandUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        cardsPar: [],

        cardsCol: [],

        lastCol: -1,

        limit: 6,

        animTop: 100,
        animStart: 0,

        activatedCard: null,
        activatedIndex: null,

        yOffsetMax: 200,
        yOffsetMin: -50,
        yOffset: -100,

        cardWidth: 154,
        hardHeight: 285,

        hidden: false,

        delayedMx: 0,
        delayedMy: 0,

        openedWidth: 600,
        closedWidth: 300,
        handWidth: 600,

        ...initObject
    })

    self.render = (ctx) => {
        self.cards = client.clientObject.hand;


        if (!self.hidden) {
            if (self.my < client.gameArea.height / 2) {
                self.hidden = true;
            }

        } else {
            if (self.my > client.gameArea.height / 4 * 3) {
                self.hidden = false;
            }
        }



        if (self.activatedCard || self.hidden) {
            self.yOffset = SpoolMath.lerp(self.yOffset, self.yOffsetMax, 0.2);
            self.handWidth = SpoolMath.lerp(self.handWidth, self.closedWidth, 0.2);
        } else {
            self.yOffset = SpoolMath.lerp(self.yOffset, self.yOffsetMin, 0.2);
            self.handWidth = SpoolMath.lerp(self.handWidth, self.openedWidth, 0.2);
        }

        var handbounds = {
            width: self.handWidth,
        }
        handbounds.middle = client.gameArea.width / 2
        var point = {
            x: handbounds.middle,
            y: client.gameArea.height + self.yOffset,
        }
        var bounds = {
            x: -self.cardWidth / 2,
            y: -self.hardHeight,
            width: self.cardWidth,
            height: self.hardHeight
        }
        var circle = {
            radius: 800,
            x: point.x,
            start: 0 - ((handbounds.width / (self.limit - 1)) * (self.cards.length - 1)) / 2
        }
        circle.y = point.y + circle.radius
        if (self.cards.length <= self.limit) {
            for (i = 0; i < self.cards.length; i++) {
                var pos = SpoolMath.getYFromMovedCircle(circle.x, circle.y, circle.start, circle.radius)
                var angle = SpoolMath.getAngleFromCircle(circle.radius, circle.start)
                self.cardsPar.push(pos[0])
                self.cardsPar.push(pos[1])
                self.cardsPar.push(angle)
                circle.start += handbounds.width / (self.limit - 1)
            }
        } else {
            circle.start = 0 - handbounds.width / 2
            for (i = 0; i < self.cards.length; i++) {
                var pos = SpoolMath.getYFromMovedCircle(circle.x, circle.y, circle.start, circle.radius)
                var angle = SpoolMath.getAngleFromCircle(circle.radius, circle.start)
                self.cardsPar.push(pos[0])
                self.cardsPar.push(pos[1])
                self.cardsPar.push(angle)
                circle.start += handbounds.width / (self.cards.length - 1)
            }
        }
        for (i = 0; i < self.cards.length; i++) {

            var rotatedP = SpoolMath.rotatePoint(self.cardsPar[i * 3], self.cardsPar[1 + i * 3], self.mx, self.my, self.cardsPar[2 + i * 3])
            if (SpoolMath.rectangleMouseCollision(self.cardsPar[i * 3] - bounds.width / 2, self.cardsPar[1 + i * 3], bounds.width, bounds.height, rotatedP[0], rotatedP[1])) {
                self.cardsCol.push(true)
            } else {
                self.cardsCol.push(false)
            }
        }

        for (i = 0; i < self.cards.length; i++) {
            if (self.cardsCol[self.cards.length - i - 1] == true) {
                var colOn = self.cards.length - i - 1
                break
            }
        }
        if (colOn != self.lastCol) {
            self.animStart = 0
        }
        if (colOn != undefined) {
            self.animStart = SpoolMath.lerp(self.animStart, 1, 0.2)
        } else {
            self.animStart = 0
        }

        ctx.imageSmoothingEnabled = true;

        for (i = 0; i < self.cards.length; i++) {


            var cardid = self.cards[i];
            var card = client.clientObject.cardInfo[cardid];

            var sprite = textureManager.getSprite('card', card.textureTileIndex);

            var angle = (self.mx - self.delayedMx) / 100;
            angle = angle > Math.PI / 2 ? Math.PI / 2 : angle < -Math.PI / 2 ? -Math.PI / 2 : angle;


            if (i == self.activatedIndex) {
                SpoolRenderer.renderRotatedSprite(ctx, sprite, angle, self.mx, self.my - 10, {
                    x: bounds.x / 2,
                    y: bounds.y / 2,
                    width: bounds.width / 2,
                    height: bounds.height / 2
                });
            } else {

                if (colOn != undefined && i == colOn) {
                    var lerpX = Math.sin(self.cardsPar[2 + i * 3]) * bounds.height / 1.2
                    var lerpY = Math.cos(self.cardsPar[2 + i * 3]) * bounds.height / 1.2
                    SpoolRenderer.renderRotatedSprite(ctx, sprite, self.cardsPar[2 + i * 3], self.cardsPar[0 + i * 3] - self.animStart * lerpX, self.cardsPar[1 + i * 3] - self.animStart * lerpY, bounds)
                } else {
                    SpoolRenderer.renderRotatedSprite(ctx, sprite, self.cardsPar[2 + i * 3], self.cardsPar[0 + i * 3], self.cardsPar[1 + i * 3], bounds)
                }
            }
        }
        self.lastCol = colOn
        self.cardsPar = []
        self.cardsCol = []

        self.delayedMx = SpoolMath.lerp(self.delayedMx, self.mx, 0.15);
        self.delayedMy = SpoolMath.lerp(self.delayedMy, self.my, 0.15);
    }

    self.mouseEvent = (event) => {
        if (event.type == 'mousedown') {
            if (event.button == 0) {
                if (!self.activatedCard) {
                    if (self.lastCol != undefined) {
                        var cardid = self.cards[self.lastCol];
                        var card = client.clientObject.cardInfo[cardid]
                        self.activatedCard = card;
                        self.activatedIndex = self.lastCol;
                        return true;
                    }
                } else {
                    var res = getTileInPoint(event.x, event.y);
                    client.emit('CARD_ACTION', {
                        type: 'card',
                        tx: res.tx,
                        ty: res.ty,
                        cardid: self.activatedCard.cardID
                    })
                    self.activatedCard = null;
                    self.activatedIndex = null;
                    return true;
                }
            } else if (event.button == 2) {
                self.activatedCard = null;
                self.activatedIndex = null;
                return true;
            }
        }
    }

    self.mouseMove = (event) => {
        self.mx = event.clientX;
        self.my = event.clientY;



        self.selectedTx = null
        self.selectedTy = null
        if (self.activatedCard) {
            var res = null;
            Object.keys(colBoxes).forEach(key => {
                var box = colBoxes[key];
                if (SpoolMath.distance(event.x, event.y, box.x, box.y) <= box.radius) {
                    res = box.tile;
                }
            })

            if (res) {
                self.selectedTx = res.tx;
                self.selectedTy = res.ty;
            }
        }
    }

    return self
}
var handUi = HandUI()
client.handUi = handUi

//// DAMAGE FLOATERS ////

var DamageFloatersUI = (initObject) => {
    var self = SpoolUIElement(initObject);

    self.damageFloaters = [];

    self.render = (ctx) => {
        SpoolRenderer.setColor(ctx, 'white');

        var cuttingIndex = -1;

        self.damageFloaters.forEach((floater, index) => {
            if (!floater.frameCounter) {
                floater.frameCounter = 0;
            }

            var point = client.camera.transformPoint(floater.x, floater.y);
            point.y -= Z_SCALINGFACTOR * floater.z + floater.frameCounter * 5;

            ctx.globalAlpha = 1 - floater.frameCounter / 30;
            console.log(ctx.globalAlpha);

            SpoolRenderer.setFont(ctx, 'Arial', 25);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            ctx.strokeText(floater.dmg, point.x, point.y);
            SpoolRenderer.simpleText(ctx, floater.dmg, point.x, point.y);

            ctx.globalAlpha = 1;

            floater.frameCounter += 1;

            console.log(floater.frameCounter);

            if (floater.frameCounter > 30) {
                if (index > cuttingIndex) {
                    cuttingIndex = index;
                }
            }
        })

        if (cuttingIndex > -1) {
            self.damageFloaters.splice(0, cuttingIndex + 1);
        }
    }

    self.add = (data) => {
        self.damageFloaters = self.damageFloaters.concat(data);
    }

    return self;
}

var damageFloatersUI = DamageFloatersUI();

client.damageFloatersUI = damageFloatersUI;



//// PLAYER INFORMATION ////

var PlayerInformationUI = (initObject) => {
    var self = SpoolUIElement({
        ...initObject
    });

    self.render = (ctx) => {
        if (client.clientObject) {

            var vialSize = 60;
            SpoolRenderer.setFont(ctx, 'Arial', 20);

            SpoolRenderer.setColor(ctx, 'black');

            var margin = 10;

            SpoolRenderer.multiLineText(
                ctx,
                `${client.clientObject.name}`,
                SpoolRect(self.x, self.y, vialSize, vialSize));

            ctx.lineWidth = 2;
            renderVialValue(
                ctx, 'red',
                client.clientObject.hp, client.clientObject.maxHp,
                SpoolRect(self.x + vialSize, self.y, vialSize, vialSize));

            renderVialValue(
                ctx, 'yellow',
                client.clientObject.energy, client.clientObject.maxEnergy,
                SpoolRect(self.x + vialSize * 2 + margin, self.y, vialSize, vialSize));

            renderVialValue(
                ctx, 'gray',
                client.clientObject.ammo, client.clientObject.maxAmmo,
                SpoolRect(self.x + vialSize * 3 + margin * 2, self.y, vialSize, vialSize));

            if (client.clientObject.equip.weapon) {
                SpoolRenderer.simpleText(ctx, client.clientObject.equip.weapon.name, 100, 400);
            }

            client.clientObject.equip.trinkets.forEach((trinket, index) => {
                SpoolRenderer.simpleText(ctx, trinket.name, 100, 450 + index * 50);
            })

            Object.keys(client.clientObject.stats).forEach((key, index) => {
                SpoolRenderer.simpleText(ctx, `${key}: ${client.clientObject.stats[key]}`, client.gameArea.width - 100, 400 + index * 50)
            });
        }
    }

    return self;
}

var playerInformation = PlayerInformationUI({
    x: 50,
    y: client.gameArea.height - 100,
    width: 400,
    height: 100
})



////// CAMERA //////

client.camera.lerp = true;
client.camera.onUpdate = (self) => {
    if (client.clientObject) {
        self.followObject = client.clientObject;
    }
}

client.handler.textureManager = textureManager;
textureManager.onLoad = () => {


    client.socketInit()

    // LISTENERS //

    var keyListener = KeyboardListener(client.socket);
    keyListener.initListener();
    keyListener.onKeyDown = (event) => {
        if (event.keyCode == 70) {
            Z_SCALINGENABLED = !Z_SCALINGENABLED;
        }
    }

    var mouseListener = MouseListener(client);
    mouseListener.initListener();

    client.onMouseEvent = (event) => {
        if (event.type == 'mousedown') {
            var res = null;

            Object.keys(colBoxes).forEach(key => {
                var box = colBoxes[key];
                if (SpoolMath.distance(event.x, event.y, box.x, box.y) <= box.radius) {
                    res = box.tile;
                }
            })

            if (res) {
                if (event.button == 0) {
                    client.emit("MOVE_TO", {
                        tx: res.tx,
                        ty: res.ty
                    });
                }
            }
        }
    }

    //// UI LISTENERS ////

    client.socket.on('DAMAGE_FLOATERS', data => {
        client.damageFloatersUI.add(data);
    })

    client.socket.on('DICE', (data) => {
        if (data.rolling) {
            client.diceUi.rolling = true;
        } else {
            client.diceUi.rolling = false;
            client.diceUi.diceA = data.diceA;
            client.diceUi.diceB = data.diceB;
            client.diceUi.rollTime = Date.now();
        }
    })

    client.socket.on('SET_QUEUE', (data) => {
        client.queueUi.queue = data.queue;
        client.queueUi.currentPlayerId = data.currentPlayerId;
    })

    client.socket.on('SET_TIMER', (data) => {
        client.queueUi.endTime = data.endTime;
        client.queueUi.timeOnTimer = data.endTime - Date.now();
    })

    client.socket.on('ALERT', (data) => {
        client.alertUi.pushAlert(data.msg);
    });

    client.uiHandler.add(diceUi);
    client.uiHandler.add(queueUi);
    client.uiHandler.add(damageFloatersUI);
    client.uiHandler.add(handUi);
    client.uiHandler.add(playerInformation);

    client.background = (ctx, camera) => {
        ctx.fillStyle = '#87cefa';
        ctx.fillRect(0, 0, client.gameArea.width, client.gameArea.height);
    }

    client.startGameLoop()
}

textureManager.load()