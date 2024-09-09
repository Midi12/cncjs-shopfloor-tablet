const ToolpathDisplayer = (function () {

    function _ToolpathDisplayer(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext("2d");
        this.toolX = null;
        this.toolY = null;
        this.toolSave = null;
        this.toolRadius = 6;
        this.toolRectWH = this.toolRadius*2 + 4;  // Slop to encompass the entire image area
        this.offset = null;

        var that = this;

        this.initialMoves = true;
        this.displayHandlers = {
            addLine: function(modal, start, end) {
                var motion = modal.motion;
                if (motion == 'G0') {
                    that.context.strokeStyle = that.initialMoves ? 'red' : 'green';
                } else {
                    that.context.strokeStyle = 'blue';
                    // Don't cancel initialMoves on no-motion G1 (e.g. G1 F30)
                    // or on Z-only moves
                    if (start.x != end.x || start.y != end.y) {
                        that.initialMoves = false;
                    }
                }
    
                that.context.beginPath();
                that.context.moveTo(start.x, start.y);
                that.context.lineTo(end.x, end.y);
                that.context.stroke();
            },
            addArcCurve: function(modal, start, end, center) {
                var motion = modal.motion;
    
                var deltaX1 = start.x - center.x;
                var deltaY1 = start.y - center.y;
                var radius = Math.hypot(deltaX1, deltaY1);
                var deltaX2 = end.x - center.x;
                var deltaY2 = end.y - center.y;
                var theta1 = Math.atan2(deltaY1, deltaX1);
                var theta2 = Math.atan2(deltaY2, deltaX2);
                if (theta1 == theta2) {
                    theta2 += Math.PI * ((modal.motion == "G2") ? -2 : 2);
                }
    
                that.initialMoves = false;
    
                that.context.beginPath();
                that.context.strokeStyle = 'blue';
                that.context.arc(center.x, center.y, radius, theta1, theta2, modal.motion == 'G2');
                that.context.stroke();
            },
        };

        this.xOffset = 0;
        this.yOffset = 0;
        this.scaler = 1;

        this.bbox = {
            min: {
                x: Infinity,
                y: Infinity
            },
            max: {
                x: -Infinity,
                y: -Infinity
            }
        };

        this.bboxIsSet = false;
        this.bboxHandlers = {
            addLine: function(modal, start, end) {
            // Update units in case it changed in a previous line
                units = modal.units;
    
                that.bbox.min.x = Math.min(that.bbox.min.x, start.x, end.x);
                that.bbox.min.y = Math.min(that.bbox.min.y, start.y, end.y);
                that.bbox.max.x = Math.max(that.bbox.max.x, start.x, end.x);
                that.bbox.max.y = Math.max(that.bbox.max.y, start.y, end.y);
                that.bboxIsSet = true;
            },
            addArcCurve: function(modal, start, end, center) {
                // To determine the precise bounding box of a circular arc we
            // must account for the possibility that the arc crosses one or
            // more axes.  If so, the bounding box includes the "bulges" of
            // the arc across those axes.
    
            // Update units in case it changed in a previous line
                units = modal.units;
    
                if (modal.motion == 'G2') {  // clockwise
                    var tmp = start;
                    start = end;
                    end = tmp;
                }
    
            // Coordinates relative to the center of the arc
            var sx = start.x - center.x;
            var sy = start.y - center.y;
            var ex = end.x - center.x;
            var ey = end.y - center.y;
    
                var radius = Math.hypot(sx, sy);
    
            // Axis crossings - plus and minus x and y
            var px = false;
            var py = false;
            var mx = false;
            var my = false;
    
            // There are ways to express this decision tree in fewer lines
            // of code by converting to alternate representations like angles,
            // but this way is probably the most computationally efficient.
            // It avoids any use of transcendental functions.  Every path
            // through this decision tree is either 4 or 5 simple comparisons.
            if (ey >= 0) {              // End in upper half plane
            if (ex > 0) {             // End in quadrant 0 - X+ Y+
                if (sy >= 0) {          // Start in upper half plane
                if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                    if (sx <= ex) {     // wraparound
                    px = py = mx = my = true;
                    }
                } else {              // Start in quadrant 1 - X- Y+
                    mx = my = px = true;
                }
                } else {                // Start in lower half plane
                if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                    px = true;
                } else {              // Start in quadrant 2 - X- Y-
                    my = px = true;
                }
                }
            } else {                  // End in quadrant 1 - X- Y+
                if (sy >= 0) {          // Start in upper half plane
                if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                    py = true;
                } else {              // Start in quadrant 1 - X- Y+
                    if (sx <= ex) {     // wraparound
                    px = py = mx = my = true;
                    }
                }
                } else {                // Start in lower half plane
                if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                    px = py = true;
                } else {              // Start in quadrant 2 - X- Y-
                    my = px = py = true;
                }
                }
            }
            } else {                    // ey < 0 - end in lower half plane
            if (ex > 0) {             // End in quadrant 3 - X+ Y+
                if (sy >= 0) {          // Start in upper half plane
                if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                    py = mx = my = true;
                } else {              // Start in quadrant 1 - X- Y+
                    mx = my = true;
                }
                } else {                // Start in lower half plane
                if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                    if (sx >= ex) {      // wraparound
                    px = py = mx = my = true;
                    }
                } else {              // Start in quadrant 2 - X- Y-
                    my = true;
                }
                }
            } else {                  // End in quadrant 2 - X- Y+
                if (sy >= 0) {          // Start in upper half plane
                if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                    py = mx = true;
                } else {              // Start in quadrant 1 - X- Y+
                    mx = true;
                }
                } else {                // Start in lower half plane
                if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                    px = py = mx = true;
                } else {              // Start in quadrant 2 - X- Y-
                    if (sx >= ex) {      // wraparound
                    px = py = mx = my = true;
                    }
                }
                }
            }
            }
            var maxX = px ? center.x + radius : Math.max(start.x, end.x);
            var maxY = py ? center.y + radius : Math.max(start.y, end.y);
            var minX = mx ? center.x - radius : Math.min(start.x, end.x);
            var minY = my ? center.y - radius : Math.min(start.y, end.y);
    
            that.bbox.min.x = Math.min(that.bbox.min.x, minX);
            that.bbox.min.y = Math.min(that.bbox.min.y, minY);
            that.bbox.max.x = Math.max(that.bbox.max.x, maxX);
            that.bbox.max.y = Math.max(that.bbox.max.y, maxY);
            that.bboxIsSet = true;
        }
        };

        this.units= 'G21';
    }

    _ToolpathDisplayer.prototype = {
        _drawTool: function(pos) {
            this.toolX = (this.scaler * pos.x + this.xOffset)-this.toolRadius-2;
            this.toolY = (-this.scaler * pos.y + this.yOffset)-this.toolRadius-2;
            console.log('getImageData', this.toolX, this.toolY, this.toolRectWH, this.toolRectWH);
            this.toolSave = this.context.getImageData(this.toolX, this.toolY, this.toolRectWH, this.toolRectWH);
    
            this.context.beginPath();
            this.context.strokeStyle = 'magenta';
            this.context.fillStyle = 'magenta';
            this.context.arc(pos.x, pos.y, this.toolRadius/this.scaler, 0, Math.PI*2, true);
            this.context.fill();
            this.context.stroke();
        },

        _drawOrigin: function(radius) {
            this.context.beginPath();
            this.context.strokeStyle = 'red';
            this.context.arc(0, 0, radius, 0, Math.PI*2, false);
            this.context.moveTo(-radius*1.5, 0);
            this.context.lineTo(radius*1.5, 0);
            this.context.moveTo(0,-radius*1.5);
            this.context.lineTo(0, radius*1.5);
            this.context.stroke();
        },

        drawTool: function(modal, mpos) {
            if (this.toolSave != null) {
                this.context.putImageData(this.toolSave, this.toolX, this.toolY);
                var factor = modal.units === 'G20' ? 25.4 : 1.0;
                console.log('reDrawTool factor', factor);
                console.log('reDrawTool mpos', mpos);
                var dpos = {
                    x: mpos.x * factor,
                    y: mpos.y * factor,
                    z: mpos.z * factor
                };
                console.log('reDrawTool dpos', dpos);
                this._drawTool(dpos);
            }
        },

        resetBbox: function() {
            this.bbox.min.x = Infinity;
            this.bbox.min.y = Infinity;
            this.bbox.max.x = -Infinity;
            this.bbox.max.y = -Infinity;
            this.bboxIsSet = false;
    
        },

        formatLimit: function(mm) {
            return (units == 'G20') ? (mm/25.4).toFixed(3)+'"' : mm.toFixed(2)+'mm';
        },

        transformCanvas: function() {
            this.toolSave = null;
            if (this.rect == undefined) {
                this.rect = this.canvas.parentNode.getBoundingClientRect();
                this.canvas.width = this.rect.width;
                this.canvas.height = this.rect.height;
            }
    
            // Reset the transform and clear the canvas
            this.context.setTransform(1,0,0,1,0,0);
            this.context.fillStyle = "white";
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
            var imageWidth;
            var imageHeight;
            var inset;
            if (!this.bboxIsSet) {
                imageWidth = this.canvas.width;
                imageHeight = this.canvas.height;
                inset = 0;
                this.scaler = 1;
                this.xOffset = 0;
                this.yOffset = 0;
                return;
            }
    
            var imageWidth = this.bbox.max.x - this.bbox.min.x;
            var imageHeight = this.bbox.max.y - this.bbox.min.y;
            if (imageWidth == 0) {
                imageWidth = 1;
            }
            if (imageHeight == 0) {
                imageHeight = 1;
            }
            var shrink = 0.90;
            inset = 5;
            var scaleX = (this.canvas.width - inset*2) / imageWidth;
            var scaleY = (this.canvas.height - inset*2) / imageHeight;
            var minScale = Math.min(scaleX, scaleY);
    
            this.scaler = minScale * shrink;
            if (this.scaler < 0) {
                this.scaler = -this.scaler;
            }
            xOffset = inset - this.bbox.min.x * this.scaler;
            yOffset = (this.canvas.height-inset) - this.bbox.min.y * (-this.scaler);
    
            // Canvas coordinates of image bounding box top and right
            var imageTop = this.scaler * imageHeight;
            var imageRight = this.scaler * imageWidth;
    
            // Show the X and Y limit coordinates of the GCode program.
            // We do this before scaling because after we invert the Y coordinate,
            // text would be displayed upside-down.
            this.context.fillStyle = "black";
            this.context.font = "14px Ariel";
            this.context.textAlign = "center";
            this.context.textBaseline = "bottom";
            this.context.fillText(this.formatLimit(this.bbox.min.y), imageRight/2, this.canvas.height-inset);
            this.context.textBaseline = "top";
            this.context.fillText(this.formatLimit(this.bbox.max.y), imageRight/2, this.canvas.height-inset - imageTop);
            this.context.textAlign = "left";
            this.context.textBaseline = "center";
            this.context.fillText(this.formatLimit(this.bbox.min.x), inset, this.canvas.height-inset - imageTop/2);
            this.context.textAlign = "right";
            this.context.textBaseline = "center";
            this.context.fillText(this.formatLimit(this.bbox.max.x), inset+imageRight, this.canvas.height-inset - imageTop/2);
            // Transform the path coordinate system so the image fills the canvas
            // with a small inset, and +Y goes upward.
            // The net transform from image space (x,y) to pixel space (x',y') is:
            //   x' =  scaler*x + xOffset
            //   y' = -scaler*y + yOffset
            // We use setTransform() instead of a sequence of scale() and translate() calls
            // because we need to perform the transform manually for getImageData(), which
            // uses pixel coordinates, and there is no standard way to read back the current
            // transform matrix.
    
            this.context.setTransform(this.scaler, 0, 0, -this.scaler, xOffset, yOffset);
    
            this.context.lineWidth = 0.5 / this.scaler;
    
            this._drawOrigin(imageWidth * 0.04);
        },

        drawToolpath: function(gcode, wpos, mpos) {
            inInches = false; // Todo: implement

            var factor = inInches ? 25.4 : 1.0;

            var initialPosition = {
                x: wpos.x * factor,
                y: wpos.y * factor,
                z: wpos.z * factor
            };

            var mposmm = {
                x: mpos.x * factor,
                y: mpos.y * factor,
                z: mpos.z * factor
            };

            this.offset = {
                x: initialPosition.x - mposmm.x,
                y: initialPosition.y - mposmm.y,
                z: initialPosition.z - mposmm.z
            };
            
            console.log('showToolPath initialPosition', initialPosition);

            this.resetBbox();
            this.bboxHandlers.position = initialPosition;

            var gcodeLines = gcode.split('\n');
            new Toolpath(this.bboxHandlers).loadFromLinesSync(gcodeLines);
            this.transformCanvas();
            if (!this.bboxIsSet) {
                return;
            }
            this.initialMoves = true;
            this.displayHandlers.position = initialPosition;
            new Toolpath(this.displayHandlers).loadFromLinesSync(gcodeLines);

            this._drawTool(initialPosition);
        }
    };

    return _ToolpathDisplayer;
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = ToolpathDisplayer;
}