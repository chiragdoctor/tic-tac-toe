var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var controller = require('./app/controller');

var app = express();

var port = process.env.PORT || '3000';
app.set('port', port);

var server = require('http').Server(app);
var io = require('socket.io')(server);
var ai = require("./public/javascripts/game-logic.js");
var GAME_CONNECTOR = "___";

server.listen(port);

console.log('Tic-Tac-Toe server listening on port %d', port);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', controller.get);

app.post('/', controller.post);

var players= [];
var gameRegistrar = [];

io.on('connection', function(socket) {
    setupPlayerAndConnection(socket);
    // Updates a Players name for display across clients
    socket.on('updatePlayerName',function(nameData) {
        var player = getPlayer(socket.id);
        player.playerName=nameData.name;
        io.emit('player_update',player);

    });

    socket.on('requestComputerGame', function(data){

        // Create AI player
        var aiPlayer = new Player(data.requestID+"_AI","Computer",0,0,0,"playing",true);
        getPlayer(data.requestID).computerai=false;
        var players = {requester:getPlayer(data.requestID),requestee:aiPlayer};
        var game = new Game(players,data.requestID);
        game.state="live";
        gameRegistrar.push(game);
        game.players.forEach(function(player) {
            player.state="playing";
        });

        function sendRequest(gamePlaying) {
            io.emit("player_update",gamePlaying.playerX);
            gamePlaying.startGame();
        }

        sendRequest(game);


    });

    socket.on('disconnect', function(){

        var playerDelete;
        cleanGameByPlayer(socket.id);
        for (var i=0;i<players.length;++i) {
            if (players[i].id==socket.id) {

                playerDelete=players[i];
                players.splice(i,1);
            }
        }

        playerDelete.playing=false;
        playerDelete.state="left";
        io.emit('player_update',playerDelete);
    });

    socket.on('playTurn', function(data){

        var gameId=data.gameId;
        var gamePlaying = getGame(gameId);
        if (data.player!==socket.id) console.error("Something is Up!");

        gamePlaying.completeTurn(getPlayer(data.player),[data.action.row,data.action.quad]);

        if (gamePlaying.isStalemate()) {
            console.log('stale..')
            io.in(gameId).emit('stale_mate',gamePlaying);
            io.in(gameId).emit('game_message',{message:"Stale Mate!"});
            getGame(data.gameId).endGame();
        } else if (gamePlaying.isWinner()) {

            var gameCompleted={
                game:gamePlaying,
                winner:getPlayer(socket.id)
            };
            io.in(gameId).emit('game_won',gameCompleted);
            getGame(gameId).endGame();
        }else
        {
            io.in(gameId).emit('turn_played',gamePlaying);
            if (gamePlaying.currentPlayer.computerai) {
                setTimeout(function() {
                    computerMove(gamePlaying)},100);
            }
        }
    });
});

function computerMove(gamePlaying,delay) {

    var player = gamePlaying.currentPlayer;

    var scores= ai.scoreBoard(gamePlaying.board,player.id);
    var maxScore =0;
    var r_move=0;
    var c_move=0;
    var scoreHold=new Array();
    for (var r=0;r<3;r++){
        for (var c=0;c<3;c++) {
            if (maxScore==scores[r][c]){
                scoreHold.push({r:r,c:c,score:scores[r][c]});
            }else if (maxScore<scores[r][c]) {
                scoreHold=new Array();
                maxScore=scores[r][c];
                scoreHold.push({r:r,c:c,score:scores[r][c]});
            }
        }
    }

    if (scoreHold.length>1) {
        var select= Math.floor(Math.random() * scoreHold.length-1) + 1;
        r_move=scoreHold[select].r;
        c_move=scoreHold[select].c;
    }else
    {
        r_move=scoreHold[0].r;
        c_move=scoreHold[0].c;
    }


    gamePlaying.aiscore=scores;

    gamePlaying.completeTurn(player,[r_move,c_move]);

    if (gamePlaying.isStalemate()) {

        io.in(gamePlaying.playerX.id).emit('stale_mate',gamePlaying);
        io.in(gamePlaying.playerX.id).emit('game_message',{message:"Stale Mate!"});
        getGame(gamePlaying.id).endGame();
    } else if (gamePlaying.isWinner()) {

        var gameCompleted={
            game:gamePlaying,
            winner:gamePlaying.playerO.id
        };
        io.in(gamePlaying.playerX.id).emit('game_won',gameCompleted);
        getGame(gamePlaying.id).endGame();
    }else
    {

        io.in(gamePlaying.playerX.id).emit('turn_played',gamePlaying);

    }


}

//Removes any Games with Player.id.  Used when a Player exits.
function cleanGameByPlayer(playerId) {
    for (var i=0;i<gameRegistrar.length;i++)
    {

        var playerIds=gameRegistrar[i].id.split(GAME_CONNECTOR);

        if (playerIds[0]==playerId||playerIds[1]==playerId){
            gameRegistrar.splice(i,1);

        }

    }
}

//End Game that cleans the Game
Game.prototype.endGame= function() {
    this.players.forEach(function(player) {
        if (!player.computerai) {
            player.state="new";
            io.emit('player_update',player);
        }

    });

    this.cleanGame();

}


//Removes the Game from the Index using Game.id
Game.prototype.cleanGame= function(){
    for (var i=0;i<gameRegistrar.length;i++)
    {

        if (gameRegistrar[i].gameId==this.gameId){
            gameRegistrar.splice(i,1);
            break;
        }

    }
}

//Is Game in Stalemate?
Game.prototype.isStalemate = function() {

    if (gameDone(this.board).result=="stalemate") {
        if (this.live) {
            this.stats.x.stale++;
            this.stats.o.stale++;
            this.live=false;
        }

        return true;
    }


    return false;
};

