/*
 * Desktop version
 * Copyright (C) 2011 @greweb
 * GPL v3 - https://github.com/gre/same-game-gravity
 */
(function(){
  var util = window.util = window.util||{};
  var game = window.samegame = window.samegame||{};
  
  var Ticker = util.Ticker;
  var Timer = util.Timer;
  var TimeProgression = util.TimeProgression;
  var Color = game.Color;
  var Colors = game.Colors;
  var Sound = util.Sound;
  var i18n = util.i18n;
  var ShareText = game.ShareText;
  var LevelProgressBar = game.LevelProgressBar;
  var GameStorage = game.Storage;
  
  $(document).ready(function(){
    setTimeout(function(){ // Wait before enabling transition to not do transition for the first load
      $('#main').addClass('enabletransition');
    }, 500);
    $('a[href^=http]').click(function(e){
      e.preventDefault();
      window.open($(this).attr('href'));
    })
  });
  
  var Orientation = util.Orientation = function() {
    var orientationDelayed = 0;
    var orientation = 0;
    var cssOrientation = 0;
    var delay = null;
    
    var rotateNodes;
    
    var setCssOrientation = function(o) {
      cssOrientation = o;
      rotateNodes.css('transform', 'rotate('+o+'deg)');
    }
    var setOrientation = function(o) {
      orientation = o;
      if(delay) clearTimeout(delay);
      delay = setTimeout(function(){
        delay = null;
        orientationDelayed = o;
      }, 500);
    }
    /* convert any %90 orientation to a valid orientation (-90, 0, 90, 180) */
    var normalizeOrientation = function(o) {
      while(o<0) o += 360;
      return (o+90)%360 - 90;
    }
    var addOrientation = function(add) {
      setCssOrientation(cssOrientation+add);
      setOrientation( normalizeOrientation(orientation + add) );
    }
    
    var LEFT_ARROW = 37, UP_ARROW = 38, RIGHT_ARROW = 39, DOWN_ARROW = 40;
    
    window.onkeydown = function(e){
      switch (e.keyCode) {
        case LEFT_ARROW: e.preventDefault(); addOrientation(-90); break;
        case RIGHT_ARROW: e.preventDefault(); addOrientation(90);  break;
        case UP_ARROW: case DOWN_ARROW:  e.preventDefault(); break; // prevent scrolling
        default: return true;
      }
      return false;
    };
    
    return {
      init: function() {
        rotateNodes = $('#gameContainer').find('canvas');
      },
      resetOrientation: function() {
        setOrientation(0);
      },
      turnRight: function() {
        addOrientation(90);
      },
      turnLeft: function() {
        addOrientation(-90);
      },
      fromRealPosition: function(p, maxX, maxY, translateX, translateY) {
        if(!translateX) translateX=0;
        if(!translateY) translateY=0;
        var o = orientationDelayed;
        if(o==90) return {x: p.y, y: maxX-p.x-translateX };
        if(o==-90) return {x: maxY-p.y-translateY, y: p.x };
        if(o==180) return {x: maxX-p.x-translateX, y: maxY-p.y-translateY };
        return p;
      },
      toRealPosition: function(p, maxX, maxY, translateX, translateY) {
        if(!translateX) translateX=0;
        if(!translateY) translateY=0;
        var o = orientationDelayed;
        if(o==-90) return {x: p.y, y: maxX-p.x-translateX };
        if(o==90) return {x: maxY-p.y-translateY, y: p.x };
        if(o==180) return {x: maxX-p.x-translateX, y: maxY-p.y-translateY };
        return p;
      },
      get: function(){
        return orientationDelayed;
      }
    }
  }();
  $(document).ready(Orientation.init);
  
  $(document).ready(function(){
    $('#game .turnleft').click(function(e){
      e.preventDefault();
      e.stopPropagation();
      Orientation.turnLeft();
    });
    $('#game .turnright').click(function(e){
      e.preventDefault();
      e.stopPropagation();
      Orientation.turnRight();
    });
  });
  
  var Locale = util.Locale = {
    get: function(){ return navigator.userLanguage ? navigator.userLanguage.substring(0,2) : navigator.language.substring(0,2) }
  };
  
  game.Intent = {
    share: function(text) {
      var url = "http://twitter.com/intent/tweet?text="+escape(text);
      window.open(url);
    }
  };
  
  var currentGame = null;
  /// The game controller
  var sg = game.SameGame = (function() {
    var colors;
    // game constants
    var gridSizeByDifficulty = [
    {w:8, h:8},
    {w:12, h: 12},
    {w: 16, h: 16}
    ];
    var colorNumberByDifficulty = [3, 4, 5];
    var gameTimeoutByDifficulty = [2e4, 2e4, 2e4];
    var difficulties = ["easy", "normal", "hard"];
    
    var gameNeverLaunched = GameStorage.gameNeverLaunched();
    
    var audioPop, audioSwosh;
    
    // Some Controller utils functions
    var scene = function(name) {
      var section = $('#'+name);
      section.nextAll().addClass('after')
      section.removeClass('after');
      section.prevAll().removeClass('after');
      section.addClass('current').siblings().removeClass('current');
    }
    var _functions = [];
    var onRouteChange = function(call) {
      _functions.push(call);
    }
    var callRouteChangeFunctions = function() {
      for(var i=0; i<_functions.length; ++i)
        _functions[i]();
      _functions = [];
    }
    var redirect = function(path) {
      sg.route(path);
    }
    
    var retrieveGame = function() {
      if(currentGame!==null && !currentGame.isFinished()) return currentGame;
      return GameStorage.retrieveGame();
    }
    
    var hasGameSaved = function() {
      return currentGame!==null && !currentGame.isFinished() || GameStorage.hasGameSaved();
    }
    
    return {
      init: function() {
        audioPop = new Sound(['pop.mp3', 'pop.ogg'], 2);
        audioSwosh = new Sound(['swosh.mp3', 'swosh.ogg'], 4);
      },
      route: function(path) {
        callRouteChangeFunctions();
        if(path=='/') return this.index();
        if(path=='/menu') return this.menu();
        if(path=='/game/continue') return this.continueGame();
        if(path=='/game/new') return this.newGame();
        if(path=='/game/new/easy') return this.newGame(0);
        if(path=='/game/new/normal') return this.newGame(1);
        if(path=='/game/new/hard') return this.newGame(2);
        if(path=='/highscores') return this.highscores();
        if(path=='/highscores/users') return this.user_scores();
        if(path=='/help') return this.help();
        if(path=='/help/1') return this.help(1);
        if(path=='/help/2') return this.help(2);
        if(path=='/help/3') return this.help(3);
        if(path=='/help/4') return this.help(4);
        return this.index();
      },
      index: function() {
        if(gameNeverLaunched) {
          gameNeverLaunched = false;
          return redirect('/help');
        }
        return this.menu();
      },
      menu: function() {
        var c = $('#menu .continueGame');
        if(hasGameSaved())
          c.show();
        else
          c.hide();
        scene('menu');
      },
      user_scores: function() {
        var node = $('#user_scores');
        window.SCORE && SCORE.fetch();
        scene('user_scores');
      },
      highscores: function() {
        var highscores = $('#highscores');
        var scores = [GameStorage.getDifficultyScore(0), GameStorage.getDifficultyScore(1), GameStorage.getDifficultyScore(2)];
        var easy = scores[0] || 0, normal = scores[1] || 0, hard = scores[2] || 0;
        var totalScore = GameStorage.getTotalScore();
        var levelProgress = new LevelProgressBar(totalScore).get();
        
        var shareText = new ShareText({
          level: levelProgress.level, 
          totalscore: totalScore, 
          easy: easy,
          normal: normal, 
          hard: hard,
          version: "web"
        }).toString();
        
        highscores.find('.totalScore').text(totalScore+'');
        highscores.find('.level').text(levelProgress.level);
        highscores.find('.progress').css('width', (levelProgress.progress*100)+'%');
        highscores.find('.easyScore').text(easy);
        highscores.find('.normalScore').text(normal);
        highscores.find('.hardScore').text(hard);
        highscores.find('.share a').unbind().click(function(e){
          e.preventDefault();
          game.Intent.share(shareText);
        });
        
        highscores.find('.resetHighscores').unbind().bind('click', function(){
          if(confirm(i18n.get("confirm_reset_highscores"))) {
            GameStorage.resetScores();
            sg.highscores();
          }
        });
        scene('highscores');
      },
      help: function(num) {
        if(!num) num = 1;
        scene('help-'+num);
      },
      newGame: function(difficulty) {
        if(!difficulty) difficulty = 0;
        currentGame = new game.Game({
          gridSize: gridSizeByDifficulty[difficulty],
          colors: colors=Colors.get(colorNumberByDifficulty[difficulty]),
          container: '#game',
          rendererClass: 'GameCanvasRenderer',
          difficulty: difficulty,
          drawHover: true,
          globalTimer: new Timer().pause(),
          keepSquare: true
        });
        this.game();
      },
      continueGame: function() {
        if(!hasGameSaved()) return redirect('/');
        try {
          currentGame = retrieveGame();
        } catch(e) {
          GameStorage.cleanGameSave();
          return redirect('/');
        }
        this.game();
      },
      game: function() {
        if(!currentGame) return hasGameSaved() ? redirect('/game/continue') : redirect('/');
        GameStorage.saveGame(currentGame);
        
        var timeout = gameTimeoutByDifficulty[currentGame.params.difficulty];
        var ticker = new Ticker();
        var gameEndProgression = new TimeProgression(timeout);
        var globalTimer = currentGame.params.globalTimer;
        
        var audioEnabled = false;
        setTimeout(function(){ audioEnabled = true; }, 500);
        
        currentGame.bindAll();
        currentGame.bind('game-blockDestroy', function(){
          gameEndProgression = new TimeProgression(timeout);
          if(audioEnabled) audioPop.play();
        });
        currentGame.bind('game-gravityChange', function(e, data){
          var nb = 0;
          for(var i=0; i<data.gravityMove.length; ++i)
            nb += data.gravityMove[i].length;
          if(audioEnabled && nb>0) audioSwosh.play();
        })
        currentGame.bind('game-change', function(){
          if(currentGame && !currentGame.isFinished()) GameStorage.saveGame(currentGame);
        });
        currentGame.bind('game-finish', function(){
          currentGame.unbindAll();
          ticker.stop().removeListeners();
          globalTimer.pause();
          GameStorage.cleanGameSave();
          sg.endGame(gameEndProgression == null);
        });
        
        onRouteChange(function(){
          gameEndProgression = null;
          if(currentGame) {
            currentGame.unbindAll();
          }
          ticker.stop().removeListeners();
          globalTimer.pause();
        });
        
        ticker.addListener(function(){
          if(gameEndProgression && gameEndProgression.isOver()) {
            currentGame.trigger('game-finish');
            gameEndProgression = null;
          }
          else {
            currentGame.render();
            game.RemainingSecondsBar.updateRemainingSeconds(gameEndProgression, timeout);
          }
        }).start();
        globalTimer.start();
        
        scene('game');
      },
      endGame: function(timeoutReach) {
        if(!currentGame) return this.menu();
        var finish = $('#finish');
        var destroyed = currentGame.getAllDestroyed().sort(function(a, b){
          return b.nb - a.nb;
        }).splice(0, 4);
        for(var i=0; i<destroyed.length; ++i) {
          var dest = destroyed[i];
          dest.clrStyle = colors[dest.color].getHexWithLightness(0.5);
        }
        var blocksRemaining = currentGame.grid.countBlocks();
        var difficulty = currentGame.params.difficulty;
        var globalTimer = currentGame.params.globalTimer;
        var remainingBlocksScore = Math.floor(2*gridSizeByDifficulty[difficulty].w*gridSizeByDifficulty[difficulty].h*(colorNumberByDifficulty[difficulty]-1)/(1+blocksRemaining));
        var destructionScore = 0;
        for(var v = 0; v<destroyed.length; ++v)
          destructionScore += destroyed[v].nb;
        destructionScore *= colorNumberByDifficulty[difficulty]-2;
        var MAX_TIME_SCORE = 50;
        var gridSize = gridSizeByDifficulty[difficulty];
        var TIME_SCORE_HALFTIME_MS = gridSize.w*gridSize.h*800;
        var timeScore = Math.floor(MAX_TIME_SCORE*Math.exp(-globalTimer.getMillis()*(Math.log(2)/TIME_SCORE_HALFTIME_MS)) );
        var score = remainingBlocksScore + destructionScore + timeScore;
        var newRecord = GameStorage.setDifficultyScore(difficulty, score);
        GameStorage.addToTotalScore(score);
        $('#bestDestroyedLi').tmpl(destroyed).appendTo($('#finish .bestDestroyed').empty());
        
        if(newRecord) finish.find('.newRecord').show();
        else finish.find('.newRecord').hide();
        if(blocksRemaining==0) {
          finish.find('.congratulations').show();
          finish.find('.gameover').hide();
        }
        else {
          finish.find('.gameover').show();
          finish.find('.congratulations').hide();
        }
        finish.find('.remainingBlocksScore').text(''+remainingBlocksScore);
        finish.find('.timeScore').text(''+timeScore);
        finish.find('.totalScore').text(''+score);
        finish.find('.destructionScore').text(''+destructionScore);
        finish.find('.remainingBlocksScoreTitle').text((blocksRemaining==0 ? i18n.get('all_blocks_destroyed') : blocksRemaining+' '+i18n.get('blocks_remaining')));
        finish.find('.again').unbind().bind('click', function(e){
          e.preventDefault();
          redirect('/game/new/'+difficulties[difficulty]);
        });
        GameStorage.cleanGameSave();
        currentGame.unbindAll();
        currentGame = null;
        scene('finish');
      }
    }
  }());
  
  /// Init and bind the game controller
  $(document).ready(function(){
    
    var startGame = function(){
      $('#main').show();
      
      $('a[href^="#!"]').click(function(e){
        var path = $(this).attr('href');
        e.preventDefault();
        game.SameGame.route(!path ? '/' : path.replace('#!', ''));
      });
      
      game.SameGame.init();
      
      //game.SameGame.index();
      game.SameGame.route('/');
      /*
      $(window).hashchange(function() {
        game.SameGame.route(!location.hash ? '/' : location.hash.replace('#!', ''));
      }).hashchange();
      */
    }
    var requiredSupport = {
      canvas: "HTML Canvas",
      csstransforms: "CSS Transforms 2D",
      opacity: "CSS Opacity",
      rgba: "CSS rgba()"
    }
    var recommendedSupport = {
      borderradius: "CSS border-radius",
      textshadow: "CSS text-shadow",
      localstorage: "HTML localStorage",
      fontface: "CSS font-face",
      csstransitions: "CSS Transitions",
      audio: "HTML Audio"
    }
    var support = $.extend(Modernizr);
    support.audio = support.audio.mp3 || support.audio.ogg;
    var requiredNode = $("<ul />");
    for(var o in requiredSupport) {
      var text = requiredSupport[o];
      if(!support[o]) {
        requiredNode.append('<li class="'+o+'">'+text+'</li>');
      }
    }
    var recommendedNode = $("<ul />");
    for(var o in recommendedSupport) {
      var text = recommendedSupport[o];
      if(!support[o]) {
        recommendedNode.append('<li class="'+o+'">'+text+'</li>');
      }
    }
    var lang = util.Locale.get();
    var node = $('<div id="support"></div>');
    node.append('<h1><img src="logo.png" /> SAME</h1>');
    node.append('<h2>'+(lang=='fr' ? 'Mettez à jour votre navigateur' : 'Update your browser')+'</h2>');
    if(requiredNode.find('li').size()>0) {
      node.append('<h3>'+(lang=='fr' ? 'Fonctionnalités requises non supportées:' : 'Required support :')+'</h3>');
      node.append(requiredNode);
      node.append('<p>'+(lang=='fr' ? 'Merci de mettre à jour votre navigateur pour pouvoir jouer au jeu.' : 'Please update your browser to make the game work.')+'</p>');
      node.append('<p>'+(lang=='fr' ? 'Navigateurs recommandés: Firefox 4 ou Chrome' : 'Recommended browser: Firefox 4 or Chrome')+'</p>');
    }
    else if(recommendedNode.find('li').size()>0) {
      node.append('<h3>'+(lang=='fr' ? 'Fonctionnalités recommandées non supportées:' : 'Recommended support :')+'</h3>');
      node.append(recommendedNode);
      node.append('<p>'+(lang=='fr' ? 'Merci de mettre à jour votre navigateur pour avoir une meilleure expérience de jeu.' : 'Please update your browser to have a better experience.')+'</p>');
      for(var append=0; append<2; ++append) {
        var valid = $('<a href="javascript:;" class="button">'+(lang=='fr' ? 'Passer' : 'Pass')+'</a>');
        $(valid).click(function(){
          node.remove();
          startGame();
        });
        var p = $('<p class="center" />').append(valid);
        if(!append)
          node.find('h1:first').after(p);
        else
          node.append(p);
      }
    }
    else {
      return startGame();
    }
    $('body').append(node);
  });
  
}());
 

