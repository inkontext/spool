var SpoolRenderer = {
    //// CTX SETTING ////
    ctx: null,
    setColor: (color) => {
        SpoolRenderer.ctx.fillStyle = color;
    },

    setFont: (fontFace, fontSize) => {
        SpoolRenderer.ctx.font = `${fontSize}px ${fontFace}`;
    },

    //// OVALS ////

    drawInscribedOval: (rect) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, 0, 360);
        SpoolRenderer.ctx.stroke();
    },

    fillInscribedOval: (rect) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, 0, 360);
        SpoolRenderer.ctx.fill();
    },

    fillInscribedOvalPercentFull: (rect, p) => {
        SpoolRenderer.ctx.beginPath();
        if (p > 0.5) {
            var temp = p - 0.5;
            var angle = Math.asin(temp * 2)
            SpoolRenderer.ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, -angle, Math.PI + angle);
        } else {
            var angle = Math.asin((0.5 - p) * 2)
            SpoolRenderer.ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, angle, Math.PI - angle);
        }
        SpoolRenderer.ctx.fill();
    },

    drawOval: (cx, cy, radius) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.arc(cx, cy, radius, 0, 360);
        SpoolRenderer.ctx.stroke();
    },

    fillOval: (cx, cy, radius) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.arc(cx, cy, radius, 0, 360);
        SpoolRenderer.ctx.fill();
    },

    //// SPRITES ////

    renderRotatedSprite: (sprite, angle, cx, cy, bounds) => {
        SpoolRenderer.ctx.save()

        SpoolRenderer.ctx.translate(cx, cy);

        SpoolRenderer.ctx.rotate(-angle)
        SpoolRenderer.ctx.drawImage(sprite, bounds.x, bounds.y, bounds.width, bounds.height)

        SpoolRenderer.ctx.restore()
    },

    //// RECT ////

    drawRect: (x, y, width, height) => {
        SpoolRenderer.ctx.drawRect(x, y, width, height);
    },

    fillRect: (x, y, width, height) => {
        SpoolRenderer.ctx.fillRect(x, y, width, height);
    },

    fillSplRect: (rect) => {
        SpoolRenderer.ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    },

    //// TEXT ////

    multiLineText: (text, box, maxWidth, fontOffsetCoef = 0.33, strokeWidth = null) => {

        var hardLines = text.split('\n');
        var lines = [];

        hardLines.forEach(singleHardLine => {
            var words = singleHardLine.split(' ');
            var line = '';

            SpoolRenderer.ctx.textAlign = 'center';

            words.forEach((word, index) => {
                var tempWidth = SpoolRenderer.ctx.measureText(line + word).width;
                if (tempWidth >= maxWidth) {
                    lines.push(line.trim());
                    line = word;
                } else {
                    line += ' ' + word;
                }
            })

            if (line) {
                lines.push(line.trim());
            }
        })

        var lineHeight = parseInt(SpoolRenderer.ctx.font) + 3;

        lines.forEach((line, index) => {

            var tx = box.x + box.width / 2;
            var ty = box.y + box.height / 2 - (lines.length - 1) / 2 * lineHeight + index * lineHeight + lineHeight * fontOffsetCoef;

            if (strokeWidth) {
                SpoolRenderer.ctx.lineWidth = strokeWidth;
                SpoolRenderer.ctx.strokeText(line, tx, ty);
            }
            SpoolRenderer.ctx.fillText(
                line,
                tx,
                ty)
        })
    },

    simpleText: (text, x, y, stroke = null) => {
        if (stroke) {
            SpoolRenderer.ctx.lineWidth = stroke;
            SpoolRenderer.ctx.strokeText(text, x, y);
        }
        SpoolRenderer.ctx.fillText(text, x, y);
    }
}