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

        this.initialMoves = false;

        this.xOffset = 0;
        this.yOffset = 0;
        this.scaler = 1;

        this.units= 'G21';
    }

    _ToolpathDisplayer.prototype = {
        _drawTool: function(pos) {
            this.toolX = xToPixel(pos.x)-this.toolRadius-2;
            this.toolY = yToPixel(pos.y)-this.toolRadius-2;
            this.toolSave = this.context.getImageData(this.toolX, this.toolY, this.toolRectWH, this.toolRectWH);
    
            console.log(toolX, pos.x);
            this.context.beginPath();
            this.context.strokeStyle = 'magenta';
            this.context.fillStyle = 'magenta';
            this.context.arc(pos.x, pos.y, toolRadius/scaler, 0, Math.PI*2, true);
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

        drawTool: function() {
            if (toolSave != null) {
                this.context.putImageData(toolSave, toolX, toolY);
                var factor = modal.units === 'G20' ? 25.4 : 1.0;
                console.log('reDrawTool factor', factor);
                console.log('reDrawTool mpos', mpos);
                console.log('reDrawTool offset', offset);
                var dpos = {
                    x: mpos.x * factor,// + offset.x,
                    y: mpos.y * factor,// + offset.y,
                    z: mpos.z * factor// + offset.z
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
                this.rect = canvas.parentNode.getBoundingClientRect();
                this.canvas.width = rect.width;
                this.canvas.height = rect.height;
            }
    
            // Reset the transform and clear the canvas
            this.context.setTransform(1,0,0,1,0,0);
            this.context.fillStyle = "white";
            this.context.fillRect(0, 0, canvas.width, canvas.height);
    
            var imageWidth;
            var imageHeight;
            var inset;
            if (!bboxIsSet) {
                imageWidth = canvas.width;
                imageHeight = canvas.height;
                inset = 0;
                this.scaler = 1;
                this.xOffset = 0;
                this.yOffset = 0;
                return;
            }
    
            var imageWidth = bbox.max.x - bbox.min.x;
            var imageHeight = bbox.max.y - bbox.min.y;
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
            yOffset = (canvas.height-inset) - this.bbox.min.y * (-this.scaler);
    
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
            this.context.fillText(this.formatLimit(bbox.min.y), imageRight/2, canvas.height-inset);
            this.context.textBaseline = "top";
            this.context.fillText(this.formatLimit(bbox.max.y), imageRight/2, canvas.height-inset - imageTop);
            this.context.textAlign = "left";
            this.context.textBaseline = "center";
            this.context.fillText(this.formatLimit(bbox.min.x), inset, canvas.height-inset - imageTop/2);
            this.context.textAlign = "right";
            this.context.textBaseline = "center";
            this.context.fillText(this.formatLimit(bbox.max.x), inset+imageRight, canvas.height-inset - imageTop/2);
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
    
            drawOrigin(imageWidth * 0.04);
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
            bboxHandlers.position = initialPosition;

            var gcodeLines = gcode.split('\n');
            new Toolpath(bboxHandlers).loadFromLinesSync(gcodeLines);
            this.transformCanvas();
            if (!bboxIsSet) {
                return;
            }
            initialMoves = true;
            displayHandlers.position = initialPosition;
            new Toolpath(displayHandlers).loadFromLinesSync(gcodeLines);

            this._drawTool(initialPosition);
        }
    };

    return _ToolpathDisplayer;
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = ToolpathDisplayer;
}