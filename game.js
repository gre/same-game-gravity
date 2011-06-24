/*
 * game.js - Same Game Gravity
 * Copyright (C) 2011 @greweb
 * GPL v3 - https://github.com/gre/same-game-gravity
 */
(function(){
  
  var util = window.util = window.util||{};
  var game = window.samegame = window.samegame||{};
  
  var device_iPhone = (/iphone/gi).test(navigator.userAgent);
  var device_iPad = (/ipad/gi).test(navigator.userAgent);
  var device_android = (/android/gi).test(navigator.userAgent);
  var onMobile = device_android||device_iPad||device_iPhone;
  
  game.GAME_BAR_SIZE = 30; // can be overrided
  
  var i18n = util.i18n = function() {
    var lang;
    
    var dictionaries = {}
    
    var defaultDict = 'en';
    
    var updateDOM = function(ctx) {
      var dict = dictionaries[lang];
      if(!dict) dict = dictionaries['en'];
      if(ctx) {
        for(var key in dict) {
          $('.i18n-'+key, ctx).text(dict[key]);
          $(ctx).filter('.i18n-'+key).text(dict[key]);
        }
      }
      else
        for(var key in dict)
          $('.i18n-'+key).text(dict[key]);
    };
    
    return {
      get: function(key/*, params...*/) {
        var dict = dictionaries[lang];
        if(!dict) dict = dictionaries[defaultDict];
        var value = dict[key];
        if(!value) value = dictionaries[defaultDict][key];
        value += ""; // make it string anyway
        if(arguments.length > 1) {
          for(var i=1; i<arguments.length; ++i)
            value = value.replace(/([^%]|^)(%)([^%]|$)/, "$1"+arguments[i]+"$3");
          value = value.replace("%%", "%");
        }
        return value;
      },
      updateDOM: updateDOM,
      init: function(dics) {
        if(dics) dictionaries = dics;
        lang = util.Locale.get();
        if(!dictionaries[lang]) lang = 'en';
        updateDOM();
      }
    }
  }();
  $(document).bind('localeReady', i18n.init);
  
  var Sound = util.Sound = function(path, nbBuffers) {
  /**
   * Handle Sound
   */
    var self = this;
    self.nb = nbBuffers || 4;
    self.players = [];
    self.current = 0;
    
    if(window.device && window.Media) {
      if(path instanceof Array) path = path[0];
      for(var i=0; i<self.nb; ++i) {
        var media = new Media((device_android ? '/android_asset/' : '')+path);
        self.players.push(media);
      }
    }
    else {
      for(var i=0; i<self.nb; ++i) {
        if(typeof(path)=="string")
          self.players.push($('<audio src="'+path+'" />')[0]);
        else {
          var audio = $('<audio />');
          for(var s=0; s<path.length; ++s)
            audio.append('<source src="'+path[s]+'"></source>');
          self.players.push(audio[0]);
        }
      }
    }
    
    self.play = function() {
      self.players[self.current].play();
      self.current = self.current+1 < self.nb ? self.current+1 : 0;
      return this;
    }
  };
  
  var Ticker = util.Ticker = function(node) {
  /**
   * Manage an asynchrone loop ticker
   * node : (optional) the node having all animations (optimisations)
   */
    this._functions = [];
    this._stopRequested = false;
    
    var self = this;
    
    // thanks to paul irish : http://paulirish.com/2011/requestanimationrender-for-smart-animating/
    var requestAnimFrame = (function(){
      return window.requestAnimationFrame
        || window.webkitRequestAnimationFrame
        || window.mozRequestAnimationFrame
        || window.oRequestAnimationFrame
        || window.msRequestAnimationFrame
        || function(callback, element){ window.setTimeout(callback, 1000 / 60); };
    }());
    
    self._cycle = function() {
      for(var f=0; f<self._functions.length; ++f)
        self._functions[f]();
      if(!self._stopRequested)
        requestAnimFrame(self._cycle, node);
      else
        self._stopRequested = false;
    }
    
    self.start = function() {
      self._cycle(); return this;
    }
    self.stop = function() {
      self._stopRequested = true; return this;
    }
    self.addListener = function(f) {
      self._functions.push(f); return this;
    }
    self.removeListener = function(f) {
      var i = self._functions.indexOf(f); 
      if(i==-1) return;
      self._functions.splice(i,1); return this;
    }
    self.removeListeners = function() {
      self._functions = []; return this;
    }
  }
  
  var Timer = util.Timer = function() {
  /**
   * Timer
   */
    var getTime = function(){ return new Date().getTime(); } // shortcut
    var self = this;
    self._time = 0;
    self.stopAtTimestamp = null;
    self.startAtTimestamp = getTime();
    
    // Return the "now" time used during update
    self.updateTime = function() {
      var now = getTime();
      var toAdd = 0;
      if(self.stopAtTimestamp)
        toAdd = (self.stopAtTimestamp - self.startAtTimestamp);
      else
        toAdd = now - self.startAtTimestamp;
      if(toAdd>0)
        self._time += toAdd;
      return self.startAtTimestamp = now;
    }
    
    self.pause = function() {
      self.stopAtTimestamp = self.updateTime();
      return this;
    }
    self.start = function() {
      self.updateTime();
      self.stopAtTimestamp = null;
      return this;
    }
    
    self.getMillis = function() {
      self.updateTime();
      return self._time;
    }
  }
  
  var TimeProgression = util.TimeProgression = function(duration) {
  /**
   * new TimeProgression(duration) : create and start a new time progression with a duration in arg
   * .getProgression() : return a float between 0 and 1 indicating the current time progression. 1 means finished.
   */
    this.duration = duration;
    this.start = new Date().getTime();
    this.end = this.start + this.duration;
    this.getRemainingTime = function() {
      var now = new Date().getTime();
      return this.end>now ? this.end-now : 0;
    }
    this.getProgression = function() {
      var now = new Date().getTime();
      return this.duration<=0 || now>this.end ? 1 : (now-this.start) / this.duration;
    }
    this.isFinished = this.isOver = function() {
      return this.getProgression() == 1;
    }
    this.isNotFinished = function() {
      return this.getProgression() < 1;
    }
  }
  
  
  var Color = game.Color = function(o) {
    /**
     * Converts an RGB color value to HSL. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes r, g, and b are contained in the set [0, 255] and
     * returns h, s, and l in the set [0, 1].
     *
     * @param   Number  r       The red color value
     * @param   Number  g       The green color value
     * @param   Number  b       The blue color value
     * @return  Array           The HSL representation
     */
    function rgbToHsl(r, g, b){
        r /= 255, g /= 255, b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;

        if(max == min){
            h = s = 0; // achromatic
        }else{
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max){
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h, s, l];
    }

    /**
     * Converts an HSL color value to RGB. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes h, s, and l are contained in the set [0, 1] and
     * returns r, g, and b in the set [0, 255].
     *
     * @param   Number  h       The hue
     * @param   Number  s       The saturation
     * @param   Number  l       The lightness
     * @return  Array           The RGB representation
     */
    function hslToRgb(h, s, l){
        var r, g, b;

        if(s == 0){
            r = g = b = l; // achromatic
        }else{
            function hue2rgb(p, q, t){
                if(t < 0) t += 1;
                if(t > 1) t -= 1;
                if(t < 1/6) return p + (q - p) * 6 * t;
                if(t < 1/2) return q;
                if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            }

            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [r * 255, g * 255, b * 255];
    }
    
    function toHex(n) {
       n = parseInt(n,10);
       if (isNaN(n)) return "00";
       n = Math.max(0,Math.min(n,255));
       return "0123456789ABCDEF".charAt((n-n%16)/16)
            + "0123456789ABCDEF".charAt(n%16);
    }
    function rgbToHex(R,G,B) {
      return '#'+toHex(R)+toHex(G)+toHex(B);
    }
    function hex2rgb(str){
      var hex = parseInt(str.substring(1), 16);
      var r = (hex & 0xff0000) >> 16;
      var g = (hex & 0x00ff00) >> 8;
      var b = hex & 0x0000ff ;
      return [r,g,b];
    }

    this.rgb = typeof(o)=='string' ? hex2rgb(o) : o.rgb;
    
    this.cache = {};
    /**
     * l in [0,1]
     */
    this.getHexWithLightness = function(l) {
      if(this.cache[l]) return this.cache[l];
      var hsl = rgbToHsl.apply(this, this.rgb);
      hsl[2] = l;
      return this.cache[l] = rgbToHex.apply(this, hslToRgb.apply(this, hsl));
    }
  }
  
  game.Colors = function() {
    var clrs = [ new Color('#D34040'), new Color('#82D340'), new Color('#40C2D3'), new Color('#8B40D3'), new Color('#D3C840') ];
    return {
      get: function(nb) {
        return clrs
        .sort(function(){ return Math.random() - 0.5; })
        .slice(0, nb);
      }
    }
  }();
  
  game.Grid = function() {
  /**
   * Manage a game grid
   */
    this.size = null; // game grid size (record when grid generate)
    this.columns = []; // Contains the grid
    
    this.gravity = null;
    
    var self = this;
    
    // Utils
    self.exists = function(x,y) {
      var column = self.columns[x];
      if(column==null) return false;
      var value = column[y];
      if(value==null) return false;
      return true;
    };
    self.checkValue = function(x,y,num) {
      return self.exists(x,y) && self.columns[x][y] == num;
    };
    
    self.countBlocks = function() {
      var nb = 0;
      for(var i=0; i<self.columns.length; ++i) {
        var column = self.columns[i];
        for(var j=0; j<column.length; ++j)
          if(column[j]!=null)
            nb ++;
      }
      return nb;
    }
    
    self.totalBlocks = function() {
      return self.size.x * self.size.y;
    }
    
    /**
     * Remove null values in an array
     * @arg array : the array to clean
     * @return : a cleaned array
     */
    var arrayClean = function(array) {
      var clean = [];
      for(var i in array)
        if(array[i]!=null)
          clean.push(array[i]);
      return clean;
    };
      
    // Public functions
    /**
     * Generate the grid with random colors
     * @arg width : x size of the grid
     * @arg height : y size of the grid
     * @arg nbColors : nb of color (random between 0 and nbColors-1)
     */
    self.generate = function(width, height, nbColors) {
      self.size = {x:width, y:height};
      self.columns = [];
      for(var x=0; x<self.size.x; ++x) {
        self.columns[x] = [];
        var column = self.columns[x];
        for(var y=0; y<self.size.y; ++y)
          column[y] = Math.floor(nbColors*Math.random());
      }
      return self.columns;
    }
    
    self.noMoreDestroyableForCurrentGravity = function() {
      for(var x in self.columns)
        for(var y in self.columns[x])
          if(self.isDestroyable(x, y))
            return false;
      return true;
    }
    
    // return true if there are no 2 same colors in the game grid
    self.noMoreSameColors = function() {
      var colorsCount = [];
      for(var c=0; c<10; ++c) colorsCount[c] = 0;
      for(var x=0; x<self.columns.length; ++x) {
        for(var y=0; y<self.columns[x].length; ++y) {
          var val = self.columns[x][y];
          if(val!=null) ++colorsCount[val];
          if(colorsCount[val]>1) return false;
        }
      }
      return true;
    }
    
    /**
     * Check if the game is probably finished (don't detect all game end)
     */
    self.noMoreDestroyable = function() {
      
      // Compare same not null positions
      var comparMotif = function(arr1, arr2) {
        for(var i=0; i<arr1.length || i<arr2.length; ++i) {
          if( (arr1[i] != null) != (arr2[i] != null) )
            return false;
        }
        return true;
      }
      // return true if an array has gap between blocks (means null or empty arr)
      var hasGap = function(arr) {
        var first = -1;
        var shouldNotFindAnotherBlock = false;
        for(var i=0; i<arr.length; ++i) {
          if(arr[i] != null && (!(arr[i] instanceof Array) || arr[i].length>0)) {
            if(shouldNotFindAnotherBlock) return true;
            if(first == -1)
              first = i;
          }
          else {
            if(first!=-1)
              shouldNotFindAnotherBlock = true;
          }
        }
        return false;
      }
      
      // if we don't have 2 same colors, game is finished
      if(self.noMoreSameColors()) return true;
      
      // If there are gap between blocks, we consider game not finished
      if(hasGap(self.columns)) return false;
      for(var x=0; x<self.columns.length; ++x)
        if(self.columns[x].length>0 && hasGap(self.columns[x])) return false;
      
      // If blocks don't form a rectangle, game is probably resolvable
      var arr = null;
      for(var x=0; x<self.columns.length; ++x) {
        var col = self.columns[x];
        if(col.length) {
          if(!arr) arr = col; // record first not empty column
          else if(!comparMotif(arr, col)) return false; // motif different from last not empty col : it's not a rectangle
        }
      }
      
      // Game is finished if there are no more destroyable blocks for the current gravity
      return self.noMoreDestroyableForCurrentGravity();
    }
    
    /**
     * Check if a brick is destroyable
     * @arg x y : position
     * @return [boolean]
     */
    self.isDestroyable = function(x,y) {
      var num = self.columns[x][y];
      return self.exists(x,y) && (self.checkValue(x,y-1,num) || self.checkValue(x,y+1,num) || self.checkValue(x+1,y,num) || self.checkValue(x-1,y,num));
    }
    
    /**
     * Compute the gravity
     * @return a computed gravity object for animation
     */
    self.computeGravity = function(gravity) {
      var axis = gravity.replace('-', '');
      var reverseGravity = gravity[0] == '-';
      
      var moveMap = []; // array of { y:[int], dy:[int] } | array of { x:[int], dx:[int] }
      
      if(axis=='x') {
        for(var y=0; y<self.size.y; ++y) {
          moveMap[y] = [];
        }
        for(var y=0; y<self.size.y; ++y) {
          var wsCount=0; // white space count
          for(var x = reverseGravity ? self.size.x-1 : 0; 
              reverseGravity && x>=0 || !reverseGravity && x<self.size.x; 
              x = reverseGravity ? x-1 : x+1) {
            if(!self.exists(x,y))
              ++wsCount;
            else if(wsCount)
              moveMap[y].push({x:x, dx: reverseGravity ? -wsCount : wsCount});
          }
        }
      }
      else {
        for(var x=0; x<self.columns.length; ++x) {
          moveMap[x] = [];
        }
        for(var x=0; x<self.columns.length; ++x) {
          var wsCount=0; // white space count
          for(var y= reverseGravity ? self.size.y-1 : 0; 
              reverseGravity && y>=0 || !reverseGravity && y<self.size.y;
              y = reverseGravity ? y-1 : y+1) {
            if(!self.exists(x,y))
              ++wsCount;
            else if(wsCount)
              moveMap[x].push({y:y, dy: reverseGravity ? -wsCount : wsCount});
          }
        }
      }
      return moveMap;
    }
    
    /**
     * Compute brick destroy propagation
     * @return : list of points concerned by the propagation ( array of position {x, y} )
     */
    self.computeDestroy = function(x,y) {
      if(!self.exists(x,y) || !self.isDestroyable(x,y))
          return [];
      
      var computed = [];
      var recCompute = function(x, y, numFilter) {
        if(!self.exists(x,y) || self.columns[x][y]!==numFilter)
          return; // Brick not found or not the same color
        
        for(var i=0; i<computed.length; ++i)
          if(computed[i].x===x && computed[i].y===y)
            return; // already in computed list
        
        computed.push({x:x, y:y});
        recCompute(x,y-1,numFilter);
        recCompute(x,y+1,numFilter);
        recCompute(x-1,y,numFilter);
        recCompute(x+1,y,numFilter);
      };
      
      recCompute(x,y, self.columns[x][y]);
      return computed;
    }
    
    /**
     * Apply a destroy to the grid
     * destroy : list of points ( array of position {x, y} )
     */
    self.applyDestroy = function(destroy) {
      for(var d in destroy)
        self.columns[destroy[d].x][destroy[d].y] = null;
    }
    
    /**
     * update the grid with a gravity vertical clean
     */
    self.applyGravity = function(gravity) {
      var axis = gravity.replace('-', '');
      var reverseGravity = gravity[0] == '-';
      
      if(axis=='y') {
        for(var x=0; x<self.columns.length; x++)
          self.columns[x] = arrayClean(self.columns[x]);
        if(reverseGravity) {
          for(var x=0; x<self.columns.length; x++) {
            var beforeCols = [];
            beforeCols[self.size.y-self.columns[x].length-1] = undefined;
            self.columns[x] = beforeCols.concat(self.columns[x]);
          }
        }
      }
      else {
        var newColumns = [];
        for(var x=0; x<self.size.x; x++)
          newColumns[x] = [];
        for(var y=0; y<self.size.y; y++) {
          var line = [];
          for(var x=0; x<self.columns.length; x++)
            line.push(self.columns[x][y]);
          line = arrayClean(line);
          if(reverseGravity) {
            var beforeCols = [];
            beforeCols[self.size.x-line.length-1] = undefined;
            line = beforeCols.concat(line);
          }
          for(var x=0; x<line.length; x++) {
            newColumns[x][y] = line[x];
          }
        }
        self.columns = newColumns;
      }
      this.gravity = gravity;
    }
    
    /**
     * get the grid
     * @return : columns (array of array of brick)
     */
    self.getColumns = function() {
      return self.columns;
    }
    
    /**
     * get a column by id
     * @arg i : column abscissa x
     * @return : column (array of brick)
     */
    self.getColumn = function(i) {
      return self.columns[i] || [];
    }
    
    self.getLine = function(i) {
      var line = [];
      for(var c=0; c<self.columns.length; ++c)
        line[c] = self.columns[c][i];
      return line;
    }
    
    /**
     * get brick value by his position
     * @arg x y : brick position
     * @return : brick value
     */
    self.getValue = function(x,y) {
      return self.columns[x]!=null ? self.columns[x][y] : null;
    }
    
    
    var cloneArr = function(arr) {
      var clone = [];
      for(var i=0; i<arr.length; ++i) {
        var it = arr[i];
        clone[i] = it instanceof Array ? cloneArr(it) : it;
      }
      return clone;
    }
    
    self.clone = function() {
      var cpy = new game.Grid();
      cpy.size = {x: self.size.x, y: self.size.y};
      cpy.columns = cloneArr(self.columns);
      cpy.gravity = self.gravity;
      return cpy;
    }
    
    self.toObject = function() {
      var clone = self.clone();
      return $.extend({
        size: clone.size,
        nbColors: clone.nbColors,
        columns: clone.columns
      }, self.params);
    }
    
    if(arguments[2]) {
      this.width = arguments[0] || 5;
      this.height = arguments[1] || 10;
      this.nbColors = arguments[2] || 4;
      if(arguments[3])
        this.columns = arguments[3];
      else
        self.generate(this.width, this.height, this.nbColors);
    }
    else if(arguments[0] instanceof game.Grid) {
      var g = arguments[0].clone();
      self.size = g.size;
      self.columns = g.columns;
      self.gravity = g.gravity;
      self.nbColors = g.nbColors;
    }
    else if(arguments[0] && arguments[0].size) {
      var g = arguments[0];
      self.size = g.size;
      self.columns = g.columns;
      self.nbColors = g.nbColors;
    }
    
  };
  
  game.GameCanvasRenderer = function(o) {
    var self = this;
  /**
   * Manage the game graphic with canvas
   */
    self.container = $(o.container);
    self.colors = o.colors;
    self.canvas = self.container.find('canvas.main')[0];
    self.ctx = self.canvas.getContext('2d');
    
    self.gridSize = o.gridSize;
    self.canvasSize = {w:0, h:0};
    self.brickSize = {w:0, h:0};
    
    self.offsetCanvas = { top: 0, left: 0 };
    
    self.brickPosition2canvasPosition = function(x, y) {
      return { x: x*self.brickSize.w, y: (self.gridSize.h-y-1)*self.brickSize.h };
    };
    self.getBrickPositionWithAbsolute = function(x, y) {
      y -= game.GAME_BAR_SIZE;
      x -= self.offsetCanvas.left;
      y -= self.offsetCanvas.top;
      var p = { x: Math.floor( x / self.brickSize.w ), y: Math.floor( self.gridSize.h - y / self.brickSize.h ) };
      if(util.Orientation.toRealPosition) p = util.Orientation.toRealPosition(p, self.gridSize.w, self.gridSize.h, 1, 1);
      return p;
    };
    self.updateBrickSize = function() {
      self.brickSize = {w: (self.canvasSize.w/self.gridSize.w), h: (self.canvasSize.h/self.gridSize.h)};
    };
    
    self.createDestroyNumber = function(nb, x, y, clr) {
      var pos = { x: x , y: y };
      if(util.Orientation.fromRealPosition) pos = util.Orientation.fromRealPosition(pos, self.gridSize.w, self.gridSize.h, 1, 1);
      pos = self.brickPosition2canvasPosition(pos.x, pos.y);
      
      var node = $('<span> />').text(nb).addClass('destroyNumber');
      node.css({
        width: self.brickSize.w,
        height: self.brickSize.h,
        position: 'absolute',
        top: Math.floor( pos.y )+'px',
        left: Math.floor( pos.x )+'px',
        color: self.colors[clr].getHexWithLightness(0.8)
      });
      node.appendTo($('#gameContainer'));
      setTimeout(function(){ node.addClass('startTransition'); }, 50);
      setTimeout(function(){ node.remove(); }, 2100);
    }
    
    /// DRAW functions
    
    self.clearBricks = function(bricks) {
      if(!bricks) return;
      for(var b=0; b<bricks.length; ++b) {
        self.clearBrick(bricks[b]);
      }
    };
    self.clearBrick = function(brick) {
      var bp = self.brickPosition2canvasPosition(brick.x, brick.y);
      self.ctx.clearRect(bp.x,bp.y,self.brickSize.w,self.brickSize.h);
    };
    
    self.drawColumn = function(column, x, dontClear) {
      var bp = self.brickPosition2canvasPosition(x, 0);
      if(!dontClear) self.ctx.clearRect(bp.x,0,self.brickSize.w,self.canvas.height);
      for(var y=0; y<column.length; ++y)
        if(column[y]!=null)
          self.drawBrick({ x:x, y:y, color: column[y] }, true);
    };
    
    self.drawLine = function(line, y, dontClear) {
      var bp = self.brickPosition2canvasPosition(0, y);
      if(!dontClear) self.ctx.clearRect(0,bp.y,self.canvas.width,self.brickSize.h);
      for(var x=0; x<line.length; ++x)
        if(line[x]!=null)
          self.drawBrick({ x:x, y:y, color: line[x] }, true);
    };
    
    self.drawMap = function(columns) {
      self.ctx.clearRect(0,0,self.canvas.width,self.canvas.height);
      for(var x=0; x<self.gridSize.w; ++x)
        self.drawColumn(columns[x], x, true);
    };
    
    self.drawBricks = function(arr, dontClear, size) {
      if(!arr) return;
      for(var a=0; a<arr.length; ++a)
        self.drawBrick(arr[a], dontClear, size);
    }
    
    self.drawBrick = function(brick, dontClear, size) {
      if(!size) size = 1;
      self.ctx.save();
      var bp = self.brickPosition2canvasPosition(brick.x, brick.y);
      self.ctx.translate(bp.x, bp.y);
      self.ctx.scale(self.brickSize.w,self.brickSize.h);
      
      var gradient = self.ctx.createLinearGradient(0,0,0,1);
      gradient.addColorStop(0, self.colors[brick.color].getHexWithLightness(0.85));
      gradient.addColorStop(0.6, self.colors[brick.color].getHexWithLightness(0.5));
      self.ctx.fillStyle = gradient;
      
      if(!dontClear) self.ctx.clearRect(0,0,1,1);
      self.ctx.beginPath();
      self.ctx.arc(.5, .5, .4*size, 0, Math.PI*2, true);
      self.ctx.fill();
      self.ctx.restore();
    };
    
    self.canvasHighlight = self.container.find('canvas.highlight')[0];
    if(self.canvasHighlight) {
      self.ctxHighlight = self.canvasHighlight.getContext('2d');
      self.drawHighlight = function(brick) {
        var ctx = self.ctxHighlight;
        ctx.save();
        var bp = self.brickPosition2canvasPosition(brick.x, brick.y);
        ctx.translate(bp.x, bp.y);
        ctx.scale(self.brickSize.w,self.brickSize.h);
        ctx.beginPath();
        ctx.arc(.5, .5, .46, 0, Math.PI*2, true);
        ctx.fill();
        ctx.restore();
      }
      self.drawDestroyHighlight = function(bricks) {
        self.ctxHighlight.fillStyle = '#fff';
        for(var a=0; a<bricks.length; ++a)
          self.drawHighlight(bricks[a]);
      }
      self.clearDestroyHighlight = function() {
        this.ctxHighlight.clearRect(0,0,self.canvasHighlight.width,self.canvasHighlight.height);
      }
    }
    else {
      self.drawHighlight = self.clearDestroyHighlight = self.drawDestroyHighlight = $.noop;
    }
    
    self.updateGameSize = function(keepSquare) {
      var w = window.innerWidth, h = window.innerHeight-game.GAME_BAR_SIZE;
      if(keepSquare) {
        if(w>h) {
          self.offsetCanvas = { left: Math.floor((w-h)/2), top: 0 };
          $('#gameContainer').css({ left: Math.floor((w-h)/2)+'px', top: 0 });
        }
        else {
          self.offsetCanvas = { top: Math.floor((h-w)/2), left: 0 };
          $('#gameContainer').css({ top: Math.floor((h-w)/2)+'px', left: 0 });
        }
        w = Math.min(w, h);
        h = w;
      }
      self.canvasSize = { w: self.canvas.width = w, h: self.canvas.height = h };
      if(self.canvasHighlight) {
        self.canvasHighlight.width = self.canvasSize.w;
        self.canvasHighlight.height = self.canvasSize.h;
      }
      self.updateBrickSize();
    };
  }
  
  /**
   * Manage the game context
   */
  game.Game = function(o) {
    var self = this;
    self.params = o; // Can be custom params to be used somewhere else
    self.container = $(o.container);
    self.gridSize = o.gridSize;
    self.colors = o.colors;
    if(o.colors && !(o.colors[0] instanceof Color)) {
      for(var c=0; c<o.colors.length; ++c)
        o.colors[c] = new Color(o.colors[c]);
    }
    self.view = new game[o.rendererClass||'GameCanvasRenderer']({
      container: self.container,
      colors: self.colors,
      gridSize: self.gridSize
    });
    self.grid = o.grid ? new game.Grid(o.grid) : new game.Grid(self.gridSize.w, self.gridSize.h, self.colors.length);
    self.drawHover = o.drawHover || false;
    self.gravity = 'x';
    self.gravityFallDuration = o.gravityFallDuration || 200;
    self.destroyDuration = o.destroyDuration || 150;
    self.destroyFallDuration = o.destroyFallDuration || 300;
    
    self.allDestroys = o.allDestroys ? o.allDestroys : [];
    
    self.getGrid = function() {
      return self.grid;
    }
    
    self.gameIsFinished = false;
    self.isFinished = function() {
      return self.gameIsFinished;
    }
    
    self.bind = function(event, callback) {
      self.container.bind.apply(self.container, arguments);
    }
    self.trigger = function(event, o) {
      self.container.trigger.apply(self.container, arguments);
    }
    self.unbind = function(event, callback) {
      self.container.unbind(event, callback);
    }
    
    self.toObject = function() {
      return $.extend(self.params, { grid: self.grid.toObject(), allDestroys: self.allDestroys });
    }
    
    self.updateGravity = function(g) {
      self.gravity = g;
    }
    self.lastOrientation = null;
    self.updateOrientation = function(orientation) {
      if(self.lastOrientation===orientation || self.animationIsRunning())
        return false;
      self.updateGravity(orientation==0 ? 'y' : (orientation==-90 ? 'x' : (orientation==90 ? '-x' : '-y')));
      self.lastOrientation = orientation;
      return true;
    };
    
    self.onmousemove = function(e) {
      if(self.animationIsRunning()) return;
       var bhover = self.view.getBrickPositionWithAbsolute(e.pageX, e.pageY);
       if(self.brickHovered==null || self.brickHovered.x!=bhover.x || self.brickHovered.y!=bhover.y) {
         self.brickHovered = bhover;
         self.brickHoverChanged = true;
       }
    }
    
    self.onCanvasClick = function(e) {
      if(self.animationIsRunning()) return;
      self.brickClicked = self.view.getBrickPositionWithAbsolute(e.pageX, e.pageY);
    }
    
    self.onCanvasTouchStart = function(event) {
      if(self.animationIsRunning()) return;
      var e = event.touches[0];
      self.brickClicked = self.view.getBrickPositionWithAbsolute(e.pageX, e.pageY);
    }
    
    self.animationIsRunning = function() {
      return !!self.gravityMove;
    }
    
    self.getAllDestroyed = function() {
      return self.allDestroys;
    }
    
    self.brickHovered = null;
    self.brickHoverChanged = false;
    self.bricksHoverDestroy = null;
    self.brickClicked = null;
    self.gravityMove = null;
    self.gravityMoveProgression = null;
    self.destroyProgression = null;
    self.destroyed = null;
    self.needFullRedraw = false;
    self.windowHasChanged = false;
    self.lastCycleBrickPositions = null;
    
    self.render = function(i) {
      var gravity = self.gravity;
      var gravityHasChanged = gravityHasChanged = self.updateOrientation(util.Orientation.get());
      if(gravityHasChanged) {
        gravity = self.gravity;
        self.gravityMove = self.grid.computeGravity(gravity);
        self.gravityMoveProgression = new TimeProgression(self.gravityFallDuration);
        self.trigger('game-gravityChange', { gravityMove: self.gravityMove });
      }
      var axis = gravity.replace('-', '');
      var reverseGravity = gravity[0]=='-';
      
      if(self.brickClicked) {
        var brick = self.brickClicked;
        if(self.grid.isDestroyable(brick.x, brick.y)) {
          var color = self.grid.getValue(brick.x, brick.y);
          self.destroyed = self.grid.computeDestroy(brick.x, brick.y);
          self.view.clearBricks(self.destroyed);
          self.grid.applyDestroy(self.destroyed);
          for(var i=0; i<self.destroyed.length; ++i) {
            self.destroyed[i].color = color;
          }
          self.trigger('game-blockDestroy', { 
            destroyed: self.destroyed, 
            nb: self.destroyed.length, 
            color: color,
            x: self.brickClicked.x,
            y: self.brickClicked.y
          });
          self.destroyProgression = new TimeProgression(self.destroyDuration);
        }
        self.brickClicked = null;
      }
      
      if(self.destroyed) {
        var progression = self.destroyProgression.getProgression();
        if(progression == 1) {
          self.gravityMove = self.grid.computeGravity(gravity);
          self.gravityMoveProgression = new TimeProgression(self.destroyFallDuration);
          self.view.clearBricks(self.destroyed);
          self.destroyed = null;
        }
        else {
          self.view.drawBricks(self.destroyed, false, 1-progression);
        }
      }
      
      if(self.gravityMove) {
        self.view.clearDestroyHighlight();
        var progression = self.gravityMoveProgression.getProgression();
        var move = self.gravityMove;
        if(progression<1 && !self.gravityMoveProgression.runFirst) progression = 0;
        self.gravityMoveProgression.runFirst = true;
        if(progression==1) {
          self.grid.applyGravity(gravity);
          
          if(axis=='y') {
            for(var x=0; x<move.length; ++x)
              if(move[x].length)
                self.view.drawColumn(self.grid.getColumn(x), x);
          }
          else {
            for(var y=0; y<move.length; ++y)
              if(move[y].length)
                self.view.drawLine(self.grid.getLine(y), y);
          }
          self.trigger('game-change');
          self.gravityMove = null;
          self.lastCycleBrickPositions = null;
        }
        else {
          var newBricks = [];
          if(axis=='y') {
            for(var x=0; x<move.length; ++x) {
              var col = move[x];
              for(var c=0; c<col.length; ++c) {
                var displacement = col[c];
                var color = self.grid.getValue(x,displacement.y);
                if(color!=null) {
                  var y = displacement.y - displacement.dy*progression;
                  newBricks.push({ x: x, y: y, color: color });
                }
              }
            }
          }
          else {
            for(var y=0; y<move.length; ++y) {
              var line = move[y];
              for(var l=0; l<line.length; ++l) {
                var displacement = line[l];
                var color = self.grid.getValue(displacement.x, y);
                if(color!=null) {
                  var x = displacement.x - displacement.dx*progression;
                  newBricks.push({x: x, y: y, color: color });
                }
              }
            }
          }
          self.view.clearBricks(self.lastCycleBrickPositions);
          self.view.drawBricks(newBricks, true);
          self.lastCycleBrickPositions = newBricks;
        }
      }
      
      if(self.brickHoverChanged && self.brickHovered && !self.gravityMove) {
        self.view.clearDestroyHighlight();
        self.bricksHoverDestroy = self.grid.computeDestroy(self.brickHovered.x, self.brickHovered.y);
        self.view.drawDestroyHighlight(self.bricksHoverDestroy);
      }
      
      if(self.windowHasChanged) {
        self.view.updateGameSize(self.params.keepSquare);
        self.windowHasChanged = false;
        self.needFullRedraw = true;
      }
      if(self.needFullRedraw) {
        self.view.drawMap(self.grid.getColumns());
        self.needFullRedraw = false;
      }
    }
    
    self.unbindAll = function() {
      self.unbind();
      window.ontouchstart = null;
    }
    
    self.bindAll = function() {
      if(onMobile)
        window.ontouchstart = self.onCanvasTouchStart;
      else
        self.bind('click', self.onCanvasClick);
      self.bind('game-change', function() {
        if(self.grid.noMoreDestroyable()) {
          self.gameIsFinished = true;
          self.trigger('game-finish');
        }
      });
      if(self.drawHover) {
        self.bind('mousemove', self.onmousemove);
      }
      self.bind('game-blockDestroy', function(e, data) {
        self.allDestroys.push(data);
        if(data.nb > 5) {
          if(!device_android) // lag too much on android ...
            self.view.createDestroyNumber(data.nb, data.x, data.y, data.color);
        }
      });
      var onResize = function() { self.windowHasChanged = true; }
      window.addEventListener('resize', onResize, false);
      onResize();
    }
  }
  var GameStorage = game.Storage = function() {
    var storageKey = 'samegame';
    var difficultiesStorageKey = ['samegame_easy', 'samegame_normal', 'samegame_hard'];
    var totalScoreKey = 'samegame_totalscore';
    var gameLaunchedKey = 'samegame_launched';
    
    var gameNeverLaunched = !localStorage.getItem(gameLaunchedKey);
    localStorage.setItem(gameLaunchedKey, 'true');
    
    // Game storage
    var retrieveGame = function() {
      var o = JSON.parse(localStorage.getItem(storageKey));
      o.globalTimer = new Timer().pause();
      return new game.Game(o);
    }
    var saveGame = function(game) {
      localStorage.setItem(storageKey, JSON.stringify(game.toObject()));
    }
    var cleanGameSave = function() {
      localStorage.removeItem(storageKey);
    }
    var hasGameSaved = function() {
      return !!localStorage.getItem(storageKey);
    }
    
    // Score storage
    var getDifficultyScore = function(difficulty) {
      return localStorage.getItem(difficultiesStorageKey[difficulty]);
    }
    var setDifficultyScore = function(difficulty, score) {
      var current = getDifficultyScore(difficulty) || 0;
      if(parseInt(score) > current) {
        localStorage.setItem(difficultiesStorageKey[difficulty], score);
        return true;
      }
      return false;
    }
    var getTotalScore = function() {
      return parseInt(localStorage.getItem(totalScoreKey) || 0);
    }
    var setTotalScore = function(score) {
      localStorage.setItem(totalScoreKey, score);
    }
    var addToTotalScore = function(score) {
      setTotalScore(getTotalScore() + score);
    }
    var cleanDifficultyScores = function() {
      for(var i = 0; i<difficultiesStorageKey.length; ++i)
        localStorage.removeItem(difficultiesStorageKey[i]);
    }
    
    return {
      retrieveGame: retrieveGame,
      saveGame: saveGame,
      cleanGameSave: cleanGameSave,
      hasGameSaved: hasGameSaved,
      getDifficultyScore: getDifficultyScore,
      setDifficultyScore: setDifficultyScore,
      getTotalScore: getTotalScore,
      setTotalScore: setTotalScore,
      addToTotalScore: addToTotalScore,
      gameNeverLaunched: function(){
        return gameNeverLaunched;
      },
      cleanDifficultyScores: cleanDifficultyScores,
      resetScores: function(){
        cleanDifficultyScores();
        setTotalScore(0);
      }
    }
  }();
  
  var LevelProgressBar = game.LevelProgressBar = function(totalScore) {
    var self = this;
    if(!totalScore) totalScore = game.Storage.getTotalScore();
    var levelToScore = function(s){
      return Math.floor(850*s + 150*s*s);
    };
    var i;
    for(i=0; totalScore >= levelToScore(i); ++i) {}
    var lvlToScoreImin1 = levelToScore(i-1);
    var lvlToScoreI = levelToScore(i);
    self.progress = {
      level: i-1, // level number
      progress: (totalScore - lvlToScoreImin1)/(lvlToScoreI - lvlToScoreImin1) // from 0 to 1
    };
    
    self.get = function() {
      return self.progress;
    }
  };
  
  game.RemainingSecondsBar = function() {
    var gameStatus, remainingSecondsTimeDom, timelineDom;
    var lastSec = -1;
    var isWarning = false;
    var interval = null;
    var reset = function() {
        timeline.removeClass('count-20s').addClass('reset');
        setTimeout(function(){
          timeline.removeClass('reset').addClass('count-20s');
        }, 222);
    }
    var updateRemainingSeconds = function(gameEndProgression, maxTimeout) {
      var remaining = gameEndProgression.getRemainingTime();
      var sec = !gameEndProgression ? 0 : Math.floor(remaining/1000+1);
      if( sec==0 || sec > lastSec) {
        reset();
      }
      if(sec != lastSec) {
        lastSec = sec;
        remainingSecondsTimeDom.innerHTML = sec;
      }
      if(sec<6) {
        if(!isWarning) {
          gameStatus.className = 'gameStatus warning';
          isWarning = true;
        }
      }
      else {
        if(isWarning) {
          gameStatus.className = 'gameStatus';
          isWarning = false;
        }
      }
    }
    return {
      init: function(){
        gameStatus = $('.gameStatus')[0];
        remainingSecondsTimeDom = $('.gameStatus .remainingSecondsTime')[0];
        timeline = $('.gameStatus .timeline');
      },
      updateRemainingSeconds: updateRemainingSeconds,
      reset: reset
    }
  }();
  $(document).ready(game.RemainingSecondsBar.init);
  
  var ShareText = game.ShareText = function(o) {
    var self = this;
    var twittNode = $('#twitterTmpl').tmpl(o);
    i18n.updateDOM(twittNode);
    var shareText = $.trim(twittNode.text()).replace(/\s+/g, ' ');
    var sum = 103*o.level + o.totalscore + 57*parseInt(o.easy) + 23*parseInt(o.normal) + 7*parseInt(o.hard);
    shareText += " $"+hex_md5("e\x6E\x6D\x34\x6B\x6F\x6D\x61\x6E\x31\x67\x6F\x77\x69\x68\x6F\x6B\x6E\x32\x62\x75\x62\x6F"+String.fromCharCode(118)+'_'+sum).substring(0,5);
    self._t = shareText;
    self.toString = function() {
      return self._t;
    }
  }
  
  /*
  // Some futures ideas - v2
  game.Shape = function() { }
  game.ShapeManager = function() {} // relative to the game
  game.Progress = function() {} // a progress inited by params and some compute functions
  game.ProgressList = function() {} // collection of Progress
  game.ProgressManager = function() {} // relative to the game
  */
  
}());