//Do we have a winner, returns true/false.
Game.prototype.isWinner = function() {
    var results = gameDone(this.board);
    if (results.result=="winner") {
        if (this.live) {
            if (this.playerX.id==results.winner) {
                this.stats.x.wins++;
                this.stats.o.losses++;
            }else
            {
                this.stats.x.losses++;
                this.stats.o.wins++;
            }
            this.live=false;
        }


        return true;
    }
    return false;

};

Game.prototype.completeTurn  = function(player,location) {

    if (this.currentPlayer===player&&player===this.playerX) {
        this.board[location[0]][location[1]]=this.playerX.id;
        this.currentPlayer=this.playerO;
    }else
    {

        this.board[location[0]][location[1]]=this.playerO.id;
        this.currentPlayer=this.playerX;
    }
};

function getGame(gameId) {
    for (var i = 0; i < gameRegistrar.length; i++) {
        if (gameRegistrar[i].id == gameId) {
            return gameRegistrar[i];
        }

    }
    console.error("Error: No Game Found for " + gameId );
    return null;
}

function gameDone(board) {
    //Check for Winner

    for (var i=0;i<3;i++) {
        var lastSquare=0;
        for (var q=0;q<3;q++) {
            if (q==0) {
                if (board[i][q]==0) break;
                lastSquare=board[i][q];
            } else
            {
                if (board[i][q]==0||lastSquare!=board[i][q]) break;
                lastSquare=board[i][q];
            }
            if (q==2) return {result:"winner",winner:board[i][q]};
        }

    }

    for (var i=0;i<3;i++) {
        var lastSquare=0;
        for (var q=0;q<3;q++) {
            if (q==0) {
                if (board[q][i]==0) break;
                lastSquare=board[q][i];
            } else
            {
                if (board[q][i]==0||lastSquare!=board[q][i]) break;
                lastSquare=board[q][i];
            }
            if (q==2) return {result:"winner",winner:board[q][i]};
        }

    }

    if (board[0][0]!=0&&(board[0][0]==board[1][1]&&board[2][2]==board[1][1])) {
        return  {result:"winner",winner:board[0][0]};
    }

    //Check for ways to win
    if (board[0][2]!=0&&board[0][2]==board[1][1]&&board[2][0]==board[1][1]) {
        return  {result:"winner",winner:board[1][1]};
    }

    //Check StaleMate
    var mate=true;
    for (var i=0;i<3;i++) {

        for (var q=0;q<3;q++) {
            if (board[i][q]==0) mate=false;
        }

    }
    if (mate) {
        return {result:"stalemate"};
    }

    return {result:"live",winner:null};
}

//Game Object
function Game(playerList,id) {
    playerList.requester.icon="X";
    this.playerX=playerList.requester;

    playerList.requestee.icon="O";
    this.playerO= playerList.requestee;

    this.players=[this.playerX,this.playerO];

    this.currentPlayer=this.playerX;

    //Main Vars
    this.id=id!=null?id:this.playerX.id+GAME_CONNECTOR+this.playerO.id;
    this.board=[[0,0,0],[0,0,0],[0,0,0]];
    this.aiscore=[[0,0,0],[0,0,0],[0,0,0]];
    this.stats={x:{wins:0,losses:0,stale:0},o:{wins:0,losses:0,stale:0}};
    this.live=true;

    return this;
}

Game.prototype.startGame = function(){
    this.players.forEach(function(player) {
        player.state="playing";
        io.emit('player_update',player);
    });

    io.in(this.id).emit('begin_game',this);
    io.in(this.playerX.id).emit('game_message',{message:"Game Started, You go First"});
    io.in(this.playerO.id).emit('game_message',{message:"Game Started, Other Player Thinking"});
}


//Gets a Player by Player.id
function getPlayer(playerId) {
    for (var i=0;i<players.length;++i) {
        if (players[i].id==playerId) {
            return players[i];
        }
    }

    console.error("Error: No Player Found for " + playerId);
}

//Player Object
function Player(clientId,userName,wins,losses,stalemate,state,ai) {

    this.id=clientId;
    this.state=state;
    if (userName !== undefined) {
        this.playerName=userName;
    }else
    {
        this.playerName=this.id;
    }
    this.wins=wins;
    this.losses=losses;
    this.stalemate=stalemate;
    // this.icon=playerIcon;
    this.computerai=ai;
    return this;
}

function getCookieValue(request,cookie) {
    var list = {},
        rc = request.headers.cookie;
    var match="";
    rc && rc.split(';').forEach(function( cookie ) {

        var parts = cookie.split('=');

        if (parts[0].trim()=="tttGameParams") match = parts[1];

    });

    return match;
}

function extractParams(cookieParams,socketId) {
    //console.log(cookieParams);
    var gameParams;
    if (cookieParams === "") {
        return {
            userName:socketId,
            session:socketId,
            wins:0,
            losses:0,
            stalemates:0

        };
    }else
    {
        var parseStr = cookieParams.split("|");
        return {
            userName:parseStr[0],
            session:parseStr[1],
            wins:parseStr[2],
            losses:parseStr[3],
            stalemates:parseStr[4]
        };

    }
}

function setupPlayerAndConnection(socket) {
    //Cookie Process for Name - Ignore Session Id since it most likely is Stale
    var cookieStr = getCookieValue(socket.request, "userinfo");
    //Load Game Params from Cookie
    var gameParams = extractParams(cookieStr, socket.id);
    //Set Player
    var player = new Player(socket.id, gameParams.userName, "new", false);
    players.push(player);
    socket.emit('available_games', players);
    io.emit('player_update', player);
}

module.exports = app;
