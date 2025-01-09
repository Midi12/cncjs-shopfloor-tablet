class BoundingBox {
    constructor() {
        this.min = {
            x: Infinity,
            y: Infinity
        };
        this.max = {
            x: -Infinity,
            y: -Infinity
        };
        this.isSet = false;
    }

    update(x, y) {
        this.min.x = Math.min(this.min.x, x);
        this.min.y = Math.min(this.min.y, y);
        this.max.x = Math.max(this.max.x, x);
        this.max.y = Math.max(this.max.y, y);
        this.isSet = true;
    }

    reset() {
        this.min.x = Infinity;
        this.min.y = Infinity;
        this.max.x = -Infinity;
        this.max.y = -Infinity;
        this.isSet = false;
    }
}

class BoundingBoxHandlers {
    constructor(bbox) {
        this.bbox = bbox;
    }

    addLine(modal, start, end) {
        this.bbox.update(start.x, start.y);
        this.bbox.update(end.x, end.y);
    }

    addArcCurve(modal, start, end, center) {
        // Update bbox for arc curves
        // ...
        const sx = start.x - center.x;
        const sy = start.y - center.y;
        const ex = end.x - center.x;
        const ey = end.y - center.y;
        const radius = Math.hypot(sx, sy);

        const px = sy >= 0 && ex <= 0 && ey >= 0 || sy < 0 && (ex > 0 && ey < 0 || ex <= 0 && ey >= 0);
        const py = sx < 0 && ey >= 0 && ex < 0 || sx >= 0 && (ey < 0 && ex >= 0 || ey >= 0 && ex < 0);
        const mx = sy < 0 && ex >= 0 && ey < 0 || sy >= 0 && (ex < 0 && ey >= 0 || ex >= 0 && ey < 0);
        const my = sx >= 0 && ey < 0 && ex >= 0 || sx < 0 && (ey >= 0 && ex < 0 || ey < 0 && ex >= 0);

        const maxX = px ? center.x + radius : Math.max(start.x, end.x);
        const maxY = py ? center.y + radius : Math.max(start.y, end.y);
        const minX = mx ? center.x - radius : Math.min(start.x, end.x);
        const minY = my ? center.y - radius : Math.min(start.y, end.y);

        this.bbox.update(minX, minY);
        this.bbox.update(maxX, maxY);
    }
}

class Tool {
    constructor(context, radius = 6) {
        this.context = context;
        this.x = null;
        this.y = null;
        this.radius = radius;
    }

    draw(pos) {
        if (!this.context) return;
        
        // Save current transform
        this.context.save();
        // Reset transform for tool drawing
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        
        this.context.beginPath();
        this.context.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
        this.context.fillStyle = 'magenta';
        this.context.fill();
        this.context.strokeStyle = 'magenta';
        this.context.stroke();
        
        // Restore previous transform
        this.context.restore();
    }

    clear() {
        if (!this.context || this.x === null || this.y === null) return;
        
        // Save current transform
        this.context.save();
        // Reset transform for clearing
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        
        const size = this.radius * 2;
        this.context.clearRect(this.x - this.radius, this.y - this.radius, size, size);
        
        // Restore previous transform
        this.context.restore();
    }

    update(pos) {
        this.clear();
        this.draw(pos);
        this.x = pos.x;
        this.y = pos.y;
    }
}

class DisplayHandlers {
    constructor(context, canvas) {
        this.context = context;
        this.canvas = canvas;
        this.initialMoves = true;
    }

    // Convert Y coordinate from CNC space to canvas space
    convertY(y) {
        return this.canvas.height - y;
    }

    addLine(modal, start, end) {
        if (!this.context) return;

        const motion = modal.motion;
        if (motion === 'G0') {
            this.context.strokeStyle = this.initialMoves ? 'red' : 'green';
        } else {
            this.context.strokeStyle = 'blue';
            if (start.x !== end.x || start.y !== end.y) {
                this.initialMoves = false;
            }
        }

        // Draw line converting Y coordinates
        this.context.beginPath();
        this.context.moveTo(start.x, this.convertY(start.y));
        this.context.lineTo(end.x, this.convertY(end.y));
        this.context.stroke();
    }

