var SpoolRenderer = {
    setColor: (ctx, color) => {
        ctx.fillStyle = color;
    },

    setFont: (ctx, fontFace, fontSize) => {
        ctx.font = `${fontSize}px ${fontFace}`;
    },

    drawInscribedOval: (ctx, rect) => {
        ctx.beginPath();
        ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, 0, 360);
        ctx.stroke();
    },

    fillInscribedOval: (ctx, rect) => {
        ctx.beginPath();
        ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, 0, 360);
        ctx.fill();
    },

    fillInscribedOvalPercentFull: (ctx, rect, p) => {
        ctx.beginPath();
        if (p > 0.5) {
            var temp = p - 0.5;
            var angle = Math.asin(temp * 2)
            ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, -angle, Math.PI + angle);
        } else {
            var angle = Math.asin((0.5 - p) * 2)
            ctx.ellipse(rect.cx, rect.cy, rect.width / 2, rect.height / 2, 0, angle, Math.PI - angle);
        }
        ctx.fill();
    },

    drawOval: (ctx, cx, cy, radius) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 360);
        ctx.stroke();
    },

    fillOval: (ctx, cx, cy, radius) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 360);
        ctx.fill();
    },

    renderRotatedSprite: (ctx, sprite, angle, cx, cy, bounds) => {
        ctx.save()

        ctx.translate(cx, cy);

        ctx.rotate(-angle)
        ctx.drawImage(sprite, bounds.x, bounds.y, bounds.width, bounds.height)

        ctx.restore()
    },


    drawRect: (ctx, x, y, width, height) => {
        ctx.drawRect(x, y, width, height);
    },

    fillRect: (ctx, x, y, width, height) => {
        ctx.fillRect(x, y, width, height);
    },

    fillSplRect: (ctx, rect) => {
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    },

    multiLineText: (ctx, text, box, maxWidth) => {
        var words = text.split(' ');
        var line = '';
        var lines = [];

        ctx.textAlign = 'center';

        words.forEach((word, index) => {
            var tempWidth = ctx.measureText(line + word).width;
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

        var lineHeight = parseInt(ctx.font) + 3;

        lines.forEach((line, index) => {
            ctx.fillText(
                line,
                box.x + box.width / 2,
                box.y + box.height / 2 - (lines.length - 1) / 2 * lineHeight + index * lineHeight + lineHeight / 3)
        })
    },

    simpleText: (ctx, text, x, y) => {
        ctx.fillText(text, x, y);
    }
}