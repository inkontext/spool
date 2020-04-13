////// CLIENT //////

var Z_SCALINGFACTOR_MAX = 10;
var Z_SCALINGFACTOR_MIN = 3;
var Z_SCALINGFACTOR = Z_SCALINGFACTOR_MAX;
var Z_SCALINGENABLED = true;

var colBoxes = {};

var client = null;

var Tile = (initObject) => {
    var self = Entity({
        ...initObject
    });

    var superSelf = {
        render: self.render
    }

    self.color = SpoolMath.randomColor(100, 255);
    self.darkColor = SpoolMath.divideColor(self.color, 2);

    self.update = (data) => {
        console.log(data);
        if (data.objects != []) {
            console.log(self.tx, self.ty);
        }
        Object.assign(self, data);
    }

    self.render = (ctx, camera) => {
        var r = self.hexRadius;
        var startAngle = 0;
        var n = 6;

        var points = []
        var pointsDown = []

        for (var i = 0; i < n; i++) {
            angle = startAngle + Math.PI * 2 / n * i;
            var point = camera.transformPoint(self.x - r * Math.cos(angle), self.y - r * Math.sin(angle));
            pointsDown.push(point);
            points.push({
                x: point.x,
                y: point.y - self.z * Z_SCALINGFACTOR
            })
        }


        ctx.fillStyle = '#' + self.darkColor;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(points[5].x, points[5].y)
        ctx.lineTo(points[4].x, points[4].y)
        ctx.lineTo(points[3].x, points[3].y)
        ctx.lineTo(pointsDown[3].x, client.gameArea.height) //pointsDown[3].y)
        // ctx.lineTo(pointsDown[2].x, pointsDown[2].y)
        // ctx.lineTo(pointsDown[1].x, pointsDown[1].y)
        ctx.lineTo(pointsDown[0].x, client.gameArea.height) //, pointsDown[0].y)
        ctx.closePath();
        ctx.fill();

        colPoint = camera.transformPoint(self.x, self.y);
        colBox = {
            x: colPoint.x,
            y: colPoint.y - self.z * Z_SCALINGFACTOR,
            radius: camera.transformDimension(self.hexRadius) * Math.sin(Math.PI / 3),
            tile: self
        }
        colBoxes[self.id] = colBox;



        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y)
        for (var i = 1; i < n; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.closePath();
        ctx.fill();

        self.objects.forEach(object => {
            var temp = client.handler.objectsById[object];
            if (temp) {
                temp.renderOnTile(ctx, camera, colBox.x, colBox.y);
            }
        })
    }

    return self;
}

var Player = (initObject) => {
    var self = RectangleEntity({
        ...initObject
    })

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        SpoolRenderer.setColor(ctx, self.color);
        SpoolRenderer.fillOval(ctx, tilex, tiley, 30);
    }

    return self;
}

var HandUI = (initObject) => {
    var self = SpoolUIElement({
        visible: true,

        cards: ['bbb', 'vvv', 'bbb'],

        cardsPar: [],

        cardsCol: [],

        lastCol: -1,

        limit: 7,

        animTop: 100,
        animStart: 0,

        ...initObject
    })

    self.render = (ctx) => {
        var handbounds = {
            width: 400,
        }
        handbounds.middle = client.gameArea.width / 2
        var point = {
            x: handbounds.middle,
            y: client.gameArea.height - 70,
        }
        var bounds = {
            x: -76.5,
            y: -285,
            width: 153,
            height: 285
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
            self.animStart = SpoolMath.lerp(self.animStart, 1, 0.5)
        } else {
            self.animStart = 0
        }
        for (i = 0; i < self.cards.length; i++) {
            if (colOn != undefined && i == colOn) {
                var lerpX = Math.sin(self.cardsPar[2 + i * 3]) * bounds.height / 1.2
                var lerpY = Math.cos(self.cardsPar[2 + i * 3]) * bounds.height / 1.2
                SpoolRenderer.renderRotatedSprite(ctx, textureManager.getSprite('card'), self.cardsPar[2 + i * 3], self.cardsPar[0 + i * 3] - self.animStart * lerpX, self.cardsPar[1 + i * 3] - self.animStart * lerpY, bounds)
            } else {
                SpoolRenderer.renderRotatedSprite(ctx, textureManager.getSprite('card'), self.cardsPar[2 + i * 3], self.cardsPar[0 + i * 3], self.cardsPar[1 + i * 3], bounds)
            }
        }
        self.lastCol = colOn
        self.cardsPar = []
        self.cardsCol = []
    }

    return self
}

var OBJECTS = {
    'TILE': {
        const: Tile
    },
    'PLAYER': {
        const: Player
    }
}

textureManager = TextureManager({
    'card': {
        src: './textures/card.png',
        r: 1,
        c: 1
    }
}, {})

client = Client({
    keyToConstructor: OBJECTS
});

client.preHandler = () => {
    if (Z_SCALINGENABLED) {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MAX, 0.5)
    } else {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MIN, 0.5)
    }
}



client.camera.scaleY = 0.8

client.socketInit()

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
    var res = null;
    Object.keys(colBoxes).forEach(key => {
        var box = colBoxes[key];
        if (SpoolMath.distance(event.x, event.y, box.x, box.y) <= box.radius) {
            res = box.tile;
        }
    })
    if (res) {
        res.color = 'red';
        client.emit("MOVE_TO", {
            tx: res.tx,
            ty: res.ty
        });
    }


}

client.startGameLoop()


////// CAMERA //////

client.camera.onUpdate = (self) => {
    if (client.clientObject) {
        self.followObject = client.clientObject;
    }
}
textureManager.onLoad = () => {
    var handUi = HandUI()

    client.handUi = handUi

    client.uiHandler.add(handUi);
}

textureManager.load()