    addArcCurve(modal, start, end, center) {
        if (!this.context) return;

        const motion = modal.motion;
        const deltaX1 = start.x - center.x;
        // Flip Y deltas since we're drawing from bottom
        const deltaY1 = -(start.y - center.y);
        const radius = Math.hypot(deltaX1, deltaY1);
        const deltaX2 = end.x - center.x;
        const deltaY2 = -(end.y - center.y);
        
        let theta1 = Math.atan2(deltaY1, deltaX1);
        let theta2 = Math.atan2(deltaY2, deltaX2);
        
        if (theta1 === theta2) {
            // For G2 (clockwise) we need to subtract 2π, for G3 add 2π
            theta2 += Math.PI * (modal.motion === "G2" ? -2 : 2);
        }

        this.initialMoves = false;
        this.context.beginPath();
        this.context.strokeStyle = 'blue';
        this.context.arc(
            center.x, 
            this.convertY(center.y), 
            radius, 
            -theta1,  // Negate angles due to flipped Y
            -theta2, 
            modal.motion !== 'G2'  // Reverse direction due to flipped Y
        );
        this.context.stroke();
    }
}

class ToolpathDisplayer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas element not found:', canvasId);
            return;
        }
        
        this.context = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!this.context) {
            console.error('Could not get 2D context');
            return;
        }

        // Initialize core properties
        this.bbox = new BoundingBox();
        this.bboxHandlers = new BoundingBoxHandlers(this.bbox);
        this.displayHandlers = new DisplayHandlers(this.context, this.canvas);
        this.tool = new Tool(this.context);
        this.units = 'G21';
        this.pathImage = null;
        this.currentGcode = '';
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentNode) return;
        this.rect = this.canvas.parentNode.getBoundingClientRect();
        this.canvas.width = this.rect.width;
        this.canvas.height = this.rect.height;
        this.transformCanvas();
    }

    transformCanvas() {
        if (!this.context) return;
        
        // Clear canvas
        this.context.fillStyle = "white";
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.bbox.isSet) return;

        this._drawOrigin(5);
    }

    drawToolpath(gcode, wpos, mpos) {
        if (!this.context) return;

        const factor = this.units === 'G20' ? 25.4 : 1.0;

        const initialPosition = {
            x: wpos.x * factor,
            y: wpos.y * factor,
            z: wpos.z * factor
        };

        const mposmm = {
            x: mpos.x * factor,
            y: mpos.y * factor,
            z: mpos.z * factor
        };

        // Only redraw the path if we have new gcode
        if (gcode && gcode !== this.currentGcode) {
            this.currentGcode = gcode;
            this.bbox.reset();
            
            const bboxToolpath = new Toolpath({
                position: initialPosition,
                addLine: (modal, start, end) => this.bboxHandlers.addLine(modal, start, end),
                addArcCurve: (modal, start, end, center) => this.bboxHandlers.addArcCurve(modal, start, end, center)
            });
            bboxToolpath.loadFromLinesSync(gcode.split('\n'));

            this.transformCanvas();

            if (this.bbox.isSet) {
                this.clear();
                this.displayHandlers.initialMoves = true;
                this.drawPath(gcode);
                this.pathImage = this.capturePathImage();
            }
        } else if (this.pathImage) {
            this.restorePathImage();
        }

        // Update tool position
        if (this.tool && this.bbox.isSet) {
            this.tool.update({
                x: initialPosition.x,
                y: this.canvas.height - initialPosition.y  // Convert Y to canvas space
            });
        }
    }

    capturePathImage() {
        if (!this.context || !this.canvas) return null;
        try {
            return this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        } catch (error) {
            console.error('Failed to capture path image:', error);
            return null;
        }
    }

    restorePathImage() {
        if (!this.context || !this.pathImage || !this.canvas) return false;
        try {
            this.clear();
            this.context.putImageData(this.pathImage, 0, 0);
            return true;
        } catch (error) {
            console.error('Failed to restore path image:', error);
            return false;
        }
    }

    drawPath(gcode) {
        if (!this.context || !this.displayHandlers) return;
        
        const gcodeLines = gcode.split('\n');
        const toolpath = new Toolpath({
            position: { x: 0, y: 0, z: 0 },
            addLine: (modal, start, end) => this.displayHandlers.addLine(modal, start, end),
            addArcCurve: (modal, start, end, center) => this.displayHandlers.addArcCurve(modal, start, end, center)
        });
        
        toolpath.loadFromLinesSync(gcodeLines);
    }

    clear() {
        if (!this.context || !this.canvas) return;
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _drawOrigin(radius) {
        if (!this.context) return;
        
        this.context.beginPath();
        this.context.strokeStyle = 'red';
        this.context.arc(0, this.canvas.height, radius, 0, Math.PI * 2, false);
        this.context.moveTo(-radius * 1.5, this.canvas.height);
        this.context.lineTo(radius * 1.5, this.canvas.height);
        this.context.moveTo(0, this.canvas.height + radius * 1.5);
        this.context.lineTo(0, this.canvas.height - radius * 1.5);
        this.context.stroke();
    }

    formatLimit(mm) {
        return this.units === 'G20' ? `${(mm / 25.4).toFixed(3)}"` : `${mm.toFixed(2)}mm`;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = ToolpathDisplayer;
}